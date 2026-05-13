"use client";

import { useEffect } from "react";

const INTERACTIVE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "[role='button']:not([aria-disabled='true'])",
  "summary",
  "input[type='button']:not(:disabled)",
  "input[type='submit']:not(:disabled)",
].join(",");

export function InteractionFeedback() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const element = target.closest<HTMLElement>(INTERACTIVE_SELECTOR);
      if (!element) return;
      element.dataset.tapActive = "true";
      window.setTimeout(() => {
        delete element.dataset.tapActive;
      }, 180);
      if (window.matchMedia("(pointer: coarse)").matches && "vibrate" in navigator) {
        navigator.vibrate?.(8);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, []);

  return null;
}
