"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

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

const FILTERS = ["ALL", "MUSIC", "TECH", "TRENDING"] as const;
type Filter = typeof FILTERS[number];

const badge: Record<NewsStory["category"], string> = {
  MUSIC: "bg-violet/10 text-violet border-violet/20",
  TECH: "bg-cyan/10 text-cyan border-cyan/20",
  TRENDING: "bg-neon/10 text-neon border-neon/20",
};

function dateLabel(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

function normalizedImage(src?: string) {
  if (!src) return "";
  return src.replace(/([?&])(width|w|height|h)=\d+/gi, "").trim();
}

function IntelFallback({ story }: { story: NewsStory }) {
  const initial = (story.source || story.category || "S").slice(0, 1).toUpperCase();
  return (
    <div className={`grid h-full w-full place-items-center ${
      story.category === "MUSIC" ? "bg-[radial-gradient(circle_at_30%_20%,rgba(155,81,224,0.5),transparent_34%),linear-gradient(135deg,rgba(155,81,224,0.36),rgba(0,0,0,0.94))]"
        : story.category === "TECH" ? "bg-[radial-gradient(circle_at_32%_18%,rgba(0,212,255,0.42),transparent_34%),linear-gradient(135deg,rgba(0,212,255,0.28),rgba(0,0,0,0.94))]"
          : "bg-[radial-gradient(circle_at_32%_18%,rgba(212,255,0,0.34),transparent_34%),linear-gradient(135deg,rgba(212,255,0,0.2),rgba(0,0,0,0.94))]"
    }`}>
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-black/30 font-mono text-2xl font-black text-white/70 shadow-depth">
        {initial}
      </div>
    </div>
  );
}

function IntelImage({ src, alt, variant, story }: { src?: string; alt: string; variant: "lead" | "wide" | "tall" | "normal"; story: NewsStory }) {
  const [mode, setMode] = useState<"cover" | "contain">("cover");
  const [broken, setBroken] = useState(false);

  if (!src || broken) return <IntelFallback story={story} />;

  return (
    <div className={`relative h-full w-full bg-panel2 ${mode === "contain" ? "p-2.5 md:p-3" : ""}`}>
      <div className={`relative h-full w-full overflow-hidden ${mode === "contain" ? "grid place-items-center rounded-xl border border-white/8 bg-black/20" : ""}`}>
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const img = e.currentTarget;
            const width = img.naturalWidth || 0;
            const height = img.naturalHeight || 0;
            const isLeadLike = variant === "lead" || variant === "wide" || variant === "tall";
            const tooSmall = isLeadLike ? width < 900 || height < 700 : width < 520 || height < 360;
            const weakAspect = width > 0 && height > 0 && (width / height > 2.4 || width / height < 0.55);
            setMode(tooSmall || weakAspect ? "contain" : "cover");
          }}
          onError={() => setBroken(true)}
          className={mode === "contain"
            ? "max-h-full max-w-full h-auto w-auto object-contain object-center opacity-95 transition duration-700"
            : "h-full w-full object-cover object-center opacity-95 group-hover:scale-[1.015] transition duration-700"}
        />
      </div>
    </div>
  );
}

export default function SocialPage() {
  const [news, setNews] = useState<NewsStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/news", { cache: "no-store" });
        const j = await r.json();
        if (alive) setNews(j.news || []);
      } catch (e) {
        console.error("Failed to load news", e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    const i = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(i); };
  }, []);

  const filtered = useMemo(() => {
    const base = filter === "ALL" ? news : news.filter((n) => n.category === filter);
    const seen = new Set<string>();
    return base.map((story) => {
      const key = normalizedImage(story.thumbnail);
      if (!key) return story;
      if (seen.has(key)) return { ...story, thumbnail: undefined };
      seen.add(key);
      return story;
    });
  }, [filter, news]);
  const lead = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-mute mb-2">Intel</div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-gradient-hero">Music x Tech Radar</h1>
          <p className="text-mute text-sm mt-2 max-w-2xl">
            Live music, technology, and worldwide trending signals from real news feeds.
          </p>
        </div>
        <div className="flex max-w-full bg-panel border border-edge rounded-xl p-1 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 sm:px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest font-black transition active:scale-95 ${
                filter === f ? "bg-neon/15 text-neon border border-neon/25" : "text-mute hover:text-white hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={`panel animate-pulse bg-white/[0.03] ${i === 0 ? "md:col-span-2 md:row-span-2 h-96" : "h-56"}`} />
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="panel p-12 text-center text-mute">
          <div className="font-bold mb-1">No stories found</div>
          <div className="text-sm">Try a different category filter or check back soon.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[340px] sm:auto-rows-[300px] md:auto-rows-[280px] gap-3">
          {lead && <StoryCard story={lead} variant="lead" />}
          {rest.map((story, i) => (
            <StoryCard
              key={story.id}
              story={story}
              variant={i % 7 === 2 ? "wide" : i % 7 === 5 ? "tall" : "normal"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StoryCard({ story, variant }: { story: NewsStory; variant: "lead" | "wide" | "tall" | "normal" }) {
  const className =
    variant === "lead" ? "md:col-span-2 md:row-span-2" :
    variant === "wide" ? "md:col-span-2" :
    variant === "tall" ? "md:row-span-2" :
    "";
  const titleSize = variant === "lead" ? "text-xl sm:text-2xl md:text-4xl" : variant === "wide" ? "text-lg sm:text-xl md:text-2xl" : "text-base sm:text-lg";
  const img = story.thumbnail;
  const seed = story.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const driftStyle = {
    "--drift-x": `${(seed % 9) - 4}px`,
    "--drift-y": `${((seed * 3) % 9) - 4}px`,
    "--drift-rotate": `${((seed % 5) - 2) * 0.35}deg`,
    "--drift-scale": `${1 + ((seed % 4) + 1) / 1000}`,
    "--drift-duration": `${18 + (seed % 9)}s`,
  } as CSSProperties;

  return (
    <motion.a
      href={story.link}
      target="_blank"
      rel="noreferrer"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className={`group panel panel-hover p-0 overflow-hidden min-h-0 intel-drift flex flex-col ${className}`}
      style={driftStyle}
    >
      <div className={`relative overflow-hidden bg-panel2 border-b border-edge ${
        variant === "lead" ? "h-[56%]" : variant === "tall" ? "h-[62%]" : "h-[55%]"
      }`}>
        <IntelImage src={img} alt={story.title} variant={variant} story={story} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-pure-black/45 to-transparent pointer-events-none" />
      </div>
      <div className="relative flex-1 min-h-0 p-4 bg-panel">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[9px] px-2 py-1 rounded-md uppercase font-black tracking-widest border ${badge[story.category]}`}>
            {story.category}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-mute font-bold truncate">{story.source}</span>
          <ExternalLink size={12} className="ml-auto text-mute opacity-0 group-hover:opacity-100 transition" />
        </div>
        <h2 className={`${titleSize} font-black leading-[1.05] tracking-tight text-ink group-hover:text-neon transition break-words ${variant === "normal" ? "line-clamp-3" : variant === "lead" ? "line-clamp-6" : "line-clamp-5"}`}>
          {story.title}
        </h2>
        {variant !== "normal" && story.contentSnippet && (
          <p className="mt-3 text-sm text-mute break-words line-clamp-3 max-w-2xl">{story.contentSnippet}</p>
        )}
        <div className="mt-4 text-[10px] uppercase tracking-widest text-mute font-bold">
          {dateLabel(story.pubDate)}
        </div>
      </div>
    </motion.a>
  );
}
