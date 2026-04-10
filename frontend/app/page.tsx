"use client";

import { usePolling } from "@/lib/hooks";
import { getDashboard, getTrades, type DashboardData, type Trade } from "@/lib/api";
import { Card } from "@/components/card";
import { StatePipeline } from "@/components/state-pipeline";

export default function CommandCenter() {
  const { data, loading } = usePolling<DashboardData>(getDashboard, 5000);
  const { data: trades } = usePolling<Trade[]>(() => getTrades(5), 10000);

  if (loading || !data) {
    return <Loading />;
  }

  const { bot_state, current_price, balance_usdt, total_trades, winning_trades, total_pnl } = data;
  const winRate = total_trades > 0 ? ((winning_trades / total_trades) * 100).toFixed(1) : "0.0";
  const pnl = Number(total_pnl);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Command Center</h1>

      {/* State Pipeline */}
      <Card title="Bot Status">
        <StatePipeline status={bot_state.status} />
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Current Price" value={current_price ? Number(current_price).toFixed(6) : "---"} unit="USDT" color="text-cyan" />
        <StatCard label="Balance" value={balance_usdt ? Number(balance_usdt).toFixed(2) : "---"} unit="USDT" />
        <StatCard
          label="Total P&L"
          value={pnl !== 0 ? `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}` : "0.00"}
          unit="USDT"
          color={pnl > 0 ? "text-green" : pnl < 0 ? "text-rose" : "text-text-primary"}
        />
        <StatCard label="Win Rate" value={`${winRate}%`} sub={`${winning_trades}/${total_trades} trades`} />
      </div>

      {/* State Details */}
      {bot_state.status !== "WATCHING" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bot_state.entry_price && (
            <StatCard label="Entry Price" value={Number(bot_state.entry_price).toFixed(6)} unit="USDT" />
          )}
          {bot_state.entry_size && (
            <StatCard label="Position Size" value={Number(bot_state.entry_size).toFixed(4)} unit="MON" />
          )}
          {bot_state.peak_price && (
            <StatCard label="Peak Price" value={Number(bot_state.peak_price).toFixed(6)} unit="USDT" color="text-amber" />
          )}
        </div>
      )}

      {/* Recent Trades */}
      <Card title="Recent Trades">
        {trades && trades.length > 0 ? (
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-text-secondary text-xs uppercase tracking-wider">
                <th className="text-left py-2">Date</th>
                <th className="text-right py-2">Entry</th>
                <th className="text-right py-2">Exit</th>
                <th className="text-right py-2">P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const pnl = t.pnl_usdt ? Number(t.pnl_usdt) : null;
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2 text-text-secondary">
                      {new Date(t.opened_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-right">{Number(t.entry_price).toFixed(6)}</td>
                    <td className="py-2 text-right">
                      {t.exit_price ? Number(t.exit_price).toFixed(6) : "---"}
                    </td>
                    <td className={`py-2 text-right ${pnl !== null ? (pnl > 0 ? "text-green" : "text-rose") : ""}`}>
                      {pnl !== null ? `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}` : "Open"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-text-secondary text-sm">No trades yet</p>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  sub,
  color = "text-text-primary",
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-mono ${color}`}>
        {value}
        {unit && <span className="text-xs text-text-secondary ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-text-secondary mt-1">{sub}</p>}
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-text-secondary font-mono text-sm animate-pulse">Loading...</div>
    </div>
  );
}
