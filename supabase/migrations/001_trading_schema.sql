-- Pionex Trading Bot Schema
-- All tables prefixed with trading_ to isolate from other projects in this Supabase instance.
-- RLS enabled on all tables; only service_role has access.

-- ============================================================
-- 1. trading_bot_config (singleton)
-- ============================================================
CREATE TABLE trading_bot_config (
    id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    symbol      text    NOT NULL DEFAULT 'MON_USDT',
    position_size numeric NOT NULL DEFAULT 1000,      -- USDT per trade
    dip_pct     numeric NOT NULL DEFAULT 0.03,         -- 3% dip trigger
    trail_pct   numeric NOT NULL DEFAULT 0.03,         -- 3% trailing stop
    poll_interval integer NOT NULL DEFAULT 10,         -- seconds
    enabled     boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trading_bot_config ENABLE ROW LEVEL SECURITY;

-- Seed singleton row
INSERT INTO trading_bot_config (id) VALUES (1);

-- ============================================================
-- 2. trading_bot_state (singleton)
-- ============================================================
CREATE TYPE trading_bot_status AS ENUM ('WATCHING', 'BUYING', 'HOLDING', 'SELLING');

CREATE TABLE trading_bot_state (
    id              integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    status          trading_bot_status NOT NULL DEFAULT 'WATCHING',
    reference_price numeric,            -- local high (WATCHING)
    peak_price      numeric,            -- post-entry high (HOLDING)
    entry_price     numeric,            -- buy fill price
    entry_size      numeric,            -- quantity bought
    buy_order_id    text,               -- pending buy order
    sell_order_id   text,               -- pending sell order
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trading_bot_state ENABLE ROW LEVEL SECURITY;

-- Seed singleton row
INSERT INTO trading_bot_state (id) VALUES (1);

-- ============================================================
-- 3. trading_price_history (time-series)
-- ============================================================
CREATE TABLE trading_price_history (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    symbol      text    NOT NULL DEFAULT 'MON_USDT',
    price       numeric NOT NULL,
    volume      numeric,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_created ON trading_price_history (created_at DESC);
CREATE INDEX idx_price_history_symbol  ON trading_price_history (symbol, created_at DESC);

ALTER TABLE trading_price_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. trading_orders (mirrors Pionex orders)
-- ============================================================
CREATE TABLE trading_orders (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pionex_order_id text    NOT NULL UNIQUE,
    client_order_id text,
    symbol          text    NOT NULL DEFAULT 'MON_USDT',
    side            text    NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type      text    NOT NULL DEFAULT 'MARKET',
    price           numeric,
    size            numeric,
    amount          numeric,            -- USDT amount (for market buys)
    filled_size     numeric DEFAULT 0,
    filled_amount   numeric DEFAULT 0,
    avg_price       numeric,
    status          text    NOT NULL DEFAULT 'NEW',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trading_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. trading_trades (round-trips with P&L)
-- ============================================================
CREATE TABLE trading_trades (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    buy_order_id    text    NOT NULL REFERENCES trading_orders(pionex_order_id),
    sell_order_id   text    REFERENCES trading_orders(pionex_order_id),
    symbol          text    NOT NULL DEFAULT 'MON_USDT',
    entry_price     numeric NOT NULL,
    exit_price      numeric,
    size            numeric NOT NULL,
    pnl_usdt        numeric,            -- exit_amount - entry_amount
    pnl_pct         numeric,            -- pnl / entry_amount * 100
    opened_at       timestamptz NOT NULL DEFAULT now(),
    closed_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trading_trades ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. trading_bot_log (audit trail)
-- ============================================================
CREATE TABLE trading_bot_log (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    level       text    NOT NULL DEFAULT 'INFO' CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
    message     text    NOT NULL,
    data        jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_log_created ON trading_bot_log (created_at DESC);
CREATE INDEX idx_bot_log_level   ON trading_bot_log (level, created_at DESC);

ALTER TABLE trading_bot_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bot_config_updated
    BEFORE UPDATE ON trading_bot_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bot_state_updated
    BEFORE UPDATE ON trading_bot_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated
    BEFORE UPDATE ON trading_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trades_updated
    BEFORE UPDATE ON trading_trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
