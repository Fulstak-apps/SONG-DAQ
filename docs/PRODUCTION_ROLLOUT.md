# Song-daq Production Rollout

This document answers one blunt question:

How do we make Song-daq work for real users on real wallets and real Solana, not just local testing?

It is written against the current codebase as of May 6, 2026.

## Current Reality

The app is partway there, but it is not yet a full public production trading system.

What is already real:

- Solana wallet connection for Phantom, Solflare, and Backpack
- Audius OAuth sign-in for artist identity
- Artist-paid SPL mint creation for Song Tokens through the connected Solana wallet
- Real Jupiter quote and swap-build integration for coin trading routes
- Launch guardrails for liquidity, wallet caps, artist allocation, risk acknowledgement, and reporting

What is not fully real yet:

- Artist Token minting is intentionally blocked in the UI
- Song token trading execution is still disabled at the local Song-daq trade route
- Liquidity locking is represented in app state, but not enforced by an on-chain lock program yet
- Public marketplace safety depends on app logic, not full on-chain enforcement
- Build still has prerender/runtime issues on several pages

## What The Code Does Today

### 1. Song Token launch is partly real

`/api/songs` creates a real SPL mint through [src/lib/solana.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/lib/solana.ts:1) and records the launch in the database through [src/app/api/songs/route.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/app/api/songs/route.ts:1).

That means:

- the mint can be real
- the artist wallet can receive minted supply
- treasury liquidity inventory can be minted

But it does **not** yet mean there is a real live public market automatically created for that token.

### 2. Artist Token launch is not live yet

The launch UI explicitly blocks artist-token minting in [src/components/CoinLauncher.tsx](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/components/CoinLauncher.tsx:96).

Right now it returns:

- wallet testing path only
- no fake Artist Token creation
- no production-ready artist-token program integration yet

### 3. Trading is only partly wired

The Jupiter route in [src/app/api/jupiter/route.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/app/api/jupiter/route.ts:1) can:

- fetch real quotes
- build real swap transactions

But the Song-daq trade route in [src/app/api/trade/route.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/app/api/trade/route.ts:1) is still intentionally disabled for execution recording.

That means the frontend can be close to a real trade flow, but the product is not yet fully closed-loop as a public production exchange.

### 4. Liquidity is required in the app, but not fully enforced on-chain

Launch requires liquidity fields in [src/app/api/songs/route.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/app/api/songs/route.ts:1):

- token amount
- pair amount
- pair asset
- lock days

The app also stores:

- `liquidityLocked`
- `liquidityLockDays`
- `liquidityHealth`

in [prisma/schema.prisma](/Users/dw/.codex/worktrees/ebe0/Song-Daq/prisma/schema.prisma:33).

That is good product architecture, but production safety requires these rules to also exist in the actual on-chain liquidity flow.

## What We Need For Real Public Launch

There are 5 categories:

1. Infrastructure
2. Real launch path
3. Real trade path
4. Safety and abuse protection
5. Production reliability

## 1. Infrastructure We Need

### Required env vars

At minimum:

```env
NEXT_PUBLIC_SOLANA_NETWORK="mainnet-beta"
NEXT_PUBLIC_SOLANA_RPC="https://your-mainnet-rpc"
NEXT_PUBLIC_AUDIUS_API_KEY="your_audius_api_key"
TREASURY_WALLET="your_protocol_treasury_wallet"
DATABASE_URL="your_production_database_url"
JUPITER_API_KEY="optional_but_recommended"
```

Render should provide a real Postgres `DATABASE_URL`. A local `file:` URL is treated as development-only and will keep the app out of public-ready status.

### Required services

- production database
- production RPC provider
- secure server secret storage
- app hosting
- error monitoring
- analytics / logs

Recommended providers:

- Database: Supabase Postgres or Neon Postgres
- RPC: Helius, QuickNode, Triton, or Alchemy
- Secrets: Vercel env, Doppler, 1Password Secrets Automation, or cloud secret manager
- Monitoring: Sentry

### Important security rule

Normal launches should not require a server payer secret. The artist wallet
signs and pays for mint creation, and the backend only verifies the
confirmed transaction. If a server payer is ever used for admin tooling, it
must never live in the frontend.

## 2. Real Launch Path We Need

To be public-ready, launch has to be atomic.

### Required final launch sequence

1. Artist connects Solana wallet
2. Artist signs in with Audius
3. Artist selects a real Audius track for a Song Token, or verified profile for an Artist Token
4. App validates:
   - Audius ownership
   - duplicate track / duplicate artist
   - moderation checks
   - artist role
   - wallet caps
   - artist allocation
   - liquidity minimum
5. App creates launch draft
6. Artist signs and pays the launch mint transaction
7. Backend verifies mint, supply, and transaction confirmation
8. Backend creates or initializes liquidity venue
9. Liquidity gets locked
10. Launch marked `LIVE` only after all steps succeed

### Current blocker

Right now the mint creation exists, but the launch is not yet a complete market-creation flow.

### What we need to implement next

- real metadata publishing for launched tokens
- real liquidity pool creation path
- liquidity lock enforcement
- fail-safe launch state machine

### Required launch states

- `DRAFT`
- `PENDING_SIGNATURE`
- `CREATING_MINT`
- `ADDING_LIQUIDITY`
- `LOCKING_LIQUIDITY`
- `VERIFYING`
- `LIVE`
- `FAILED`

