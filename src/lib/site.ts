export const SITE_NAME = "song-daq";
export const SITE_BRAND = "SONG·DAQ";
export const SITE_TITLE = "song-daq — Music Coin Marketplace";
export const SITE_DESCRIPTION =
  "song-daq lets artists launch music markets on Solana and lets fans discover, buy, sell, and track song coins and artist coins with clear price, liquidity, wallet, and royalty signals.";

export function getSiteOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "https://songdaq.com"
  ).replace(/\/$/, "");
}

export function siteUrl(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteOrigin()}${normalized}`;
}
