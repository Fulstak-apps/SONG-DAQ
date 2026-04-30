use anchor_lang::prelude::*;

#[account]
pub struct SongState {
    pub song_id: String,
    pub audius_track_id: String,
    pub symbol: String,
    pub artist: Pubkey,
    pub mint: Pubkey,
    pub base_price: u64,
    pub curve_slope: u64,
    pub total_supply: u64,
    pub circulating_supply: u64,
    pub performance_x1e6: u64,
    pub created_at: i64,
    pub bump: u8,
    pub mint_authority_bump: u8,
    pub vault_bump: u8,
}

impl SongState {
    pub const SIZE: usize =
        4 + 32 +    // song_id (max 32)
        4 + 64 +    // audius_track_id (max 64)
        4 + 16 +    // symbol (max 16)
        32 + 32 +
        8 + 8 + 8 + 8 + 8 +
        8 +         // created_at
        1 + 1 + 1;  // bumps
}

#[account]
pub struct RoyaltyConfig {
    pub song: Pubkey,
    pub artist_share_bps: u16,
    pub holder_share_bps: u16,
    pub protocol_share_bps: u16,
    pub streaming_enabled: bool,
    pub trading_enabled: bool,
    pub external_enabled: bool,
    pub acc_per_token: u128,
    pub total_distributed: u64,
}

impl RoyaltyConfig {
    pub const SIZE: usize = 32 + 2 + 2 + 2 + 1 + 1 + 1 + 16 + 8;
}

#[account]
pub struct LiquidityPool {
    pub song: Pubkey,
    pub mint: Pubkey,
    pub sol_reserve: u64,
    pub token_reserve: u64,
    pub fee_bps: u16,
}

impl LiquidityPool {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 2;
}

#[account]
pub struct Holder {
    pub owner: Pubkey,
    pub song: Pubkey,
    pub amount: u64,
    pub reward_debt: u128,
    pub bump: u8,
}

impl Holder {
    pub const SIZE: usize = 32 + 32 + 8 + 16 + 1;
}