## 3. Real Trade Path We Need

For anybody to buy and sell for real:

- every buy must come from the user's wallet
- every sell must come from the user's wallet
- swap transaction must be signed client-side
- backend must verify or index confirmed result

### Current status

Jupiter integration exists in [src/app/api/jupiter/route.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/app/api/jupiter/route.ts:1).

But the internal trade execution route is still disabled in [src/app/api/trade/route.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/app/api/trade/route.ts:1).

### What we need to implement next

- complete client-side wallet signing flow for swaps
- submit signed Jupiter transaction from user wallet
- confirm on-chain success
- record trade event after confirmation
- refresh holdings, activity, and charts from confirmed chain state

### Required buy flow

1. user clicks Buy
2. app fetches quote
3. app shows fees, slippage, total, warnings
4. user signs transaction
5. transaction submitted
6. transaction confirmed
7. backend indexes trade
8. portfolio updates

### Required sell flow

Same pattern as buy, but with extra checks:

- enough token balance
- sell cooldown if required
- artist vesting / artist restriction rules if seller is creator

## 4. Safety And Abuse Protection We Need

The codebase already has a good start:

- risk scoring in [src/lib/risk/calculateCoinRisk.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/lib/risk/calculateCoinRisk.ts:1)
- moderation terms in [src/lib/risk/contentModeration.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/lib/risk/contentModeration.ts:1)
- reporting flow in [src/app/api/reports/route.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/app/api/reports/route.ts:1)
- launch gatekeeping in [src/app/api/songs/route.ts](/Users/dw/.codex/worktrees/ebe0/Song-Daq/src/app/api/songs/route.ts:1)

That said, public launch needs harder enforcement.

### Must-have production protections

#### Artist verification

- verified Audius identity required for launch
- optional stronger verification tier for major artists
- duplicate artist detection
- impersonation review queue

#### Song verification

- Audius ownership check for Song Tokens
- duplicate track ID block
- copyright confirmation
- manual upload review path if introduced later

#### Liquidity safety

- minimum liquidity threshold
- lock duration requirement
- lock status surfaced publicly
- no public listing without liquidity

#### Holder concentration protection

- enforce max wallet cap
- show top holder concentration
- restrict launch sniping

#### Anti-bot / anti-wash trading

- rate limits
- abnormal volume detection
- repeated wallet-pair detection
- brand new wallet risk flagging
- suspicious volume excluded from rankings

#### Investor warnings

- not financial advice
- can go to zero
- liquidity may be limited
- royalty claims may be unverified

## 5. Production Reliability We Need

### Build and runtime stability

The app currently has unresolved build-time prerender/runtime failures on:

- `/market`
- `/social`
- `/faq`
- `/artist`
- `/audius/callback`

This must be fixed before public launch.

### Why this matters

If build output is unstable, deployment reliability is unstable.

### Immediate production hardening tasks

- fix Next.js prerender/runtime failures
- add route-level error boundaries where needed
- audit client-only components in App Router pages
- add monitoring for API failures and wallet failures
- add retry logic for external data sources

## Minimum Viable Public Launch

If the goal is to get to a real usable v1 as fast as possible, the safest path is:

### Phase 1: Real Song Token beta

Ship only:

- Song Tokens
- Solana wallets
- Audius artist login
- real SPL mint creation
- real user-signed buy flow
- real user-signed sell flow
- clear risk panel

Do **not** ship yet:

- Artist Tokens
- advanced royalty ownership claims
- fake live ranking logic
- unlocked liquidity launches

### Phase 2: Liquidity and ranking hardening

- real liquidity creation flow
- real liquidity lock enforcement
- trust-weighted rankings
- wash-trade detection
- suspicious-launch moderation tools

### Phase 3: Artist Token release

Only release Artist Tokens after:

- verified artist-token contract flow exists
- creation path is distinct from song-token path
- liquidity rules match song-token safety
- artist allocation and vesting rules are enforced

## What You Need To Do Right Now

If the goal is "make this real for anyone," here is the actual order:

### This week

1. Fix build/prerender failures
2. Move from local sqlite to production Postgres
3. Set mainnet RPC provider
4. Store payer secret in secure server env
5. Finish real wallet-signed buy flow
6. Finish confirmed trade indexing
7. Keep public launch limited to Song Tokens only

### Next

1. Implement real liquidity creation and locking
2. Add launch state machine
3. Add stronger admin moderation tools
4. Add monitoring and alerting
5. Add production terms, risk disclosures, and support flows

### After that

1. Ship Artist Tokens
2. Ship advanced royalty-linked features
3. Ship stronger trust-based rankings and detection systems

## Honest Bottom Line

To make Song-daq work for anybody:

- users must sign with their own wallets
- mints must be real
- liquidity must be real
- locks must be real
- trades must be user-signed and chain-confirmed
- moderation and abuse controls must exist both in product logic and backend logic

Right now the app is a strong production-style frontend with some real Solana and Audius wiring, but it still needs:

- a fully completed public trading path
- a real liquidity venue and lock flow
- production infrastructure
- build stability

## Recommended Product Decision

The fastest honest path is:

launch public beta with **Song Tokens only** on Solana mainnet,
finish wallet-signed trading,
enforce real liquidity,
and hold Artist Tokens until the artist-token program and safety model are complete.
