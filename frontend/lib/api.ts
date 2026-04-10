const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Dashboard
export const getDashboard = () => request<DashboardData>("/dashboard");

// Bot
export const getBotState = () => request<BotState>("/bot/state");
export const getBotConfig = () => request<BotConfig>("/bot/config");
export const updateBotConfig = (data: Partial<BotConfig>) =>
  request<BotConfig>("/bot/config", { method: "PATCH", body: JSON.stringify(data) });
export const startBot = () => request("/bot/start", { method: "POST" });
export const stopBot = () => request("/bot/stop", { method: "POST" });

// Data
export const getPrices = (limit = 500) => request<PricePoint[]>(`/prices?limit=${limit}`);
export const getOrders = (limit = 100) => request<Order[]>(`/orders?limit=${limit}`);
export const getTrades = (limit = 100) => request<Trade[]>(`/trades?limit=${limit}`);
export const getBalance = () => request<{ balances: Record<string, string> }>("/balance");
export const getLogs = (limit = 100) => request<LogEntry[]>(`/logs?limit=${limit}`);

// Types
export interface BotState {
  status: "WATCHING" | "BUYING" | "HOLDING" | "SELLING";
  reference_price: string | null;
  peak_price: string | null;
  entry_price: string | null;
  entry_size: string | null;
  buy_order_id: string | null;
  sell_order_id: string | null;
  updated_at: string | null;
}

export interface BotConfig {
  symbol: string;
  position_size: string;
  dip_pct: string;
  trail_pct: string;
  poll_interval: number;
  enabled: boolean;
}

export interface DashboardData {
  bot_state: BotState;
  bot_config: BotConfig;
  current_price: string | null;
  balance_usdt: string | null;
  total_trades: number;
  winning_trades: number;
  total_pnl: string;
}

export interface PricePoint {
  price: string;
  volume: string | null;
  created_at: string;
}

export interface Order {
  pionex_order_id: string;
  client_order_id: string | null;
  symbol: string;
  side: "BUY" | "SELL";
  order_type: string;
  price: string | null;
  size: string | null;
  amount: string | null;
  filled_size: string;
  filled_amount: string;
  avg_price: string | null;
  status: string;
  created_at: string;
}

export interface Trade {
  id: number;
  buy_order_id: string;
  sell_order_id: string | null;
  symbol: string;
  entry_price: string;
  exit_price: string | null;
  size: string;
  pnl_usdt: string | null;
  pnl_pct: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface LogEntry {
  level: string;
  message: string;
  data: Record<string, unknown> | null;
  created_at: string;
}
