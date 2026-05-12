import { ImageResponse } from "next/og";
import { SITE_BRAND } from "@/lib/site";

export const runtime = "edge";
export const alt = "SONG·DAQ music coin marketplace";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "radial-gradient(circle at 78% 25%, rgba(200,255,47,0.24), transparent 34%), linear-gradient(135deg, #05070a 0%, #11161f 52%, #05070a 100%)",
          color: "white",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: "#c8ff2f",
              boxShadow: "0 0 38px rgba(200,255,47,0.7)",
            }}
          />
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1 }}>{SITE_BRAND}</div>
        </div>
        <div>
          <div style={{ fontSize: 76, lineHeight: 0.95, fontWeight: 950, letterSpacing: -3, maxWidth: 900 }}>
            Own music markets like stock.
          </div>
          <div style={{ marginTop: 28, fontSize: 28, lineHeight: 1.35, color: "rgba(255,255,255,0.76)", maxWidth: 860 }}>
            Launch, trade, and track song coins and artist coins with price, liquidity, wallet, and royalty signals.
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, fontSize: 22, fontWeight: 800, color: "#c8ff2f" }}>
          <span>Solana markets</span>
          <span>·</span>
          <span>Audius/Open Audio ready</span>
          <span>·</span>
          <span>Royalty transparency</span>
        </div>
      </div>
    ),
    size,
  );
}
