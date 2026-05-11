import type { Metadata } from "next";
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
  title: "SONG·DAQ — Institutional Music Exchange",
  description:
    "A Solana-based song coin platform for launch liquidity, royalty transparency, and Paper Mode trading.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable} dark`}>
      <body className="min-h-screen font-sans antialiased bg-bg text-ink selection:bg-neon/20 selection:text-ink">
        <ThemeProvider>
          <Navbar />
          <MarketTicker />
          <main className="max-w-[1440px] mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 relative">
            {/* Ambient page glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-b from-neon/5 to-transparent pointer-events-none rounded-full blur-3xl" />
            {children}
          </main>
          <footer className="max-w-[1440px] mx-auto px-3 sm:px-4 md:px-6 pt-10 md:pt-16 pb-28 relative z-10">
            <div className="border-t border-edge pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_rgba(0,229,114,0.5)] animate-pulseDot" />
                <span className="text-[10px] tracking-[0.18em] font-black text-mute">
                  SONG·DAQ <span className="text-mute mx-2">·</span> Institutional Music Exchange
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] uppercase tracking-widest font-bold text-mute">
                <Link href="/faq" className="rounded-xl border border-edge bg-white/[0.04] px-3 py-2 text-ink hover:border-neon/30 hover:text-neon transition">
                  Support
                </Link>
                <span>Solana Powered</span>
                <span className="text-mute">·</span>
                <span>On-Chain Verified</span>
                <span className="text-mute">·</span>
                <span>Bloomberg × Apple</span>
                <LocalTimeToggle />
              </div>
            </div>
          </footer>
          <Toaster />
          <CommandPalette />
          <HiddenAdminAccess />
          <PaperModeFrame />
          <AudiusAutoShuffle />
          <GlobalPlayer />
        </ThemeProvider>
      </body>
    </html>
  );
}
