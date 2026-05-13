import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { MarketTicker } from "@/components/MarketTicker";
import { Toaster } from "@/components/Toaster";
import { CommandPalette } from "@/components/CommandPalette";
import { GlobalPlayer } from "@/components/GlobalPlayer";
import { LocalTimeToggle } from "@/components/LocalTimeToggle";
import { HiddenAdminAccess } from "@/components/HiddenAdminAccess";
import { PaperModeFrame } from "@/components/PaperModeFrame";
import { AudiusAutoShuffle } from "@/components/AudiusAutoShuffle";
import { InteractionFeedback } from "@/components/InteractionFeedback";
import { SITE_BRAND, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, getSiteOrigin, siteUrl } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [
    "song-daq",
    "SONG·DAQ",
    "music coins",
    "song coins",
    "artist coins",
    "Audius",
    "Open Audio Protocol",
    "Solana music marketplace",
    "music royalty marketplace",
    "music investing",
    "creator economy",
  ],
  authors: [{ name: SITE_NAME, url: getSiteOrigin() }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: getSiteOrigin(),
    siteName: SITE_BRAND,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SONG·DAQ music coin marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  category: "finance",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    alternateName: SITE_BRAND,
    url: getSiteOrigin(),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    sameAs: [
      siteUrl("/market"),
      siteUrl("/how-it-works"),
      "https://openaudio.org/",
      "https://audius.co/",
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable} dark`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased bg-bg text-ink selection:bg-neon/20 selection:text-ink">
        <ThemeProvider>
          <Navbar />
          <MarketTicker />
          <main className="app-main-safe mx-auto w-full max-w-[1680px] px-3 pt-4 sm:px-4 sm:pb-32 sm:pt-6 md:px-6 md:pb-28 md:pt-8 2xl:px-8 relative">
            {/* Ambient page glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-b from-neon/5 to-transparent pointer-events-none rounded-full blur-3xl" />
            {children}
          </main>
          <footer className="app-footer-safe mx-auto w-full max-w-[1680px] px-3 pt-10 sm:px-4 md:px-6 md:pt-16 2xl:px-8 relative z-10">
            <div className="border-t border-edge pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_rgba(0,229,114,0.5)] animate-pulseDot" />
                <span className="text-[11px] tracking-[0.18em] font-black text-mute">
                  song-daq <span className="text-mute mx-2">·</span> Institutional Music Exchange
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] uppercase tracking-widest font-bold text-mute">
                <Link href="/faq" className="rounded-xl border border-edge bg-white/[0.04] px-3 py-2 text-ink hover:border-neon/30 hover:text-neon transition">
                  Support
                </Link>
                <Link href="/how-it-works" className="rounded-xl border border-edge bg-white/[0.04] px-3 py-2 text-ink hover:border-neon/30 hover:text-neon transition">
                  How It Works
                </Link>
                <span>Solana Powered</span>
                <span className="text-mute">·</span>
                <span>On-Chain Verified</span>
                <span className="text-mute">·</span>
                <Link href="/admin/login" className="rounded-xl border border-edge bg-white/[0.04] px-3 py-2 text-ink hover:border-violet/40 hover:text-violet transition">
                  Admin
                </Link>
                <LocalTimeToggle />
              </div>
            </div>
          </footer>
          <Toaster />
          <CommandPalette />
          <HiddenAdminAccess />
          <PaperModeFrame />
          <AudiusAutoShuffle />
          <InteractionFeedback />
          <GlobalPlayer />
        </ThemeProvider>
      </body>
    </html>
  );
}
