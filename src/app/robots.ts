import type { MetadataRoute } from "next";
import { getSiteOrigin, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const host = getSiteOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/market", "/coin/", "/artist/", "/how-it-works", "/faq", "/social"],
        disallow: ["/admin", "/api", "/portfolio", "/audius/callback"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host,
  };
}
