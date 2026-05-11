import { NextResponse } from "next/server";
import Parser from "rss-parser";
import { fetchText } from "@/lib/fetchTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const parser = new Parser();
const NEWS_CACHE_MS = 5 * 60_000;
type NewsCategory = "MUSIC" | "TECH" | "AI" | "TRENDING";

let newsCache: { at: number; news: any[] } | null = null;

const FEEDS = [
  { url: "https://pitchfork.com/rss/news/", source: "Pitchfork", category: "MUSIC" as NewsCategory },
  { url: "https://www.billboard.com/feed/", source: "Billboard", category: "MUSIC" as NewsCategory },
  { url: "https://www.musicbusinessworldwide.com/feed/", source: "Music Business Worldwide", category: "MUSIC" as NewsCategory },
  { url: "https://www.hypebot.com/feed", source: "Hypebot", category: "MUSIC" as NewsCategory },
  { url: "https://news.google.com/rss/search?q=(music%20industry%20OR%20music%20business%20OR%20artist%20royalties%20OR%20streaming%20royalties)%20when:2d&hl=en-US&gl=US&ceid=US:en", source: "Google Music News", category: "MUSIC" as NewsCategory },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch", category: "TECH" as NewsCategory },
  { url: "https://www.theverge.com/rss/index.xml", source: "The Verge", category: "TECH" as NewsCategory },
  { url: "https://www.wired.com/feed/rss", source: "WIRED", category: "TECH" as NewsCategory },
  { url: "https://feeds.arstechnica.com/arstechnica/index", source: "Ars Technica", category: "TECH" as NewsCategory },
  { url: "https://venturebeat.com/category/ai/feed/", source: "VentureBeat AI", category: "AI" as NewsCategory },
  { url: "https://www.artificialintelligence-news.com/feed/", source: "AI News", category: "AI" as NewsCategory },
  { url: "https://news.google.com/rss/search?q=(AI%20OR%20artificial%20intelligence%20OR%20generative%20AI)%20music%20OR%20creator%20when:2d&hl=en-US&gl=US&ceid=US:en", source: "Google AI News", category: "AI" as NewsCategory },
];

const FALLBACK_NEWS = [
  {
    id: "songdaq-fallback-music",
    title: "Music markets are syncing live signals",
    link: "https://audius.co",
    pubDate: new Date().toISOString(),
    source: "SONG·DAQ",
    category: "MUSIC" as NewsCategory,
  },
  {
    id: "songdaq-fallback-tech",
    title: "Streaming, wallets, and token activity continue updating",
    link: "https://solana.com",
    pubDate: new Date().toISOString(),
    source: "SONG·DAQ",
    category: "TECH" as NewsCategory,
  },
  {
    id: "songdaq-fallback-ai",
    title: "AI music and creator tooling signals are temporarily delayed",
    link: "https://audius.co",
    pubDate: new Date().toISOString(),
    source: "SONG·DAQ",
    category: "AI" as NewsCategory,
  },
  {
    id: "songdaq-fallback-trending",
    title: "Market intelligence source temporarily delayed",
    link: "https://song-daq.onrender.com/market",
    pubDate: new Date().toISOString(),
    source: "SONG·DAQ",
    category: "TRENDING" as NewsCategory,
  },
];

function cleanText(value: any, fallback = "") {
  return String(value || fallback)
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&ldquo;|&rdquo;/g, "\"")
    .replace(/&#39;|&apos;|&lsquo;|&rsquo;/g, "'")
    .replace(/&mdash;|&ndash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s*[|•·-]\s*(Pitchfork|Billboard|Music Business Worldwide|Hypebot|TechCrunch|The Verge|WIRED|Ars Technica|VentureBeat|AI News|Google News)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldUrl(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (Array.isArray(value)) return value.map(fieldUrl).find(Boolean);
  if (typeof value === "object") {
    return value.$?.url || value.url || value.href || value._ || undefined;
  }
  return undefined;
}

function thumbnail(item: any): string | undefined {
  const media =
    fieldUrl(item["media:content"]) ||
    fieldUrl(item["media:thumbnail"]) ||
    fieldUrl(item["media:group"]?.["media:content"]) ||
    fieldUrl(item["media:group"]?.["media:thumbnail"]) ||
    fieldUrl(item["itunes:image"]) ||
    fieldUrl(item.image) ||
    fieldUrl(item.thumbnail);
  const enclosure = fieldUrl(item.enclosure);
  const content = item["content:encoded"] || item.content || item.summary || "";
  const img = typeof content === "string"
    ? content.match(/<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i)?.[1]
    : undefined;
  return media || enclosure || img || undefined;
}

function autoCategory(item: any, fallback: NewsCategory): NewsCategory {
  const text = [
    item.title,
    item.contentSnippet,
    item.content,
    item.summary,
    item.creator,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\b(ai|artificial intelligence|machine learning|generative|openai|anthropic|llm|model|neural|automation)\b/.test(text)) {
    return "AI";
  }
  if (/\b(label|artist|song|album|music|streaming|spotify|audius|royalt|tour|concert|producer|publishing|catalog|recording|songwriter)\b/.test(text)) {
    return "MUSIC";
  }
  if (/\b(tech|startup|software|apple|google|microsoft|meta|crypto|blockchain|solana|wallet|app|platform|device|cloud)\b/.test(text)) {
    return "TECH";
  }
  return fallback;
}

export async function GET() {
  if (newsCache && Date.now() - newsCache.at < NEWS_CACHE_MS) {
    return NextResponse.json({ news: newsCache.news, cached: true });
  }

  const settled = await Promise.allSettled(FEEDS.map(async (feed) => {
    try {
      const xml = await fetchText(feed.url, {}, 4_500);
      const data = await parser.parseString(xml);
      return data.items.slice(0, 10).map((item) => ({
          id: item.guid || item.link || Math.random().toString(),
          title: cleanText(item.title, "No Title"),
          link: item.link || "#",
          pubDate: item.pubDate || new Date().toISOString(),
          author: item.creator || item.author,
          contentSnippet: cleanText(item.contentSnippet || item.summary || item.content, ""),
          source: feed.source,
          category: autoCategory(item, feed.category),
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

  const buckets: NewsCategory[] = ["MUSIC", "TECH", "AI", "TRENDING"];
  const visualFirst = (items: any[]) => [...items].sort((a, b) => {
    const imageDelta = Number(Boolean(b.thumbnail)) - Number(Boolean(a.thumbnail));
    if (imageDelta) return imageDelta;
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });
  const balanced = [
    ...buckets.flatMap((category) => visualFirst(unique.filter((story) => story.category === category)).slice(0, 10)),
    ...visualFirst(unique),
  ];
  const deduped = Array.from(new Map(balanced.map((story) => [story.link || story.title, story])).values());
  const news = deduped.length ? deduped.slice(0, 48) : FALLBACK_NEWS;
  newsCache = { at: Date.now(), news };
  
  return NextResponse.json({ news, cached: false });
}
