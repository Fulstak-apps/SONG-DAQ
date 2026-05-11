use anchor_lang::prelude::*;

#[event]
pub struct IpoLaunched {
    pub song: Pubkey,
    pub mint: Pubkey,
    pub artist: Pubkey,
}

#[event]
pub struct Traded {
    pub song: Pubkey,
    pub is_buy: bool,
    pub tokens: u64,
    pub lamports: u64,
}

#[event]
pub struct RoyaltyDeposited {
    pub song: Pubkey,
    pub amount: u64,
    pub to_artist: u64,
    pub to_holders: u64,
    pub to_treasury: u64,
}
