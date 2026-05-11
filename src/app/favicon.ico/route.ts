export const runtime = "edge";

export function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="18" fill="#05070a"/>
    <circle cx="32" cy="32" r="18" fill="#b7ff1a"/>
    <circle cx="32" cy="32" r="10" fill="#05070a"/>
  </svg>`;

  return new Response(svg, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml",
    },
  });
}
