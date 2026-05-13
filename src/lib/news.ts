import Parser from "rss-parser";
import { fetchText } from "@/lib/fetchTimeout";

const parser = new Parser();
type NewsCategory = "MUSIC" | "TECH" | "AI" | "TRENDING";

export interface NewsStory {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  author?: string;
  contentSnippet?: string;
  source: string;
  category: NewsCategory;
  thumbnail?: string;
}

const FEEDS = [
  { url: "https://pitchfork.com/rss/news/", source: "Pitchfork", category: "MUSIC" as NewsCategory },
  { url: "https://www.billboard.com/feed/", source: "Billboard", category: "MUSIC" as NewsCategory },
  { url: "https://www.musicbusinessworldwide.com/feed/", source: "Music Business Worldwide", category: "MUSIC" as NewsCategory },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch", category: "TECH" as NewsCategory },
  { url: "https://www.theverge.com/rss/index.xml", source: "The Verge", category: "TECH" as NewsCategory },
  { url: "https://venturebeat.com/category/ai/feed/", source: "VentureBeat AI", category: "AI" as NewsCategory },
];

export async function getNews(): Promise<NewsStory[]> {
  const stories: NewsStory[] = [];

  for (const feed of FEEDS) {
    try {
      const xml = await fetchText(feed.url, {}, 4_500);
      const data = await parser.parseString(xml);
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
          // Extract thumbnail if possible (very basic extraction)
          thumbnail: (item as any).enclosure?.url || 
                     (item.content?.match(/src="([^"]+)"/)?.[1]) || 
                     undefined
        });
      });
    } catch (e) {
      console.error(`Failed to fetch feed ${feed.url}`, e);
    }
  }

  // Add some "TRENDING SIGNALS" generated from our platform
  // (In a real app, this would query the DB for volume spikes)
  stories.push({
    id: "trending-1",
    title: "Audius Artist Tokens volume surging 200% today",
    link: "/",
    pubDate: new Date().toISOString(),
    source: "SONG·DAQ Terminal",
    category: "TRENDING",
    contentSnippet: "Unusual activity detected across several Artist Tokens as liquidity pools deepen."
  });

  stories.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  return stories;
}
