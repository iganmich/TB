from contextlib import asynccontextmanager
from decimal import Decimal

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

import db
import scheduler
import pionex_client as px
from config import settings
from models import BotConfig, BotConfigUpdate, BotState, BotStatus, DashboardResponse


# --- Auth ---

async def verify_api_key(authorization: str = Header(...)) -> None:
    if not settings.DASHBOARD_API_KEY:
        return  # No key configured = open (dev mode)
    token = authorization.removeprefix("Bearer ").strip()
    if token != settings.DASHBOARD_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# --- Lifespan ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    config = db.get_bot_config()
    scheduler.start(interval_seconds=config.poll_interval)
    db.log("INFO", "Backend started")
    yield
    scheduler.stop()
    db.log("INFO", "Backend stopped")


# --- App ---

app = FastAPI(title="Pionex Trading Bot", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health (no auth) ---

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "scheduler_running": scheduler.is_running(),
        "last_error": scheduler.last_error(),
    }


# --- Dashboard ---

@app.get("/api/dashboard", dependencies=[Depends(verify_api_key)])
async def dashboard() -> DashboardResponse:
    state = db.get_bot_state()
    config = db.get_bot_config()
    stats = db.get_trade_stats(config.symbol)

    current_price = None
    balance_usdt = None
    try:
        ticker = await px.get_ticker(config.symbol)
        current_price = ticker["price"]
    except Exception:
        pass
    try:
        balances = await px.get_balances()
        balance_usdt = balances.get("USDT", Decimal("0"))
    except Exception:
        pass

    return DashboardResponse(
        bot_state=state,
        bot_config=config,
        current_price=current_price,
        balance_usdt=balance_usdt,
        **stats,
    )


# --- Bot State ---

@app.get("/api/bot/state", dependencies=[Depends(verify_api_key)])
async def bot_state() -> BotState:
    return db.get_bot_state()


# --- Bot Config ---

@app.get("/api/bot/config", dependencies=[Depends(verify_api_key)])
async def bot_config() -> BotConfig:
    return db.get_bot_config()


@app.patch("/api/bot/config", dependencies=[Depends(verify_api_key)])
async def update_config(update: BotConfigUpdate) -> BotConfig:
    changes = update.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Symbol change requires special handling: validate + reset state
    new_symbol = changes.get("symbol")
    if new_symbol is not None:
        current_config = db.get_bot_config()
        if new_symbol != current_config.symbol:
            # Reject mid-position symbol swaps
            state = db.get_bot_state()
            if state.status != BotStatus.WATCHING:
                raise HTTPException(
                    status_code=409,
                    detail=f"Cannot change symbol while bot is {state.status.value}. Close the position first.",
                )
            # Validate the new symbol against Pionex
            try:
                await px.get_ticker(new_symbol)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid symbol '{new_symbol}': {e}")
            # Reset state tied to the old asset
            db.update_bot_state(
                reference_price=None,
                peak_price=None,
                entry_price=None,
                entry_size=None,
                buy_order_id=None,
                sell_order_id=None,
                status=BotStatus.WATCHING.value,
            )
            db.log("INFO", f"Symbol changed from {current_config.symbol} to {new_symbol}; state reset")

    # Convert Decimal to str for Supabase
    db_changes = {k: str(v) if isinstance(v, Decimal) else v for k, v in changes.items()}
    db.update_bot_config(**db_changes)
    db.log("INFO", f"Config updated: {changes}")
    return db.get_bot_config()


# --- Bot Start/Stop ---

@app.post("/api/bot/start", dependencies=[Depends(verify_api_key)])
async def bot_start():
    db.update_bot_config(enabled=True)
    if not scheduler.is_running():
        config = db.get_bot_config()
        scheduler.start(interval_seconds=config.poll_interval)
    db.log("INFO", "Bot enabled")
    return {"status": "started"}


@app.post("/api/bot/stop", dependencies=[Depends(verify_api_key)])
async def bot_stop():
    db.update_bot_config(enabled=False)
    db.log("INFO", "Bot disabled")
    return {"status": "stopped"}


# --- Prices ---

@app.get("/api/prices", dependencies=[Depends(verify_api_key)])
async def prices(limit: int = 500, symbol: str | None = None):
    if symbol is None:
        symbol = db.get_bot_config().symbol
    return db.get_prices(symbol=symbol, limit=limit)


# --- Orders ---

@app.get("/api/orders", dependencies=[Depends(verify_api_key)])
async def orders(limit: int = 100):
    return db.get_orders(limit=limit)


# --- Trades ---

@app.get("/api/trades", dependencies=[Depends(verify_api_key)])
async def trades(limit: int = 100):
    return db.get_trades(limit=limit)


# --- Balance ---

@app.get("/api/balance", dependencies=[Depends(verify_api_key)])
async def balance():
    try:
        balances = await px.get_balances()
        return {"balances": {k: str(v) for k, v in balances.items()}}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Pionex API error: {e}")


# --- Logs ---

@app.get("/api/logs", dependencies=[Depends(verify_api_key)])
async def logs(limit: int = 100, level: str | None = None):
    return db.get_logs(limit=limit, level=level)
