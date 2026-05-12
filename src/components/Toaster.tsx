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
    <div className="toast-viewport" data-testid="toast-viewport" aria-live="polite" aria-atomic="false">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 24, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 24, scale: 0.96 }}
            className={`toast-card pointer-events-auto flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-panel text-ink shadow-lg backdrop-blur-2xl ${COLORS[t.kind]}`}
            onClick={() => dismiss(t.id)}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current bg-white/10 text-sm font-bold">
              {ICON[t.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="toast-title text-base font-black text-ink">{t.title}</div>
              {t.body && <div className="toast-body mt-0.5 text-sm leading-snug text-mute">{t.body}</div>}
            </div>
            <button
              className="toast-close grid shrink-0 place-items-center rounded-full text-sm text-mute transition hover:bg-white/10 hover:text-ink"
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
              aria-label="Dismiss"
            >×</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
