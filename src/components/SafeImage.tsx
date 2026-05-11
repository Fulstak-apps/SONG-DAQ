"use client";
import Image, { ImageProps } from "next/image";
import { useState } from "react";

/**
 * Image that gracefully degrades to an initials placeholder when the
 * remote URL fails (Audius CDN nodes rotate, sometimes return 404/CORS).
 *
 * - If `fill` is set, placeholder absolutely fills the container.
 * - Otherwise, placeholder is an inline-block sized to width/height.
 */
export function SafeImage({
  src,
  alt,
  fallback,
  className,
  ...rest
}: Omit<ImageProps, "src"> & { src?: string | null; fallback?: string }) {
  const [errored, setErrored] = useState(false);
  const safeSrc = typeof src === "string" && src.trim() ? src.trim() : null;
  const initial = (fallback ?? alt ?? "?").trim().charAt(0).toUpperCase() || "?";

  if (!safeSrc || errored) {
    const fillStyle = (rest as any).fill ? "absolute inset-0" : "inline-grid";
    const w = (rest as any).width;
    const h = (rest as any).height;
    return (
      <div
        aria-label={alt}
        style={!(rest as any).fill && (w || h) ? { width: w, height: h } : undefined}
        className={`${fillStyle} place-items-center bg-gradient-to-br from-neon/15 to-violet/15 text-ink font-mono text-sm rounded ${className ?? ""}`}
      >
        {initial}
      </div>
    );
  }
  return (
    <Image
      {...rest}
      src={safeSrc}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      unoptimized
    />
  );
}
