import { NextResponse } from "next/server";
import Parser from "rss-parser";

const parser = new Parser();

const FEEDS = [
  { url: "https://pitchfork.com/rss/news/", source: "Pitchfork", category: "MUSIC" as const },
  { url: "https://www.billboard.com/feed/", source: "Billboard", category: "MUSIC" as const },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch", category: "TECH" as const },
  { url: "https://www.theverge.com/rss/index.xml", source: "The Verge", category: "TECH" as const },
];

export async function GET() {
  const stories: any[] = [];

  for (const feed of FEEDS) {
    try {
      const data = await parser.parseURL(feed.url);
      data.items.slice(0, 5).forEach((item) => {
        stories.push({
          id: item.guid || item.link || Math.random().toString(),
          title: item.title || "No Title",
          link: item.link || "#",
          pubDate: item.pubDate || new Date().toISOString(),
          author: item.creator || item.author,
          contentSnippet: item.contentSnippet,
          source: feed.source,
          category: feed.category,
          thumbnail: (item as any).enclosure?.url || 
                     (item.content?.match(/src="([^"]+)"/)?.[1]) || 
                     undefined
        });
      });
    } catch (e) {
      console.error(`Failed to fetch feed ${feed.url}`, e);
    }
  }



  stories.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  
  return NextResponse.json({ news: stories });
}
