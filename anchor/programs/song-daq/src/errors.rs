use anchor_lang::prelude::*;

#[error_code]
pub enum SongDaqError {
    #[msg("Field exceeds maximum length")]
    FieldTooLong,
    #[msg("Royalty splits must sum to 10000 bps (100%)")]
    SplitSumInvalid,
    #[msg("Artist share must be between 20% and 80% (2000–8000 bps)")]
    ArtistShareOutOfRange,
    #[msg("Holder share must be between 10% and 60% (1000–6000 bps)")]
    HolderShareOutOfRange,
    #[msg("Protocol share must be between 10% and 30% (1000–3000 bps)")]
    ProtocolShareOutOfRange,
    #[msg("At least one revenue stream must be enabled")]
    NoRevenueStream,
    #[msg("This revenue source is disabled in the royalty config")]
    SourceDisabled,
    #[msg("Invalid revenue source identifier")]
    InvalidSource,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Trade exceeds total supply")]
    ExceedsSupply,
    #[msg("Insufficient liquidity for trade")]
    InsufficientLiquidity,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Performance multiplier out of allowed range")]
    OutOfRange,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Nothing to claim")]
    NothingToClaim,
}
