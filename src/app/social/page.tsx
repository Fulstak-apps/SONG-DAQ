"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface NewsStory {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  author?: string;
  contentSnippet?: string;
  source: string;
  category: "MUSIC" | "TECH" | "TRENDING";
  thumbnail?: string;
}

export default function SocialPage() {
  const [news, setNews] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "MUSIC" | "TECH" | "TRENDING">("ALL");

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/news");
        const j = await r.json();
        setNews(j.news || []);
      } catch (e) {
        console.error("Failed to load news", e);
      } finally {
        setLoading(false);
      }
    }
    load();
    // Auto-refresh every 60 seconds
    const i = setInterval(load, 60_000);
    return () => clearInterval(i);
  }, []);

  const filtered = filter === "ALL" ? news : news.filter(n => n.category === filter);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Social News Feed</h1>
          <p className="text-mute text-sm">Real-time music, tech, and market signals.</p>
        </div>
        <div className="flex bg-panel2 border border-edge rounded-md p-0.5">
          {["ALL", "MUSIC", "TECH", "TRENDING"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1 rounded text-xs transition ${
                filter === f ? "bg-neon text-white" : "text-mute hover:text-ink"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="panel h-32 animate-pulse bg-panel2/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel p-12 text-center text-mute">
          <div className="text-4xl mb-3">📰</div>
          <div className="font-medium mb-1">No stories found</div>
          <div className="text-sm">Try a different category filter or check back soon.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((story) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel panel-hover p-4 flex gap-4 overflow-hidden"
            >
              {story.thumbnail && (
                <div className="w-24 h-24 rounded-lg bg-panel2 overflow-hidden shrink-0 border border-edge">
                  <img src={story.thumbnail} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                      story.category === "TRENDING" ? "bg-violet/10 text-violet" :
                      story.category === "MUSIC" ? "bg-neon/10 text-neon" :
                      "bg-blue-500/10 text-blue-500"
                    }`}>
                      {story.category}
                    </span>
                    <span className="text-mute text-[11px]">{story.source}</span>
                    <span className="text-mute text-[11px] ml-auto">
                      {story.pubDate ? (() => { try { return new Date(story.pubDate).toLocaleDateString(); } catch { return ""; } })() : ""}
                    </span>
                  </div>
                  <h3 className="font-medium text-lg leading-snug mb-1">
                    <a href={story.link} target="_blank" rel="noreferrer" className="hover:text-neon transition">
                      {story.title}
                    </a>
                  </h3>
                  {story.contentSnippet && (
                    <p className="text-mute text-sm line-clamp-2">
                      {story.contentSnippet}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
