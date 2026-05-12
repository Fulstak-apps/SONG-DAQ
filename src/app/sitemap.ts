import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicRoutes = [
    { path: "/", priority: 1 },
    { path: "/market", priority: 0.95 },
    { path: "/how-it-works", priority: 0.85 },
    { path: "/faq", priority: 0.8 },
    { path: "/artist", priority: 0.75 },
    { path: "/social", priority: 0.65 },
    { path: "/splits", priority: 0.55 },
  ];

  return publicRoutes.map((route) => ({
    url: siteUrl(route.path),
    lastModified: now,
    changeFrequency: route.path === "/market" ? "hourly" : "daily",
    priority: route.priority,
  }));
}
