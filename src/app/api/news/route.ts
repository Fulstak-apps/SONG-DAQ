import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { fetchText } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const parser = new Parser();
const NEWS_CACHE_MS = 5 * 60_000;

let newsCache: { at: number; news: any[] } | null = null;

const FEEDS = [
  { url: "https://pitchfork.com/rss/news/", source: "Pitchfork", category: "MUSIC" as const },
  { url: "https://www.billboard.com/feed/", source: "Billboard", category: "MUSIC" as const },
  { url: "https://www.musicbusinessworldwide.com/feed/", source: "Music Business Worldwide", category: "MUSIC" as const },
  { url: "https://news.google.com/rss/search?q=music%20OR%20artist%20OR%20album%20when:1d&hl=en-US&gl=US&ceid=US:en", source: "Google News", category: "TRENDING" as const },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch", category: "TECH" as const },
  { url: "https://www.theverge.com/rss/index.xml", source: "The Verge", category: "TECH" as const },
  { url: "https://www.wired.com/feed/rss", source: "WIRED", category: "TECH" as const },
];

const FALLBACK_NEWS = [
  {
    id: "songdaq-fallback-music",
    title: "Music markets are syncing live signals",
    link: "https://audius.co",
    pubDate: new Date().toISOString(),
    source: "SONG·DAQ",
    category: "MUSIC" as const,
  },
  {
    id: "songdaq-fallback-tech",
    title: "Streaming, wallets, and token activity continue updating",
    link: "https://solana.com",
    pubDate: new Date().toISOString(),
    source: "SONG·DAQ",
    category: "TECH" as const,
  },
  {
    id: "songdaq-fallback-trending",
    title: "Market intelligence source temporarily delayed",
    link: "https://song-daq.onrender.com/market",
    pubDate: new Date().toISOString(),
    source: "SONG·DAQ",
    category: "TRENDING" as const,
  },
];

function thumbnail(item: any): string | undefined {
  const media = item["media:content"]?.$?.url || item["media:thumbnail"]?.$?.url;
  const enclosure = item.enclosure?.url;
  const content = item["content:encoded"] || item.content || item.summary || "";
  const img = typeof content === "string" ? content.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] : undefined;
  return media || enclosure || img || undefined;
}

export async function GET() {
  if (newsCache && Date.now() - newsCache.at < NEWS_CACHE_MS) {
    return NextResponse.json({ news: newsCache.news, cached: true });
  }

  const settled = await Promise.allSettled(FEEDS.map(async (feed) => {
    try {
      const xml = await fetchText(feed.url, {}, 2_000);
      const data = await parser.parseString(xml);
      return data.items.slice(0, 8).map((item) => ({
          id: item.guid || item.link || Math.random().toString(),
          title: item.title || "No Title",
          link: item.link || "#",
          pubDate: item.pubDate || new Date().toISOString(),
          author: item.creator || item.author,
          contentSnippet: item.contentSnippet,
          source: feed.source,
          category: feed.category,
          thumbnail: thumbnail(item),
      }));
    } catch (e) {
      console.error(`Failed to fetch feed ${feed.url}`, e);
      return [];
    }
  }));

  const stories = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);

  const unique = Array.from(new Map(stories.map((s) => [s.link || s.title, s])).values());
  unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const news = unique.length ? unique.slice(0, 36) : FALLBACK_NEWS;
  newsCache = { at: Date.now(), news };
  
  return NextResponse.json({ news, cached: false });
}
