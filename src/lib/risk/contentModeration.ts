const BLOCKED = [
  "guaranteed profit",
  "guaranteed returns",
  "risk free",
  "official drake",
  "official future",
  "official big sean",
  "copyright free",
  "rug proof",
];

const FAMOUS_NAMES = ["drake", "future", "big sean", "taylor swift", "beyonce", "rihanna", "kendrick lamar"];

export function moderateCoinText(input: { title?: string; artist?: string; verified?: boolean }) {
  const text = `${input.title ?? ""} ${input.artist ?? ""}`.toLowerCase();
  const issues: string[] = [];
  for (const term of BLOCKED) if (text.includes(term)) issues.push(`Blocked claim: ${term}`);
  if (!input.verified) {
    for (const name of FAMOUS_NAMES) if (text.includes(name)) issues.push(`Possible famous-artist impersonation: ${name}`);
  }
  return { ok: issues.length === 0, issues };
}
