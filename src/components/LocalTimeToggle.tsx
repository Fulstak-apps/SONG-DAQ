"use client";
import { useEffect, useState } from "react";

export function LocalTimeToggle() {
  const [now, setNow] = useState<Date | null>(null);
  const [hour12, setHour12] = useState(true);
  const timeZone = "America/Los_Angeles";

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const label = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12,
      }).format(now)
    : "--:--:--";

  return (
    <button
      type="button"
      onClick={() => setHour12((v) => !v)}
      className="rounded-lg border border-edge bg-panel px-3 py-2 text-[10px] uppercase tracking-widest font-black text-mute hover:text-ink hover:border-neon/30 transition"
      title="Toggle 12/24-hour Los Angeles time"
    >
      Los Angeles {label}
    </button>
  );
}
