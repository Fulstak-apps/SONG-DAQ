import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(_req: Request, { params }: { params: { mint: string } }) {
  const song = await prisma.songToken.findUnique({
    where: { mintAddress: params.mint },
    select: { title: true, symbol: true, artistName: true },
  }).catch(() => null);

  const symbol = esc((song?.symbol || "$SONG").replace(/^\$/, "").slice(0, 10).toUpperCase());
  const title = esc(song?.title || "song-daq");
  const artist = esc(song?.artistName || "Song Coin");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#020403"/>
      <stop offset="0.52" stop-color="#111827"/>
      <stop offset="1" stop-color="#00E572"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1024" height="1024" rx="164" fill="url(#g)"/>
  <path d="M120 560 C210 410 300 410 390 560 S570 710 660 560 S840 410 930 560" fill="none" stroke="#D8FFE8" stroke-width="20" stroke-linecap="round" opacity="0.72" filter="url(#glow)"/>
  <path d="M162 672 C246 604 322 604 406 672 S574 740 658 672 S826 604 910 672" fill="none" stroke="#9B51E0" stroke-width="12" stroke-linecap="round" opacity="0.58"/>
  <circle cx="512" cy="376" r="134" fill="#020403" opacity="0.78" stroke="#D8FFE8" stroke-width="3"/>
  <text x="512" y="394" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="900" fill="#00E572">${symbol}</text>
  <text x="512" y="814" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="800" fill="#FFFFFF">${title}</text>
  <text x="512" y="862" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#C8D0D8">${artist}</text>
  <text x="512" y="926" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="8" fill="#020403">song-daq VERIFIED METADATA</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
