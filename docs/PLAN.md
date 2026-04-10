# Pionex Trading Bot — Buy the Dip + Trailing Stop

## Context

Build a personal trading bot for MON_USDT on Pionex with a web dashboard. Strategy: buy when price dips 3% from recent peak, then trail a 3% stop from the highest price after entry. Position size: $1,000 USDT per trade.

**Fully isolated from AIMS:** Separate GitHub repo under `iganmich` account, new Vercel account, existing Supabase (separate tables). No connection to AIManagementSolutions org, AIMS WordPress, or chat infrastructure. New VS Code workspace.

---

## Infrastructure

| Layer | Service | Account |
|-------|---------|---------|
| Git | `iganmich/pionex-trading-bot` | iganmich GitHub (default SSH) |
| Frontend | Next.js on Vercel | **New** Vercel account linked to iganmich |
| Backend | FastAPI on Coolify/Hetzner | Existing Hetzner server |
| Database | Supabase (PostgreSQL) | Existing Supabase project (new tables with `trading_` prefix) |
| Exchange | Pionex REST API | PIONEX-KEY + HMAC SHA256 |

---

## Security Model

**Zero secrets in frontend / browser:**
- Pionex API key + secret: backend env vars ONLY, never sent to Vercel
- Supabase service_role key: backend env vars ONLY
- Frontend → Backend auth: `DASHBOARD_API_KEY` (long random token) in server-side Next.js API routes
- Browser never calls Pionex or Supabase directly
- All backend endpoints require `Authorization: Bearer <DASHBOARD_API_KEY>`
- CORS locked to Vercel frontend domain only
- `.env` files gitignored, `.env.example` has placeholder keys only
- RLS enabled on all Supabase tables, `service_role` policy only

**Data flow:** Browser → Next.js API routes (server-side, has API key) → FastAPI backend (has Pionex + Supabase keys) → Pionex/Supabase

---

## Architecture

```
pionex-trading-bot/                    # Monorepo
├── backend/                           # FastAPI + bot worker → Coolify/Hetzner
│   ├── main.py                        # FastAPI app + lifespan (scheduler start/stop)
│   ├── bot.py                         # State machine: WATCHING → BUYING → HOLDING → SELLING
│   ├── scheduler.py                   # APScheduler AsyncIOScheduler (in-process)
│   ├── pionex_client.py               # Pionex REST API wrapper + HMAC SHA256 auth
│   ├── models.py                      # Pydantic v2 models
│   ├── db.py                          # Supabase client (service_role key)
│   └── config.py                      # pydantic-settings BaseSettings
├── frontend/                          # Next.js + Tailwind + Recharts → Vercel
│   ├── app/                           # Dashboard pages
│   ├── app/api/                       # Server-side proxy routes (hold API key)
│   └── lib/api.ts                     # Client fetch wrapper (calls own API routes)
└── pionex-trading-bot.code-workspace
```

---

## Phase 1: Project Setup

1. Create new directory outside AIMS workspace (e.g., `~/Projects/pionex-trading-bot`)
2. `git init` with iganmich as default author
3. Create GitHub repo: `iganmich/pionex-trading-bot` (private)
4. VS Code workspace file at root
5. Scaffold `/backend` with `pyproject.toml`, `.env.example`
6. Scaffold `/frontend` with `create-next-app`, Tailwind, Recharts
7. Root `.gitignore`: `__pycache__/`, `.env`, `.env.local`, `node_modules/`, `.next/`, `venv/`, `.vercel/`

---

## Phase 2: Supabase Schema

Six tables with `trading_` prefix in existing Supabase project. All use `service_role` key (no browser access):

| Table | Purpose |
|-------|---------|
| `trading_bot_config` | Singleton: symbol, position_size, dip_pct (0.03), trail_pct (0.03), poll_interval, enabled |
| `trading_bot_state` | Singleton: status enum (WATCHING/BUYING/HOLDING/SELLING), reference_price, peak_price, entry_price, entry_size, order IDs |
| `trading_price_history` | Time-series: symbol, price, volume, created_at (indexed) |
| `trading_orders` | Mirrors Pionex orders: pionex_order_id, client_order_id, side, type, price, size, filled_*, status |
| `trading_trades` | Round-trips: buy_order_id → sell_order_id, entry/exit price, P&L |
| `trading_bot_log` | Audit trail: level, message, JSONB data |

