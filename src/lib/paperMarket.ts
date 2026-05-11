import type { AudiusCoin } from "./audiusCoins";

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function wave(seed: number, tick: number, speed: number, phase = 0) {
  return Math.sin(tick / speed + seed * 0.00013 + phase);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function paperMultiplier(id: string, tick = Date.now()) {
  const seed = hash(id);
  const bias = 0.010 + (seed % 13) / 2000;
  const momentum = wave(seed, tick, 7200) * 0.024;
  const micro = wave(seed, tick, 1350, 1.7) * 0.006;
  const correction = wave(seed, tick, 19_000, 4.1) < -0.82 ? -0.028 : 0;
  return clamp(1 + bias + momentum + micro + correction, 0.84, 1.32);
}

export function applyPaperMarket(coins: AudiusCoin[], tick = Date.now()): AudiusCoin[] {
  return coins.map((coin, index) => {
    const id = coin.mint || coin.ticker || String(index);
    const seed = hash(id);
    const mult = paperMultiplier(id, tick);
    const mostlyGreen = seed % 9 !== 0;
    const pulse = mostlyGreen ? Math.abs(mult - 1) : -(Math.abs(mult - 1) * 0.72);
    const basePrice = Math.max(coin.price ?? 0.00001, 0.000001);
    const price = basePrice * (1 + pulse);
    const change = (coin.priceChange24hPercent ?? 0) + pulse * 100 + (mostlyGreen ? 0.35 : -0.75);
    const volumeMult = 1.08 + Math.abs(wave(seed, tick, 2800)) * 1.9 + (seed % 5) * 0.08;
    const holderLift = Math.floor(Math.abs(wave(seed, tick, 11_000, 2.5)) * 9);
    const baseSpark = coin.sparkline?.length ? coin.sparkline : Array.from({ length: 28 }, (_, i) => basePrice * (0.985 + i * 0.0009));
    const sparkline = baseSpark.slice(-31).map((v, i) => {
      const local = 1 + wave(seed + i * 131, tick, 5100, i * 0.28) * 0.022 + (mostlyGreen ? i * 0.0008 : -i * 0.00035);
      return Math.max(0.000001, v * local);
    });
    sparkline.push(price);

    return {
      ...coin,
      price,
      priceChange24hPercent: change,
      marketCap: (coin.marketCap ?? basePrice * (coin.circulatingSupply ?? coin.totalSupply ?? 1_000_000)) * (1 + pulse),
      liquidity: Math.max(coin.liquidity ?? 0, (coin.marketCap ?? 10_000) * 0.08) * (1 + Math.abs(pulse) * 0.5),
      holder: (coin.holder ?? 0) + holderLift,
      v24h: (coin.v24h ?? 0) * volumeMult,
      v24hUSD: Math.max(coin.v24hUSD ?? 0, basePrice * 1200) * volumeMult,
      trade24h: Math.max(coin.trade24h ?? 0, 8 + (seed % 45)) + Math.floor(Math.abs(wave(seed, tick, 2300)) * 18),
      buy24h: Math.max(coin.buy24h ?? 0, 4 + (seed % 28)) + Math.floor(Math.abs(wave(seed, tick, 2600)) * 12),
      sell24h: Math.max(coin.sell24h ?? 0, 2 + (seed % 15)) + Math.floor(Math.abs(wave(seed, tick, 3900)) * 8),
      uniqueWallet24h: Math.max(coin.uniqueWallet24h ?? 0, 6 + (seed % 34)) + holderLift,
      sparkline,
    };
  });
}

export function paperTradeEvents(coins: AudiusCoin[], tick = Date.now(), count = 18) {
  const selected = coins.slice(0, Math.max(count, 1));
  return selected.map((coin, index) => {
    const seed = hash(`${coin.mint}-${index}-${Math.floor(tick / 4000)}`);
    const side = seed % 5 === 0 ? "SELL" : "BUY";
    const tokens = 12 + (seed % 420) + Math.round(Math.abs(wave(seed, tick, 1500)) * 180);
    const price = Math.max(coin.price ?? 0.001, 0.000001);
    const createdAt = new Date(tick - index * 17_000 - (seed % 7000)).toISOString();
    return {
      id: `paper-${coin.mint}-${index}-${Math.floor(tick / 4000)}`,
      kind: side,
      payload: {
        symbol: coin.ticker,
        mint: coin.mint,
        tokens,
        price,
        wallet: `paper${String(seed).slice(0, 8)}${String(hash(coin.ticker)).slice(0, 4)}`,
        volumeUsd: tokens * price,
        change: coin.priceChange24hPercent ?? 0,
      },
      createdAt,
      song: {
        symbol: coin.ticker,
        title: coin.audius_track_title || coin.name,
        artworkUrl: coin.audius_track_artwork || coin.logo_uri || null,
      },
    };
  });
}
