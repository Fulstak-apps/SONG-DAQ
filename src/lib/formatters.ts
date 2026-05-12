export function fmtUsdDisplay(n: number, digits = 4) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs > 0 && abs < 0.000001) {
    const fixed = abs.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
    return fixed === "0" ? "<$0.000000000001" : `${n < 0 ? "-$" : "$"}${fixed}`;
  }
  return `$${n.toFixed(abs < 1 ? Math.max(digits, 2) : digits)}`;
}
