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
  category: "MUSIC" | "TECH" | "AI" | "CREATOR" | "TRENDING";
  thumbnail?: string;
}

const FILTERS = ["ALL", "MUSIC", "AI", "TECH", "CREATOR", "TRENDING"] as const;
type Filter = typeof FILTERS[number];

const badge: Record<NewsStory["category"], string> = {
  MUSIC: "bg-violet/10 text-violet border-violet/20",
  TECH: "bg-cyan/10 text-cyan border-cyan/20",
  AI: "bg-gold/10 text-gold border-gold/20",
  CREATOR: "bg-neon/10 text-neon border-neon/20",
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

function cleanIntelText(value: string) {
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
    .replace(/\s*[|•·-]\s*(Pitchfork|Billboard|Music Business Worldwide|Hypebot|TechCrunch|The Verge|WIRED|Ars Technica|VentureBeat|AI News|Google News)$/i, "")
    .replace(/[�]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function IntelFallback({ story }: { story: NewsStory }) {
  const initial = (story.source || story.category || "S").slice(0, 1).toUpperCase();
  return (
    <div className={`relative grid h-full w-full place-items-center overflow-hidden ${
      story.category === "MUSIC" ? "bg-[radial-gradient(circle_at_30%_20%,rgba(155,81,224,0.5),transparent_34%),linear-gradient(135deg,rgba(155,81,224,0.36),rgba(0,0,0,0.94))]"
        : story.category === "TECH" ? "bg-[radial-gradient(circle_at_32%_18%,rgba(0,212,255,0.42),transparent_34%),linear-gradient(135deg,rgba(0,212,255,0.28),rgba(0,0,0,0.94))]"
          : story.category === "AI" ? "bg-[radial-gradient(circle_at_34%_18%,rgba(255,207,92,0.44),transparent_34%),linear-gradient(135deg,rgba(255,207,92,0.25),rgba(0,0,0,0.94))]"
            : story.category === "CREATOR" ? "bg-[radial-gradient(circle_at_32%_18%,rgba(212,255,0,0.34),transparent_34%),linear-gradient(135deg,rgba(212,255,0,0.18),rgba(0,0,0,0.94))]"
              : "bg-[radial-gradient(circle_at_32%_18%,rgba(212,255,0,0.34),transparent_34%),linear-gradient(135deg,rgba(212,255,0,0.2),rgba(0,0,0,0.94))]"
    }`}>
      <div className="absolute inset-0 opacity-30 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.12)_45%,transparent_52%)]" />
      <div className="relative grid h-20 w-20 place-items-center rounded-2xl border border-white/10 bg-black/30 font-mono text-3xl font-black text-white/75 shadow-depth">
        {initial}
      </div>
      <div className="absolute bottom-4 left-4 right-4 text-center text-[9px] uppercase tracking-[0.24em] font-black text-white/45">{story.source}</div>
    </div>
  );
}

function IntelImage({ src, alt, variant, story }: { src?: string; alt: string; variant: "lead" | "wide" | "tall" | "normal"; story: NewsStory }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) return <IntelFallback story={story} />;

  return (
    <div className="relative h-full w-full overflow-hidden bg-panel2">
      <img src={src} alt="" aria-hidden loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-35" />
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative grid h-full w-full place-items-center p-3 md:p-4">
        <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="max-h-full max-w-full rounded-xl object-contain object-center opacity-95 shadow-[0_20px_50px_rgba(0,0,0,0.34)] transition duration-700 group-hover:scale-[1.01]" />
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
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-gradient-hero">Music x Creator x AI Radar</h1>
          <p className="text-mute text-sm mt-2 max-w-2xl">
            Live music industry, creator economy, technology, AI, and worldwide trending signals from real news feeds.
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
        <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-auto gap-3">
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
    variant === "lead" ? "md:col-span-2 md:row-span-2 min-h-[540px]" :
    variant === "wide" ? "md:col-span-2 min-h-[430px]" :
    variant === "tall" ? "md:row-span-2 min-h-[560px]" :
    "min-h-[420px]";
  const titleSize = variant === "lead" ? "text-xl sm:text-2xl md:text-3xl" : variant === "wide" ? "text-lg sm:text-xl md:text-2xl" : "text-base sm:text-lg";
  const img = story.thumbnail;
  const title = cleanIntelText(story.title);
  const snippet = cleanIntelText(story.contentSnippet || "");
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
      className={`group panel panel-hover p-0 overflow-hidden intel-drift flex flex-col ${className}`}
      style={driftStyle}
    >
      <div className={`relative overflow-hidden bg-panel2 border-b border-edge ${
        variant === "lead" ? "h-72 md:h-80" : variant === "tall" ? "h-72" : "h-60"
      }`}>
        <IntelImage src={img} alt={title} variant={variant} story={story} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-pure-black/45 to-transparent pointer-events-none" />
      </div>
      <div className="relative flex flex-1 flex-col p-4 bg-panel">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[9px] px-2 py-1 rounded-md uppercase font-black tracking-widest border ${badge[story.category]}`}>
            {story.category}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-mute font-bold truncate">{story.source}</span>
          <ExternalLink size={12} className="ml-auto text-mute opacity-0 group-hover:opacity-100 transition" />
        </div>
        <h2 className={`${titleSize} font-black leading-[1.12] tracking-tight text-ink group-hover:text-neon transition break-words`}>
          {title}
        </h2>
        {variant !== "normal" && snippet && (
          <p className="mt-3 text-sm text-mute break-words line-clamp-4 max-w-2xl">{snippet}</p>
        )}
        <div className="mt-auto pt-4 text-[10px] uppercase tracking-widest text-mute font-bold">
          {dateLabel(story.pubDate)}
        </div>
      </div>
    </motion.a>
  );
}
