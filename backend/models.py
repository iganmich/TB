from datetime import datetime
from enum import Enum
from decimal import Decimal

from pydantic import BaseModel, Field


class BotStatus(str, Enum):
    WATCHING = "WATCHING"
    BUYING = "BUYING"
    HOLDING = "HOLDING"
    SELLING = "SELLING"


# --- Bot State ---

class BotState(BaseModel):
    status: BotStatus = BotStatus.WATCHING
    reference_price: Decimal | None = None
    peak_price: Decimal | None = None
    entry_price: Decimal | None = None
    entry_size: Decimal | None = None
    buy_order_id: str | None = None
    sell_order_id: str | None = None
    updated_at: datetime | None = None


# --- Bot Config ---

class BotConfig(BaseModel):
    symbol: str = "MON_USDT"
    position_size: Decimal = Decimal("1000")
    dip_pct: Decimal = Decimal("0.03")
    trail_pct: Decimal = Decimal("0.03")
    poll_interval: int = 10
    enabled: bool = False


class BotConfigUpdate(BaseModel):
    symbol: str | None = None
    position_size: Decimal | None = None
    dip_pct: Decimal | None = None
    trail_pct: Decimal | None = None
    poll_interval: int | None = None
    enabled: bool | None = None


# --- Orders ---

class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class Order(BaseModel):
    pionex_order_id: str
    client_order_id: str | None = None
    symbol: str = "MON_USDT"
    side: OrderSide
    order_type: str = "MARKET"
    price: Decimal | None = None
    size: Decimal | None = None
    amount: Decimal | None = None
    filled_size: Decimal = Decimal("0")
    filled_amount: Decimal = Decimal("0")
    avg_price: Decimal | None = None
    status: str = "NEW"
    created_at: datetime | None = None
    updated_at: datetime | None = None


# --- Trades ---

class Trade(BaseModel):
    id: int | None = None
    buy_order_id: str
    sell_order_id: str | None = None
    symbol: str = "MON_USDT"
    entry_price: Decimal
    exit_price: Decimal | None = None
    size: Decimal
    pnl_usdt: Decimal | None = None
    pnl_pct: Decimal | None = None
    opened_at: datetime | None = None
    closed_at: datetime | None = None


# --- Price ---

class PricePoint(BaseModel):
    price: Decimal
    volume: Decimal | None = None
    created_at: datetime | None = None


# --- Dashboard ---

class DashboardResponse(BaseModel):
    bot_state: BotState
    bot_config: BotConfig
    current_price: Decimal | None = None
    balance_usdt: Decimal | None = None
    total_trades: int = 0
    winning_trades: int = 0
    total_pnl: Decimal = Decimal("0")


# --- Log ---

class LogEntry(BaseModel):
    level: str = "INFO"
    message: str
    data: dict | None = None
    created_at: datetime | None = None
