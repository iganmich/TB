# pionex-trading-bot

Personal Pionex trading bot with web dashboard. Strategy: Buy the Dip + Trailing Stop on MON_USDT.

## Strategy
- Position size: $1,000 USDT
- Dip trigger: 3% drop from reference price (local high)
- Trailing stop: 3% below peak price after entry
- State machine: WATCHING → BUYING → HOLDING → SELLING → WATCHING

## Architecture
- **Backend:** FastAPI (Python) + APScheduler bot worker → Coolify/Hetzner
- **Frontend:** Next.js + Tailwind + Recharts → Vercel (new account)
- **Database:** Supabase (existing project, tables prefixed `trading_`)
- **Exchange:** Pionex REST API (`https://api.pionex.com`)

## Infrastructure (fully isolated from AIMS)
- GitHub: `iganmich/pionex-trading-bot` (private, default SSH `git@github.com`)
- Vercel: New account linked to iganmich GitHub
- Supabase: Existing project, `trading_` prefixed tables
- Backend deploy: Coolify on Hetzner

## Security Model
- Pionex API keys: backend env vars ONLY
- Supabase service_role key: backend env vars ONLY
- Frontend → Backend: `DASHBOARD_API_KEY` via server-side Next.js API routes
- Browser NEVER calls Pionex or Supabase directly
- CORS locked to Vercel frontend domain
- RLS enabled, service_role only

## Git
- Author: `iganmich <iganmich@users.noreply.github.com>`
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`)

## Pionex API Reference
- Auth: `PIONEX-KEY` header + `PIONEX-SIGNATURE` (HMAC SHA256)
- Signature: `METHOD + PATH?sorted_params [+ body for POST/DELETE]` → HMAC SHA256 hex
- Rate limit: 10 req/sec per IP, 429 → 60s ban
- Key endpoints:
  - `GET /api/v1/market/tickers?symbol=MON_USDT` (public, weight 1)
  - `GET /api/v1/account/balances` (private, weight 1)
  - `POST /api/v1/trade/order` (trade, weight 1) — market buy uses `amount` (USDT), sell uses `size`
  - `GET /api/v1/trade/order?orderId=X` (read, weight 1)
  - `GET /api/v1/trade/openOrders?symbol=X` (read, weight 5)
  - `GET /api/v1/trade/allOrders?symbol=X` (read, weight 5)
  - `DELETE /api/v1/trade/order` (trade, weight 1) — body: `{symbol, orderId}`
  - `GET /api/v1/common/symbols` (public, weight 5) — min order sizes, precision

## Backend Structure
```
backend/
├── main.py              # FastAPI app + lifespan (scheduler start/stop)
├── bot.py               # State machine: WATCHING → BUYING → HOLDING → SELLING
├── scheduler.py         # APScheduler AsyncIOScheduler (in-process, max_instances=1)
├── pionex_client.py     # Pionex API wrapper + HMAC SHA256 auth
├── models.py            # Pydantic v2 models
├── db.py                # Supabase client (service_role key)
└── config.py            # pydantic-settings BaseSettings
```

## Frontend Structure
```
frontend/
├── app/
│   ├── page.tsx           # Command Center (overview dashboard)
│   ├── bot/page.tsx       # Bot control + state machine viz
│   ├── trades/page.tsx    # Trade history + equity curve
│   ├── chart/page.tsx     # Price terminal (Recharts)
│   ├── config/page.tsx    # Bot settings form
│   └── api/               # Server-side proxy routes (hold API key)
├── components/
└── lib/api.ts             # Client fetch wrapper
```

## Frontend Design: "Terminal Luxe"
- Theme: Deep black (#0a0a0f), electric cyan (#00e5ff), amber (#ffb300) profit, rose (#ff1744) loss
- Typography: JetBrains Mono (data), Satoshi/Outfit (headings)
- Signature: digit-flip animations, glowing chart fills, pulsing state pipeline
- Layout: 60px icon nav rail (expand on hover), top status bar, grid background

## Implementation Status
- [x] Project scaffold + GitHub repo (iganmich/TB)
- [x] Supabase schema (6 tables, RLS enabled)
- [x] Backend: pionex_client, db, models, bot, scheduler, main (FastAPI + APScheduler)
- [x] Frontend: Terminal Luxe dashboard (5 pages + server-side proxy routes)
- [x] Backend deployed: https://tb.xamadu.com (Coolify on Hetzner)
- [x] Frontend deployed: https://tb-khaki.vercel.app (Vercel Hobby, iganmich account)
- [x] CORS locked to Vercel domain

## Deployment Notes
- **Backend**: Coolify project "Pionex Trading Bot", Dockerfile-based. Critical: set "Ports Exposes" to `8000` in Configuration → General (defaults to 3000 → 502).
- **Frontend**: Vercel project `tb`, Root Directory = `frontend`, Framework Preset = **Next.js** (auto-detect picked "Standard" which breaks routing — must manually set).
- **Env vars (Vercel)**: `BACKEND_URL=https://tb.xamadu.com`, `DASHBOARD_API_KEY=<key>`
- **Env vars (Coolify)**: `CORS_ORIGINS=https://tb-khaki.vercel.app,http://localhost:3000`
- **Cloudflare**: SSL mode must be **Full** for tb.xamadu.com (not Flexible) to avoid redirect loops.

## Full Plan
See `docs/PLAN.md` for the detailed implementation plan.
