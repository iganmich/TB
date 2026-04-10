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
- [x] Project directory created at ~/Projects/pionex-trading-bot
- [x] Git initialized with iganmich identity
- [x] VS Code workspace: ~/Projects/Xamadu/IGANMICH.code-workspace
- [ ] GitHub repo creation
- [ ] Backend scaffold (pyproject.toml, config.py, .env.example, .gitignore)
- [ ] Supabase schema (6 tables)
- [ ] pionex_client.py (HMAC auth)
- [ ] db.py (Supabase CRUD)
- [ ] models.py (Pydantic)
- [ ] bot.py (state machine)
- [ ] scheduler.py + main.py (FastAPI + APScheduler)
- [ ] Frontend scaffold
- [ ] Dashboard pages
- [ ] Deployment

## Full Plan
See `docs/PLAN.md` for the detailed implementation plan.
