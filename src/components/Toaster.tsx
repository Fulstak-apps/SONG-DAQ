"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useToasts } from "@/lib/toast";

const ICON: Record<string, string> = {
  success: "✓",
  error: "!",
  info: "i",
};

const COLORS: Record<string, string> = {
  success: "border-neon/50 bg-panel text-neon",
  error: "border-red/50 bg-panel text-red",
  info: "border-violet/50 bg-panel text-violet",
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[9999] flex max-w-[calc(100vw-1.5rem)] flex-col gap-2 pointer-events-none sm:left-auto sm:right-4 sm:top-4 sm:w-[min(420px,90vw)]">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 24, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            className={`pointer-events-auto w-full overflow-hidden rounded-2xl border p-3 flex items-start gap-3 bg-panel text-ink shadow-lg backdrop-blur-2xl ${COLORS[t.kind]}`}
            onClick={() => dismiss(t.id)}
          >
            <span className="grid place-items-center w-6 h-6 rounded-full bg-white/10 border border-current font-bold text-sm shrink-0">
              {ICON[t.kind]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-ink break-words">{t.title}</div>
              {t.body && <div className="text-xs text-mute mt-0.5 leading-snug break-words">{t.body}</div>}
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
