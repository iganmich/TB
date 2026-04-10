"use client";

import { usePolling } from "@/lib/hooks";
import { getDashboard, type DashboardData } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  WATCHING: "bg-cyan",
  BUYING: "bg-amber",
  HOLDING: "bg-green",
  SELLING: "bg-rose",
};

export function TopBar() {
  const { data } = usePolling<DashboardData>(getDashboard, 5000);

  const status = data?.bot_state.status ?? "---";
  const price = data?.current_price ? Number(data.current_price).toFixed(6) : "---";
  const balance = data?.balance_usdt ? Number(data.balance_usdt).toFixed(2) : "---";
  const dotColor = STATUS_COLORS[status] ?? "bg-text-secondary";

  return (
    <header className="h-12 border-b border-border bg-bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-6">
        {/* Bot status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dotColor} ${data?.bot_config.enabled ? "pulse-dot" : ""}`} />
          <span className="text-xs font-mono text-text-secondary uppercase tracking-wider">
            {status}
          </span>
        </div>

        {/* Current price */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            {data?.bot_config.symbol?.replace("_", "/") ?? "---"}
          </span>
          <span className="text-sm font-mono text-cyan glow-text-cyan">{price}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Balance */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Balance</span>
          <span className="text-sm font-mono text-text-primary">{balance} USDT</span>
        </div>
      </div>
    </header>
  );
}
