export function pickAudiusArtwork(input: any, fallback?: string | null): string | null {
  const candidates = [
    input?.artworkUrl,
    input?.artwork_url,
    input?.image,
    input?.coverUrl,
    input?.cover_url,
    input?.artwork?.["1000x1000"],
    input?.artwork?.["480x480"],
    input?.artwork?.["150x150"],
    input?.artwork?.url,
    typeof input?.artwork === "string" ? input.artwork : null,
    input?.track?.artworkUrl,
    input?.track?.artwork_url,
    input?.track?.image,
    input?.track?.artwork?.["1000x1000"],
    input?.track?.artwork?.["480x480"],
    input?.track?.artwork?.["150x150"],
    input?.track?.artwork?.url,
    typeof input?.track?.artwork === "string" ? input.track.artwork : null,
    fallback,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}
