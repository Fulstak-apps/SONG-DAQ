import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Combine MarketEvent + SocialPost into a single chronological stream.
  const [events, posts] = await Promise.all([
    prisma.marketEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { song: { select: { id: true, symbol: true, title: true, artworkUrl: true } } },
    }),
    prisma.socialPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        user: { select: { wallet: true, audiusHandle: true, audiusName: true, audiusAvatar: true } },
        song: { select: { id: true, symbol: true, title: true, artworkUrl: true } },
      },
    }),
  ]);

  const eventItems = events.map((e) => {
    let payload: any = {};
    try { payload = JSON.parse(e.payload); } catch {}
    return {
      id: e.id, ts: e.createdAt, source: "event" as const,
      kind: e.kind, song: e.song, payload,
    };
  }).filter((e) => e.kind !== "ROYALTY" && !e.payload?.mock);
  const postItems = posts.map((p) => ({
    id: p.id, ts: p.createdAt, source: "post" as const,
    kind: p.kind, song: p.song, user: p.user, text: p.text,
  }));
  const merged = [...eventItems, ...postItems].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );
  return NextResponse.json({ items: merged });
}

export async function POST(req: NextRequest) {
  const { wallet, songId, text } = await req.json();
  if (!wallet || !text) return NextResponse.json({ error: "wallet and text required" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { wallet } });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const post = await prisma.socialPost.create({
    data: { userId: user.id, songId: songId ?? null, kind: "POST", text: String(text).slice(0, 280) },
  });
  return NextResponse.json({ post });
}
