import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { MarketTicker } from "@/components/MarketTicker";
import { Toaster } from "@/components/Toaster";
import { CommandPalette } from "@/components/CommandPalette";

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
    "The world's first institutional-grade exchange for tokenized music royalties. Trade on-chain. Earn on every stream. Solana-powered.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen font-sans antialiased bg-bg text-ink selection:bg-neon/20 selection:text-ink">
        <ThemeProvider>
          <Navbar />
          <MarketTicker />
          <main className="max-w-[1440px] mx-auto px-4 md:px-6 py-8 relative">
            {/* Ambient page glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-gradient-to-b from-neon/5 to-transparent pointer-events-none rounded-full blur-3xl" />
            {children}
          </main>
          <footer className="max-w-[1440px] mx-auto px-4 md:px-6 py-16 relative z-10">
            <div className="border-t border-white/[0.03] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-neon shadow-[0_0_6px_rgba(0,229,114,0.5)] animate-pulseDot" />
                <span className="text-[10px] uppercase tracking-[0.25em] font-black text-white/15">
                  Song·DAQ <span className="text-white/8 mx-2">·</span> Institutional Music Exchange
                </span>
              </div>
              <div className="flex items-center gap-6 text-[10px] uppercase tracking-widest font-bold text-white/10">
                <span>Solana Powered</span>
                <span className="text-white/5">·</span>
                <span>On-Chain Verified</span>
                <span className="text-white/5">·</span>
                <span>Bloomberg × Apple</span>
              </div>
            </div>
          </footer>
          <Toaster />
          <CommandPalette />
        </ThemeProvider>
      </body>
    </html>
  );
}
