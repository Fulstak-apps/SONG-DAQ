# Song DAQ — Decentralized Audio Quotient

A stock market for songs. Each track is an SPL token on Solana, priced by a
bonding curve whose floor scales with real Audius / Open Audio Protocol
streaming traction. Holders earn a pro-rata share of streaming royalty
inflows.

```
Song → Token → Market Price → Revenue Stream → Royalty Distribution
```

## Stack

| Layer        | Tech                                                          |
| ------------ | ------------------------------------------------------------- |
| Frontend     | Next.js 14 App Router · Tailwind · Framer Motion · Recharts   |
| State        | Zustand (persisted session)                                   |
| Wallets      | Phantom · Solflare · Backpack · MetaMask · Coinbase · WalletConnect |
| Backend      | Next API routes · Prisma · PostgreSQL · Redis (cache + pub/sub) |
| Music        | Audius / Open Audio Protocol public discovery API             |
| Blockchain   | Solana · SPL Token · Anchor (`song-token`, `royalty-vault`, `trading-pool`) |

## Quick start

```bash
# 1) Install
npm install

# 2) Configure
cp .env.example .env
#   Fill DATABASE_URL (Postgres or Supabase), optionally REDIS_URL,
#   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, SOLANA_PAYER_SECRET.

# 3) Database
npx prisma migrate dev --name init
npx prisma generate
npm run prisma:seed   # imports a few Audius trending tracks as demo listings

# 4) Run
npm run dev           # http://localhost:3000
```

Without `SOLANA_PAYER_SECRET` set, the API generates deterministic mock
mint addresses so the entire UX works offline. Set it (a base58 devnet
secret key) to mint real SPL tokens on devnet.

## How pricing works

Linear bonding curve, shared geometry across every song:

```
price(s)  = basePrice + slope · circulating
reserve(s) = basePrice · s + ½ · slope · s²
```

Each song's `performance` multiplier (computed from streams, engagement,
volume, and viral velocity — `src/lib/pricing.ts`) scales the effective
price. Buying / selling along the curve uses the closed-form integral
in `src/lib/bondingCurve.ts`, so there's no oracle round-trip and quotes
include exact slippage.

## Royalty model

```
50% → artist
30% → token holders (pro-rata)
20% → liquidity / treasury
```

`royaltyShareBps` (≤ 5000) lets each artist tune the holder share at
launch; the treasury bucket absorbs whatever the artist didn't allocate.
Off-chain logic in `src/lib/royalty.ts` mirrors the on-chain
`royalty-vault` program, so you can validate splits before deploying to
devnet.

## Anchor programs (`anchor/`)

| Program        | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `song-token`   | Initializes a song registry account + SPL mint owned by a PDA.   |
| `trading-pool` | Bonding-curve buy/sell, fee, slippage, performance multiplier.   |
| `royalty-vault`| Splits incoming SOL royalties; holders claim against `acc_per_token`. |

Build & deploy:

```bash
cd anchor
anchor build
anchor deploy --provider.cluster devnet
```

After deploy, replace the placeholder program IDs in `Anchor.toml` and
each `declare_id!` with the keypair-derived addresses Anchor prints.

## Testing the flow

1. **Connect** any of the 6 supported wallets (top right).
2. **Launch** — head to `/artist`, pick an Audius track, click "Launch
   token". A new `$SONG-NNN` ticker appears on the market dashboard.
3. **Trade** — open the song page, buy or sell against the bonding
   curve. Quote, slippage, and price impact preview live.
4. **Earn royalties** — from `/artist`, click "Distribute 0.5 SOL" on
   any of your launches to simulate a payout. Holders see it land on
   the `/portfolio` page.

## Deployment

- **Vercel** — `vercel --prod`. Set the same env vars in the Vercel
  project. Postgres works with Supabase / Neon. Redis is optional —
  pricing falls back to no-cache mode if `REDIS_URL` isn't set.
- **Solana devnet** — see `anchor/` build steps above. Update
  `NEXT_PUBLIC_SOLANA_NETWORK` and `NEXT_PUBLIC_SOLANA_RPC` to point at
  the cluster you've deployed against.

## Repo layout

```
src/
  app/
    page.tsx                 ← market dashboard
    song/[id]/page.tsx       ← trading page
    artist/page.tsx          ← launch + royalty simulator
    portfolio/page.tsx       ← holdings + PnL + payouts
    api/
      songs/                 ← list + create
      songs/[id]/             ← detail + chart points
      trade/                  ← quote (GET) + execute (POST)
      audius/search/          ← search / trending
      portfolio/              ← per-wallet positions
      royalty/                ← royalty distribution
      feed/                   ← live event stream
      price/[id]/             ← refreshed price + candles
  components/
    Navbar, WalletButton, MarketTicker, PriceChart,
    TradePanel, TradeFeed, SongCard, Sparkline
  lib/
    audius.ts                ← discovery node client
    bondingCurve.ts          ← buy/sell/quote math
    pricing.ts               ← performance multiplier
    royalty.ts               ← off-chain split simulator
    wallet.ts                ← multi-chain connector
    solana.ts                ← RPC + (devnet) mint creation
    db.ts · redis.ts         ← infra
prisma/schema.prisma
anchor/programs/{song-token, royalty-vault, trading-pool}/
```

## License

MIT.
