import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await prisma.marketEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { song: { select: { symbol: true, title: true, artworkUrl: true } } },
  });
  // payload is stored as a JSON string in sqlite — parse for client
  const decoded = events.map((e) => ({
    ...e,
    payload: safeParse(e.payload),
  }));
  return NextResponse.json({ events: decoded });
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return {}; }

}
