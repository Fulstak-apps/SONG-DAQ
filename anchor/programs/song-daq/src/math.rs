pub mod pricing {
    /// Closed-form integral of the linear bonding curve, scaled by the
    /// off-chain performance multiplier (1e6 fixed-point).
    ///
    ///   reserve(s) = base*s + 0.5 * slope * s^2
    ///   cost = reserve(s1) - reserve(s0)
    ///   effective = cost * performance / 1e6
    pub fn effective_cost(base: u64, slope: u64, s0: u64, s1: u64, perf_x1e6: u64) -> u64 {
        let r0 = (base as u128 * s0 as u128) + (slope as u128 * s0 as u128 * s0 as u128 / 2);
        let r1 = (base as u128 * s1 as u128) + (slope as u128 * s1 as u128 * s1 as u128 / 2);
        let raw = r1.saturating_sub(r0);
        (raw * perf_x1e6 as u128 / 1_000_000) as u64
    }

    /// Spot price at supply `s`. Useful for integration tests.
    pub fn calculate_price(base: u64, slope: u64, supply: u64, perf_x1e6: u64) -> u64 {
        let raw = base + supply.saturating_mul(slope);
        ((raw as u128) * (perf_x1e6 as u128) / 1_000_000) as u64
    }
}
