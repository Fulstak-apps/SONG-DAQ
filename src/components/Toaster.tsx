"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useToasts } from "@/lib/toast";

const ICON: Record<string, string> = {
  success: "✓",
  error: "!",
  info: "i",
};

const COLORS: Record<string, string> = {
  success: "border-neon/40 bg-neon/10 text-neondim",
  error: "border-red/40 bg-red/10 text-red",
  info: "border-violet/40 bg-violet/10 text-violet",
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none w-[min(420px,90vw)]">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 24, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            className={`pointer-events-auto panel p-3 flex items-start gap-3 shadow-lg ${COLORS[t.kind]}`}
            onClick={() => dismiss(t.id)}
          >
            <span className={`grid place-items-center w-6 h-6 rounded-full bg-white/60 font-bold text-sm`}>
              {ICON[t.kind]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink">{t.title}</div>
              {t.body && <div className="text-xs text-ink/70 mt-0.5">{t.body}</div>}
            </div>
            <button
              className="text-mute hover:text-ink text-sm"
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
              aria-label="Dismiss"
            >×</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