RLS enabled on all tables. Only `service_role` has access. `updated_at` auto-triggers.

---

## Phase 3: Backend (FastAPI) — Start Here

### 3a. `config.py` — Settings
`pydantic-settings` BaseSettings: `PIONEX_API_KEY`, `PIONEX_API_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DASHBOARD_API_KEY`, `CORS_ORIGINS`

### 3b. `db.py` — Supabase Client
Lazy-init `create_client()`. Typed helpers: `get_bot_state()`, `update_bot_state()`, `get_bot_config()`, `insert_price()`, `insert_order()`, `insert_trade()`, `log()`, etc.

### 3c. `pionex_client.py` — API Wrapper (critical)
HMAC SHA256 signature: `METHOD + PATH?sorted_params [+ body]` → hex digest.

Key methods:
- `get_ticker(symbol)` — public, no auth
- `get_balances()` — private
- `place_order(symbol, side, type, **kwargs)` — with `clientOrderId` for idempotency
- `get_order(symbol, order_id)` — poll fill status
- `cancel_order(symbol, order_id)`

Rate limit safety: max 8 req/sec, back off 60s on 429.

### 3d. `bot.py` — State Machine

```
WATCHING ──(price ≤ reference × 0.97)──→ BUYING
BUYING   ──(order filled)──────────────→ HOLDING
HOLDING  ──(price ≤ peak × 0.97)──────→ SELLING
SELLING  ──(order filled)──────────────→ WATCHING
```

**WATCHING:** Track local high as reference_price (ratchets up). When price drops 3% from reference → BUYING.
**BUYING:** Market buy with `amount=position_size` USDT. Poll order until filled. Store entry_price, set peak_price = entry_price → HOLDING.
**HOLDING:** Update peak_price when price rises. When price ≤ peak × 0.97 → SELLING.
**SELLING:** Market sell `size=entry_size`. Poll until filled. Calculate P&L, close trade → WATCHING.

**Idempotency:** `clientOrderId = f"{side}-{trigger_timestamp_ms}"` prevents double orders on crash/restart.
**Crash recovery:** On startup, read `bot_state` from Supabase. If in BUYING/SELLING, poll the pending order.
**Error handling:** Wrap `tick()` in try/except, log errors, don't change state on failure.

### 3e. `scheduler.py` — APScheduler
`AsyncIOScheduler` with `IntervalTrigger(seconds=10)`, `max_instances=1`, `coalesce=True`. Starts/stops in FastAPI `lifespan`.

### 3f. `main.py` — REST Endpoints
Dashboard API key auth via `Depends()` on all routes. CORS for Vercel frontend only.

```
GET  /api/health              # scheduler status, last tick
GET  /api/dashboard           # aggregated overview
GET  /api/bot/state           # current state machine
GET  /api/bot/config          # current config  
PATCH /api/bot/config         # update config
POST /api/bot/start           # enable bot
POST /api/bot/stop            # disable bot
GET  /api/prices              # price history for charts
GET  /api/orders              # order history
GET  /api/trades              # round-trip trades with P&L
GET  /api/balance             # live Pionex balance
GET  /api/logs                # bot logs
```

---

## Phase 4: Frontend Dashboard (Next.js)

### Design Direction: "Terminal Luxe"

A trading terminal aesthetic — dark, dense, data-rich — but elevated with refined typography and considered spacing. Not a generic dashboard; a precision instrument.

**Tone:** Industrial-utilitarian meets luxury data viz. Think Bloomberg Terminal crossed with a Swiss design poster.
**Theme:** Deep black (`#0a0a0f`) with electric cyan (`#00e5ff`) primary, warm amber (`#ffb300`) for profit, rose (`#ff1744`) for loss. No gray-on-white. No purple gradients.
**Typography:** JetBrains Mono for numbers/data (monospaced precision), Satoshi or Outfit for headings (geometric, sharp), system sans for body.
**Signature detail:** Live-updating numbers with subtle digit-flip animations. Price chart with glowing gradient fill. State machine displayed as a horizontal pipeline with active state pulsing.

