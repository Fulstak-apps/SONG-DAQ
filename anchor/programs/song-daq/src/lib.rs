// Song DAQ — unified Anchor program.
//
// Single program covers:
//   • IPO initialization (SPL mint, song state, royalty config, pool)
//   • Bonding-curve buy / sell with fee + slippage
//   • Royalty deposit + accumulator-based holder claims
//
// Royalty splits are constrained by the same bounds enforced in the UI:
//   artist:   2000–8000 bps
//   holders:  1000–6000 bps
//   protocol: 1000–3000 bps
//   sum == 10_000

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};

declare_id!("SongDAQ1111111111111111111111111111111111");

pub mod errors;
pub mod events;
pub mod math;
pub mod state;

use errors::SongDaqError;
use math::pricing::effective_cost;
use state::*;

const FEE_BPS: u64 = 50;
const PERF_SCALE: u64 = 1_000_000;
const REWARD_SCALE: u128 = 1_000_000_000_000;

#[program]
pub mod song_daq {
    use super::*;

    /// Initialize the IPO for a song. Creates SongState, RoyaltyConfig,
    /// LiquidityPool, and the SPL mint (mint authority is a PDA).
    pub fn initialize_ipo(
        ctx: Context<InitializeIpo>,
        args: InitializeIpoArgs,
    ) -> Result<()> {
        require!(args.song_id.len() <= 32, SongDaqError::FieldTooLong);
        require!(args.audius_track_id.len() <= 64, SongDaqError::FieldTooLong);
        require!(args.symbol.len() <= 16, SongDaqError::FieldTooLong);
        validate_royalty(&args.royalty)?;

        let song = &mut ctx.accounts.song_state;
        song.song_id = args.song_id;
        song.audius_track_id = args.audius_track_id;
        song.symbol = args.symbol;
        song.artist = ctx.accounts.artist.key();
        song.mint = ctx.accounts.mint.key();
        song.base_price = args.base_price;
        song.curve_slope = args.curve_slope;
        song.total_supply = args.total_supply;
        song.circulating_supply = 0;
        song.performance_x1e6 = PERF_SCALE;
        song.created_at = Clock::get()?.unix_timestamp;
        song.bump = ctx.bumps.song_state;
        song.mint_authority_bump = ctx.bumps.mint_authority;
        song.vault_bump = ctx.bumps.vault;

        let cfg = &mut ctx.accounts.royalty_config;
        cfg.song = song.key();
        cfg.artist_share_bps = args.royalty.artist_share_bps;
        cfg.holder_share_bps = args.royalty.holder_share_bps;
        cfg.protocol_share_bps = args.royalty.protocol_share_bps;
        cfg.streaming_enabled = args.royalty.streaming_enabled;
        cfg.trading_enabled = args.royalty.trading_enabled;
        cfg.external_enabled = args.royalty.external_enabled;
        cfg.acc_per_token = 0;
        cfg.total_distributed = 0;

        let pool = &mut ctx.accounts.pool;
        pool.song = song.key();
        pool.mint = song.mint;
        pool.sol_reserve = 0;
        pool.token_reserve = 0;
        pool.fee_bps = FEE_BPS as u16;

        emit!(events::IpoLaunched {
            song: song.key(),
            mint: song.mint,
            artist: song.artist,
        });
        Ok(())
    }

    /// Update the performance multiplier (oracle-style; signed by artist).
    pub fn set_performance(ctx: Context<AdminSong>, performance_x1e6: u64) -> Result<()> {
        require!(performance_x1e6 >= 10_000 && performance_x1e6 <= 8_000_000, SongDaqError::OutOfRange);
        ctx.accounts.song_state.performance_x1e6 = performance_x1e6;
        Ok(())
    }

