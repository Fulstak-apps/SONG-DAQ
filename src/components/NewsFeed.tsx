"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Glossary } from "./Tooltip";

interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category: "MUSIC" | "TECH" | "AI" | "CREATOR" | "TRENDING";
  thumbnail?: string;
}

const CAT_STYLE: Record<string, string> = {
  MUSIC: "text-violet border-violet/20 bg-violet/5",
  TRENDING: "text-neon border-neon/20 bg-neon/5",
  TECH: "text-cyan border-cyan/20 bg-cyan/5",
  AI: "text-gold border-gold/20 bg-gold/5",
  CREATOR: "text-neon border-neon/20 bg-neon/5",
};

function categoryImage(category: NewsItem["category"]) {
  const images: Record<NewsItem["category"], string> = {
    MUSIC: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80",
    TECH: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
    AI: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80",
    CREATOR: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80",
    TRENDING: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80",
  };
  return images[category];
}

function cleanNewsText(value: string) {
  return String(value || "")
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
    .replace(/[�]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/news", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        setNews(j.news || []);
      } catch { /* ignore */ }
      finally { if (alive) setLoaded(true); }
    }
    load();
    const i = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(i); };
  }, []);

  const baseNews = news.slice(0, 15);
  const displayNews = Array.from({ length: Math.max(2, Math.ceil(30 / Math.max(baseNews.length, 1))) })
    .flatMap(() => baseNews);
  const categoryCounts = (["MUSIC", "AI", "TECH", "CREATOR"] as const).map((category) => ({
    category,
    count: news.filter((item) => item.category === category).length,
    label: category === "CREATOR" ? "CREATOR ECONOMY" : `${category} NEWS`,
  }));

  useEffect(() => {
    if (paused || !loaded || !displayNews.length) return;
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const start = performance.now();
    const initial = el.scrollTop;
    const loop = () => {
      if (!el) return;
      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
      const elapsed = performance.now() - start;
      const next = (initial + elapsed * 0.02) % maxScroll;
      el.scrollTop = next;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [paused, loaded, displayNews.length]);

  return (
    <div className="panel-elevated relative overflow-hidden flex flex-col h-[400px] grain">
      <div className="absolute -top-16 -left-16 w-40 h-40 bg-violet/5 rounded-full blur-[60px] pointer-events-none" />

      <div className="px-5 py-3.5 flex items-center justify-between relative z-10 border-b border-edge">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-violet shadow-[0_0_6px_rgba(155,81,224,0.5)] animate-pulseDot" />
          <span className="label text-xs">
            <Glossary term="News Feed" def="Algorithmic curation of music industry and financial market news affecting your assets." category="financial">
              Music + Creator Intel
            </Glossary>
          </span>
        </div>
        <span className="text-[11px] text-mute num bg-white/[0.055] px-2 py-0.5 rounded-full border border-edge font-bold uppercase tracking-widest">{news.length} stories</span>
      </div>

      <div className="relative z-10 flex gap-1.5 overflow-x-auto border-b border-edge px-5 py-2 no-scrollbar">
        {categoryCounts.map((item) => (
          <span key={item.category} className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${CAT_STYLE[item.category] ?? ""}`}>
            {item.label} · {loaded ? item.count : "..."}
          </span>
        ))}
      </div>

      {!loaded ? (
        <div className="px-5 py-10 text-center relative z-10">
          <div className="text-xs text-mute uppercase tracking-widest animate-pulse font-bold">Scanning news sources…</div>
        </div>
      ) : !news.length ? (
        <div className="px-5 py-10 text-center relative z-10">
          <div className="text-sm text-mute mb-1 font-bold">No intelligence available</div>
          <div className="text-[11px] text-mute">Check back later for market updates.</div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto relative z-10 group bg-transparent no-scrollbar"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <ul className="min-h-full divide-y divide-white/[0.06]">
            {displayNews.map((item, i) => (
              <li
                key={`${item.id}-${i}`}
                className="hover:bg-white/[0.06] transition-all"
              >
                <a href={item.link} target="_blank" rel="noreferrer" className="flex items-start gap-3 px-5 py-3">
                  <div className="w-16 shrink-0">
                    <span className={`chip w-full justify-center text-[11px] ${CAT_STYLE[item.category] ?? ""}`}>
                      {item.category}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold leading-snug text-ink hover:text-neon transition tracking-tight break-words line-clamp-3">{cleanNewsText(item.title)}</div>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-mute uppercase tracking-widest font-bold">
                      <span className="max-w-[150px] truncate">{item.source}</span>
                      <span className="opacity-30">·</span>
                      <span className="num">{relTime(item.pubDate)}</span>
                    </div>
                  </div>
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-edge bg-black/30 shadow-sm">
                    <img src={item.thumbnail || categoryImage(item.category)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
