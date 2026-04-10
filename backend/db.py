from datetime import datetime, timezone
from decimal import Decimal

from supabase import create_client, Client

from config import settings
from models import BotState, BotConfig, BotStatus, Order, Trade, PricePoint, LogEntry

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _client


# --- Bot State ---

def get_bot_state() -> BotState:
    row = get_client().table("trading_bot_state").select("*").eq("id", 1).single().execute()
    return BotState(**row.data)


def update_bot_state(**kwargs) -> None:
    get_client().table("trading_bot_state").update(kwargs).eq("id", 1).execute()


# --- Bot Config ---

def get_bot_config() -> BotConfig:
    row = get_client().table("trading_bot_config").select("*").eq("id", 1).single().execute()
    return BotConfig(**row.data)


def update_bot_config(**kwargs) -> None:
    get_client().table("trading_bot_config").update(kwargs).eq("id", 1).execute()


# --- Price History ---

def insert_price(symbol: str, price: Decimal, volume: Decimal | None = None) -> None:
    get_client().table("trading_price_history").insert({
        "symbol": symbol,
        "price": str(price),
        "volume": str(volume) if volume else None,
    }).execute()


def get_prices(symbol: str = "MON_USDT", limit: int = 500) -> list[PricePoint]:
    rows = (
        get_client()
        .table("trading_price_history")
        .select("price, volume, created_at")
        .eq("symbol", symbol)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [PricePoint(**r) for r in rows.data]


# --- Orders ---

def insert_order(order: Order) -> None:
    get_client().table("trading_orders").insert({
        "pionex_order_id": order.pionex_order_id,
        "client_order_id": order.client_order_id,
        "symbol": order.symbol,
        "side": order.side.value,
        "order_type": order.order_type,
        "price": str(order.price) if order.price else None,
        "size": str(order.size) if order.size else None,
        "amount": str(order.amount) if order.amount else None,
        "status": order.status,
    }).execute()


def update_order(pionex_order_id: str, **kwargs) -> None:
    get_client().table("trading_orders").update(kwargs).eq("pionex_order_id", pionex_order_id).execute()


def get_orders(symbol: str = "MON_USDT", limit: int = 100) -> list[Order]:
    rows = (
        get_client()
        .table("trading_orders")
        .select("*")
        .eq("symbol", symbol)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [Order(**r) for r in rows.data]


# --- Trades ---

def insert_trade(trade: Trade) -> None:
    get_client().table("trading_trades").insert({
        "buy_order_id": trade.buy_order_id,
        "symbol": trade.symbol,
        "entry_price": str(trade.entry_price),
        "size": str(trade.size),
    }).execute()


def close_trade(buy_order_id: str, sell_order_id: str, exit_price: Decimal, pnl_usdt: Decimal, pnl_pct: Decimal) -> None:
    get_client().table("trading_trades").update({
        "sell_order_id": sell_order_id,
        "exit_price": str(exit_price),
        "pnl_usdt": str(pnl_usdt),
        "pnl_pct": str(pnl_pct),
        "closed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("buy_order_id", buy_order_id).execute()


def get_trades(symbol: str = "MON_USDT", limit: int = 100) -> list[Trade]:
    rows = (
        get_client()
        .table("trading_trades")
        .select("*")
        .eq("symbol", symbol)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [Trade(**r) for r in rows.data]


def get_trade_stats(symbol: str = "MON_USDT") -> dict:
    rows = (
        get_client()
        .table("trading_trades")
        .select("pnl_usdt")
        .eq("symbol", symbol)
        .not_.is_("closed_at", "null")
        .execute()
    )
    trades = rows.data
    total = len(trades)
    winners = sum(1 for t in trades if Decimal(str(t["pnl_usdt"])) > 0)
    total_pnl = sum(Decimal(str(t["pnl_usdt"])) for t in trades)
    return {"total_trades": total, "winning_trades": winners, "total_pnl": total_pnl}


# --- Logs ---

def log(level: str, message: str, data: dict | None = None) -> None:
    get_client().table("trading_bot_log").insert({
        "level": level,
        "message": message,
        "data": data,
    }).execute()


def get_logs(limit: int = 100, level: str | None = None) -> list[LogEntry]:
    query = get_client().table("trading_bot_log").select("*").order("created_at", desc=True).limit(limit)
    if level:
        query = query.eq("level", level)
    rows = query.execute()
    return [LogEntry(**r) for r in rows.data]