    /// Buy `tokens` tokens against the bonding curve. CPI-mints to the
    /// buyer's associated token account.
    pub fn buy_tokens(ctx: Context<Trade>, tokens: u64, max_lamports: u64) -> Result<()> {
        let song = &mut ctx.accounts.song_state;
        require!(tokens > 0, SongDaqError::ZeroAmount);
        let new_circ = song.circulating_supply.checked_add(tokens).ok_or(SongDaqError::Overflow)?;
        require!(new_circ <= song.total_supply, SongDaqError::ExceedsSupply);

        let cost = effective_cost(
            song.base_price, song.curve_slope,
            song.circulating_supply, new_circ,
            song.performance_x1e6,
        );
        let fee = cost * FEE_BPS / 10_000;
        let total = cost.checked_add(fee).ok_or(SongDaqError::Overflow)?;
        require!(total <= max_lamports, SongDaqError::SlippageExceeded);

        // user → pool (PDA)
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.pool.to_account_info(),
                },
            ),
            total,
        )?;

        // mint tokens to buyer (mint authority is PDA)
        let mint_key = ctx.accounts.mint.key();
        let seeds: &[&[u8]] = &[b"mint-authority", mint_key.as_ref(), &[song.mint_authority_bump]];
        let signer = &[seeds];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            tokens,
        )?;

        let pool = &mut ctx.accounts.pool;
        pool.sol_reserve = pool.sol_reserve.saturating_add(cost);
        song.circulating_supply = new_circ;

        emit!(events::Traded { song: song.key(), is_buy: true, tokens, lamports: total });
        Ok(())
    }

    /// Sell `tokens` tokens. Burns from user's ATA and refunds SOL.
    pub fn sell_tokens(ctx: Context<Trade>, tokens: u64, min_lamports: u64) -> Result<()> {
        let song = &mut ctx.accounts.song_state;
        require!(tokens > 0, SongDaqError::ZeroAmount);
        require!(tokens <= song.circulating_supply, SongDaqError::InsufficientLiquidity);

        let new_circ = song.circulating_supply - tokens;
        let gross = effective_cost(
            song.base_price, song.curve_slope,
            new_circ, song.circulating_supply,
            song.performance_x1e6,
        );
        let fee = gross * FEE_BPS / 10_000;
        let net = gross - fee;
        require!(net >= min_lamports, SongDaqError::SlippageExceeded);

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            tokens,
        )?;

        // pool → user (raw lamport transfer because pool is owned by program)
        **ctx.accounts.pool.to_account_info().try_borrow_mut_lamports()? -= net;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += net;

        let pool = &mut ctx.accounts.pool;
        pool.sol_reserve = pool.sol_reserve.saturating_sub(gross);
        song.circulating_supply = new_circ;

        emit!(events::Traded { song: song.key(), is_buy: false, tokens, lamports: net });
        Ok(())
    }

    /// Deposit royalty SOL. Splits per RoyaltyConfig and accumulates the
    /// holder share against acc_per_token.
    pub fn distribute_royalties(ctx: Context<DistributeRoyalties>, amount: u64, source: u8) -> Result<()> {
        require!(amount > 0, SongDaqError::ZeroAmount);
        let cfg = &mut ctx.accounts.royalty_config;
        // gate per source: 0=streaming, 1=trading, 2=external
        match source {
            0 => require!(cfg.streaming_enabled, SongDaqError::SourceDisabled),
            1 => require!(cfg.trading_enabled, SongDaqError::SourceDisabled),
            2 => require!(cfg.external_enabled, SongDaqError::SourceDisabled),
            _ => return err!(SongDaqError::InvalidSource),
        }

        let to_artist = (amount as u128 * cfg.artist_share_bps as u128 / 10_000) as u64;
        let to_holders = (amount as u128 * cfg.holder_share_bps as u128 / 10_000) as u64;
        let to_treasury = amount.saturating_sub(to_artist).saturating_sub(to_holders);

        if to_artist > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.artist.to_account_info(),
                    },
                ),
                to_artist,
            )?;
        }
        if to_treasury > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                to_treasury,
            )?;
        }
        if to_holders > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.vault.to_account_info(),
                    },
                ),
                to_holders,
            )?;
            let supply = ctx.accounts.song_state.circulating_supply;
            if supply > 0 {
                let inc = (to_holders as u128 * REWARD_SCALE) / supply as u128;
                cfg.acc_per_token = cfg.acc_per_token.saturating_add(inc);
            }
            cfg.total_distributed = cfg.total_distributed.saturating_add(to_holders);
        }

        emit!(events::RoyaltyDeposited {
            song: ctx.accounts.song_state.key(),
            amount, to_artist, to_holders, to_treasury,
        });
        Ok(())
    }

    /// Initialize a holder receipt PDA (call once per holder/song).
    pub fn init_holder(ctx: Context<InitHolder>) -> Result<()> {
        let h = &mut ctx.accounts.holder;
        h.owner = ctx.accounts.owner.key();
        h.song = ctx.accounts.song_state.key();
        h.amount = 0;
        h.reward_debt = 0;
        h.bump = ctx.bumps.holder;
        Ok(())
    }

    /// Sync holder balance into the receipt (called by trading pool flow).
    pub fn update_holder(ctx: Context<UpdateHolder>, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.royalty_config;
        let h = &mut ctx.accounts.holder;
        h.amount = amount;
        h.reward_debt = (amount as u128 * cfg.acc_per_token / REWARD_SCALE) as u128;
        Ok(())
    }

    /// Claim accrued royalties.
    pub fn claim_royalty(ctx: Context<ClaimRoyalty>) -> Result<()> {
        let cfg = &ctx.accounts.royalty_config;
        let h = &mut ctx.accounts.holder;
        let pending_u128 = (h.amount as u128 * cfg.acc_per_token / REWARD_SCALE).saturating_sub(h.reward_debt);
        let pending = pending_u128 as u64;
        require!(pending > 0, SongDaqError::NothingToClaim);
        **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= pending;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += pending;
        h.reward_debt = (h.amount as u128 * cfg.acc_per_token / REWARD_SCALE) as u128;
        Ok(())
    }
}

