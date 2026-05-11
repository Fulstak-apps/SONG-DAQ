# Song-daq — Decentralized Audio Quotient

A stock market for Song Tokens and Artist Tokens. Song Token launches create real
SPL tokens on Solana from verified Audius / Open Audio Protocol identity.
Trading uses executable Solana/Jupiter routes when liquidity exists.

```
Song → Token → Market Price → Revenue Stream → Royalty Distribution
```

## Stack

| Layer        | Tech                                                          |
| ------------ | ------------------------------------------------------------- |
| Frontend     | Next.js 14 App Router · Tailwind · Framer Motion · Recharts   |
| State        | Zustand (persisted session)                                   |
| Wallets      | Phantom · Solflare · Backpack                                      |
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
#   TREASURY_WALLET, JUPITER_API_KEY.

# 3) Database
npx prisma migrate dev --name init
npx prisma generate
npm run prisma:seed   # optional local catalog bootstrap from live Audius tracks

# 4) Run
npm run dev           # http://localhost:3000
```

Normal Song Token launches are paid by the connected artist wallet. The
artist signs the mint transaction, pays Solana rent/network fees, and the
API verifies the confirmed transaction before listing the token. Song-daq
does not create off-chain placeholder mints.

## Real Blockchain Setup

To launch a real Song Token locally on devnet:

1. Set `NEXT_PUBLIC_SOLANA_NETWORK=devnet`.
2. Set `NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com` or a paid devnet RPC.
3. Set `TREASURY_WALLET` to the reserve wallet that receives launch liquidity inventory.
4. Connect a funded Solana wallet in the app, sign in with Audius, pick one of your Audius tracks, and launch from `/artist`.
5. The artist wallet signs and pays for the SPL mint transaction; the API verifies it before listing the token.

To buy/sell an existing Artist Token:

1. Use a Solana wallet supported by the app: Phantom, Solflare, or Backpack.
2. Keep `NEXT_PUBLIC_SOLANA_RPC` pointed at the same network as the token route.
3. Optionally set `JUPITER_API_KEY` for higher reliability.
4. The buy/sell modal requests a live Jupiter quote, asks the wallet to sign the swap transaction, and submits it to Solana. If Jupiter has no route/liquidity, the UI fails cleanly with “No executable route.”

To make a newly launched token buyable, it needs liquidity. Creating the
SPL mint is on-chain, but a fresh mint will not trade until a liquidity
pool/market exists or the Open Audio artist-token program is configured
to seed liquidity. The app does not fake that step.

To seed liquidity reserves inside the app:

1. Set `TREASURY_WALLET` to the Solana wallet controlled by the protocol/team treasury.
2. Sign in as an artist, open `/artist`, and complete the required launch liquidity step during token creation.
3. Enter token inventory, paired asset amount, and lock duration.
4. The launch API mints the liquidity inventory to the treasury/reserve wallet.

Liquidity is part of token creation only. Live token pages display liquidity
status and risk, but they do not expose a random post-launch “add liquidity”
button.

## Abuse Protection

Song-daq treats every launch as adversarial until verified:

- Artist identity must come from Audius sign-in and track ownership checks.
- Manual handle pasting is not accepted for launch verification.
- Duplicate verified Audius track IDs are blocked.
- Coin launch requires ownership confirmation and risk acknowledgement.
- Liquidity is required before launch; no-liquidity Song Tokens are not listed as live.
- Launches capture token liquidity amount, paired asset amount, implied price, lock period, max wallet cap, and artist allocation.
- Royalty language is shown as a “royalty-backed transparency signal” until distributor/legal verification is locked.
- Buy flow includes investor risk confirmation: price can go to zero, liquidity can be limited, royalty claims may be unverified, and this is not financial advice.
- Risk scoring flags unverified artist/song data, low liquidity, unlocked liquidity, concentrated holders, abnormal volume, volatility, and reports.
- Report flow supports impersonation, stolen song, fake royalty claim, scam, offensive content, market manipulation, and wrong metadata.
- `/admin` is the hidden operations console and requires an admin wallet role. Add trusted wallets to the server-only `ADMIN_WALLETS` env var as a comma-separated list.
- Admin can also be opened with the private shortcut `Control + Shift + A` when `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` are configured.
- The Audius profile name `Darnell Williams` reveals the Admin nav by default; add exact handles or user IDs to `ADMIN_AUDIUS_HANDLES` / `ADMIN_AUDIUS_USER_IDS` for stronger production matching.
- `/admin/reports` redirects to the operations console and uses the same admin wallet checks.
- Future smart contract enforcement must lock liquidity, enforce max wallet cap, enforce artist vesting/cooldowns, emit launch/liquidity/trade/artist-sell events, and prevent frontend-only bypasses.

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

1. **Connect** Phantom, Solflare, or Backpack (top right).
2. **Launch** — head to `/artist`, pick an Audius track, click "Launch
   token". A new `$SONG-NNN` ticker appears on the market dashboard.
3. **Trade** — open a liquid coin, buy or sell through the live
   Solana/Jupiter swap route. Quote, slippage, and price impact preview live.
4. **Earn royalties** — connect a real royalty settlement worker before
   recording payout events. The API refuses fabricated royalty inflows.

## Deployment

- **Vercel** — `vercel --prod`. Set the same env vars in the Vercel
  project. Postgres works with Supabase / Neon. Redis is optional —
  pricing falls back to no-cache mode if `REDIS_URL` isn't set.
- **Solana devnet** — see `anchor/` build steps above. Update
  `NEXT_PUBLIC_SOLANA_NETWORK` and `NEXT_PUBLIC_SOLANA_RPC` to point at
  the cluster you've deployed against.

For the full "make this real for anybody" rollout path, see
[docs/PRODUCTION_ROLLOUT.md](./docs/PRODUCTION_ROLLOUT.md).

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
    wallet.ts                ← Solana wallet connector
    solana.ts                ← RPC + (devnet) mint creation
    db.ts · redis.ts         ← infra
prisma/schema.prisma
anchor/programs/{song-token, royalty-vault, trading-pool}/
```

## License

MIT.