### Tech Stack
- Next.js App Router + Tailwind CSS v4
- Recharts (price chart, P&L chart)
- Framer Motion (page transitions, number animations)
- Lucide React (icons)

### API Proxy Pattern
All backend calls go through Next.js server-side API routes — API key never reaches the browser:

```
frontend/app/api/dashboard/route.ts   → GET  backend/api/dashboard
frontend/app/api/bot/state/route.ts   → GET  backend/api/bot/state
frontend/app/api/bot/config/route.ts  → GET/PATCH backend/api/bot/config
frontend/app/api/bot/start/route.ts   → POST backend/api/bot/start
frontend/app/api/bot/stop/route.ts    → POST backend/api/bot/stop
frontend/app/api/prices/route.ts      → GET  backend/api/prices
frontend/app/api/orders/route.ts      → GET  backend/api/orders
frontend/app/api/trades/route.ts      → GET  backend/api/trades
frontend/app/api/balance/route.ts     → GET  backend/api/balance
```

### Pages

| Route | Content |
|-------|---------|
| `/` | **Command Center** — Balance card, bot status pipeline, current price with 24h sparkline, P&L summary (total, win rate, avg return), last 5 trades mini-table |
| `/bot` | **Bot Control** — State machine visualization (WATCHING→BUYING→HOLDING→SELLING as horizontal pipeline), start/stop toggle, reference price / peak price gauges, live log stream |
| `/trades` | **Trade Ledger** — Full trade history table: date, entry/exit price, size, P&L (USDT + %), duration. Sortable, filterable. Running equity curve chart |
| `/chart` | **Price Terminal** — Full-width Recharts area chart with: price line (cyan), reference price (dashed white), peak price (dashed amber when HOLDING), buy markers (green triangles), sell markers (red triangles). Time range selector: 1h/6h/24h/7d |
| `/config` | **Settings** — Edit position size, dip %, trailing stop %, poll interval. Dark form inputs. Save confirmation |

### Layout
- Persistent left nav rail (60px, icon-only, expand on hover)
- Top bar: bot status badge (pulsing dot + state name), MON_USDT current price, account balance
- Content area with subtle grid background pattern

---

## Phase 5: Deployment

- **Backend:** Dockerfile → Coolify on Hetzner. `uvicorn main:app --host 0.0.0.0 --port 8000`
- **Frontend:** New Vercel account (linked to iganmich GitHub). Auto-deploy from `main` branch, `/frontend` as root directory
- **Env vars:** Set in Coolify (backend) and Vercel (frontend) dashboards — never committed
- CORS locked to Vercel frontend domain only
- Vercel auth: consider Vercel Authentication or NextAuth for login protection (Phase 2 enhancement)

---

## Implementation Order (start with backend)

1. Create directory, git init, GitHub repo (`iganmich/pionex-trading-bot`, private)
2. Create Supabase tables with `trading_` prefix in existing project
3. `config.py` + `db.py` — connect to Supabase, test CRUD
4. `pionex_client.py` — HMAC auth, test `get_ticker` + `get_balances`
5. `models.py`
6. `bot.py` — state machine with all 4 states
7. `scheduler.py` + `main.py` — wire it all together, test endpoints
8. Test full buy-sell cycle with small position
9. Frontend scaffold: Next.js + Tailwind + "Terminal Luxe" design system
10. API proxy routes + dashboard overview page
11. Remaining pages: bot control, trades, chart, config
12. Deploy: backend to Coolify, frontend to new Vercel account
13. End-to-end testing with real trades

---

## Verification

1. `GET /api/health` returns scheduler status
2. `GET /api/dashboard` returns balance + bot state + price
3. Bot in WATCHING state: confirm reference_price updates as price rises
4. Simulate dip: bot transitions to BUYING, places market buy
5. After fill: bot in HOLDING, peak_price tracks upward
6. Simulate drop from peak: bot transitions to SELLING, sells position
7. Trade record created with correct P&L
8. Crash recovery: kill process mid-HOLDING, restart — resumes correctly
9. Frontend dashboard shows all data, start/stop works
10. Browser DevTools → Network: no Pionex or Supabase URLs visible (all proxied through backend)