fn validate_royalty(r: &InitializeIpoRoyalty) -> Result<()> {
    let sum = r.artist_share_bps as u32 + r.holder_share_bps as u32 + r.protocol_share_bps as u32;
    require!(sum == 10_000, SongDaqError::SplitSumInvalid);
    require!(r.artist_share_bps >= 2_000 && r.artist_share_bps <= 8_000, SongDaqError::ArtistShareOutOfRange);
    require!(r.holder_share_bps >= 1_000 && r.holder_share_bps <= 6_000, SongDaqError::HolderShareOutOfRange);
    require!(r.protocol_share_bps >= 1_000 && r.protocol_share_bps <= 3_000, SongDaqError::ProtocolShareOutOfRange);
    require!(
        r.streaming_enabled || r.trading_enabled || r.external_enabled,
        SongDaqError::NoRevenueStream
    );
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeIpoArgs {
    pub song_id: String,
    pub audius_track_id: String,
    pub symbol: String,
    pub base_price: u64,
    pub curve_slope: u64,
    pub total_supply: u64,
    pub royalty: InitializeIpoRoyalty,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeIpoRoyalty {
    pub artist_share_bps: u16,
    pub holder_share_bps: u16,
    pub protocol_share_bps: u16,
    pub streaming_enabled: bool,
    pub trading_enabled: bool,
    pub external_enabled: bool,
}

// ─── Account structs ────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(args: InitializeIpoArgs)]
pub struct InitializeIpo<'info> {
    #[account(mut)]
    pub artist: Signer<'info>,

    #[account(
        init,
        payer = artist,
        space = 8 + SongState::SIZE,
        seeds = [b"song", mint.key().as_ref()],
        bump,
    )]
    pub song_state: Account<'info, SongState>,

    #[account(
        init,
        payer = artist,
        space = 8 + RoyaltyConfig::SIZE,
        seeds = [b"royalty", mint.key().as_ref()],
        bump,
    )]
    pub royalty_config: Account<'info, RoyaltyConfig>,

    #[account(
        init,
        payer = artist,
        space = 8 + LiquidityPool::SIZE,
        seeds = [b"pool", mint.key().as_ref()],
        bump,
    )]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        init,
        payer = artist,
        seeds = [b"vault", mint.key().as_ref()],
        bump,
        space = 0,
    )]
    /// CHECK: SOL escrow PDA for holder royalty pool
    pub vault: UncheckedAccount<'info>,

    #[account(
        init,
        payer = artist,
        mint::decimals = 6,
        mint::authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA mint authority
    #[account(seeds = [b"mint-authority", mint.key().as_ref()], bump)]
    pub mint_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AdminSong<'info> {
    #[account(address = song_state.artist)]
    pub artist: Signer<'info>,
    #[account(mut, seeds = [b"song", song_state.mint.as_ref()], bump = song_state.bump)]
    pub song_state: Account<'info, SongState>,
}

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"song", song_state.mint.as_ref()], bump = song_state.bump)]
    pub song_state: Account<'info, SongState>,
    #[account(mut, seeds = [b"pool", song_state.mint.as_ref()], bump)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(mut, address = song_state.mint)]
    pub mint: Account<'info, Mint>,
    /// CHECK: PDA mint authority
    #[account(seeds = [b"mint-authority", song_state.mint.as_ref()], bump = song_state.mint_authority_bump)]
    pub mint_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = user_token_account.mint == song_state.mint,
        constraint = user_token_account.owner == user.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeRoyalties<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"song", song_state.mint.as_ref()], bump = song_state.bump)]
    pub song_state: Account<'info, SongState>,
    #[account(mut, seeds = [b"royalty", song_state.mint.as_ref()], bump)]
    pub royalty_config: Account<'info, RoyaltyConfig>,
    #[account(mut, seeds = [b"vault", song_state.mint.as_ref()], bump = song_state.vault_bump)]
    /// CHECK: SOL escrow PDA
    pub vault: UncheckedAccount<'info>,
    /// CHECK: artist wallet
    #[account(mut, address = song_state.artist)]
    pub artist: UncheckedAccount<'info>,
    /// CHECK: treasury wallet — set off-chain
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitHolder<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [b"song", song_state.mint.as_ref()], bump = song_state.bump)]
    pub song_state: Account<'info, SongState>,
    #[account(
        init,
        payer = owner,
        space = 8 + Holder::SIZE,
        seeds = [b"holder", song_state.key().as_ref(), owner.key().as_ref()],
        bump,
    )]
    pub holder: Account<'info, Holder>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateHolder<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"song", song_state.mint.as_ref()], bump = song_state.bump)]
    pub song_state: Account<'info, SongState>,
    #[account(seeds = [b"royalty", song_state.mint.as_ref()], bump)]
    pub royalty_config: Account<'info, RoyaltyConfig>,
    #[account(mut,
        seeds = [b"holder", song_state.key().as_ref(), holder.owner.as_ref()],
        bump = holder.bump)]
    pub holder: Account<'info, Holder>,
}

#[derive(Accounts)]
pub struct ClaimRoyalty<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [b"song", song_state.mint.as_ref()], bump = song_state.bump)]
    pub song_state: Account<'info, SongState>,
    #[account(seeds = [b"royalty", song_state.mint.as_ref()], bump)]
    pub royalty_config: Account<'info, RoyaltyConfig>,
    #[account(mut, seeds = [b"vault", song_state.mint.as_ref()], bump = song_state.vault_bump)]
    /// CHECK: SOL escrow PDA
    pub vault: UncheckedAccount<'info>,
    #[account(mut,
        seeds = [b"holder", song_state.key().as_ref(), owner.key().as_ref()],
        bump = holder.bump,
        has_one = owner)]
    pub holder: Account<'info, Holder>,
}
