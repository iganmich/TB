"use client";

import { usePolling } from "@/lib/hooks";
import { getTrades, type Trade } from "@/lib/api";
import { Card } from "@/components/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function TradeLedger() {
  const { data: trades, loading } = usePolling<Trade[]>(() => getTrades(100), 10000);

  if (loading || !trades) {
    return <div className="text-text-secondary font-mono text-sm animate-pulse p-8">Loading...</div>;
  }

  // Equity curve: cumulative P&L over closed trades
  const closedTrades = trades
    .filter((t) => t.closed_at && t.pnl_usdt)
    .reverse();

  let cumPnl = 0;
  const equityData = closedTrades.map((t) => {
    cumPnl += Number(t.pnl_usdt);
    return {
      date: new Date(t.closed_at!).toLocaleDateString(),
      pnl: cumPnl,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Trade Ledger</h1>

      {/* Equity Curve */}
      {equityData.length > 1 && (
        <Card title="Equity Curve">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#71717a" }}
                />
                <Area type="monotone" dataKey="pnl" stroke="#00e5ff" fill="url(#pnlGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Trade Table */}
      <Card title="All Trades">
        {trades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-text-secondary text-xs uppercase tracking-wider">
                  <th className="text-left py-2">Opened</th>
                  <th className="text-right py-2">Entry</th>
                  <th className="text-right py-2">Exit</th>
                  <th className="text-right py-2">Size</th>
                  <th className="text-right py-2">P&L USDT</th>
                  <th className="text-right py-2">P&L %</th>
                  <th className="text-right py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const pnl = t.pnl_usdt ? Number(t.pnl_usdt) : null;
                  const pnlPct = t.pnl_pct ? Number(t.pnl_pct) : null;
                  const pnlColor = pnl !== null ? (pnl > 0 ? "text-green" : "text-rose") : "";
                  return (
                    <tr key={t.id} className="border-t border-border hover:bg-bg-hover transition-colors">
                      <td className="py-2 text-text-secondary">
                        {new Date(t.opened_at).toLocaleString()}
                      </td>
                      <td className="py-2 text-right">{Number(t.entry_price).toFixed(6)}</td>
                      <td className="py-2 text-right">
                        {t.exit_price ? Number(t.exit_price).toFixed(6) : "---"}
                      </td>
                      <td className="py-2 text-right">{Number(t.size).toFixed(4)}</td>
                      <td className={`py-2 text-right ${pnlColor}`}>
                        {pnl !== null ? `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}` : "---"}
                      </td>
                      <td className={`py-2 text-right ${pnlColor}`}>
                        {pnlPct !== null ? `${pnlPct > 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "---"}
                      </td>
                      <td className="py-2 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          t.closed_at ? "bg-green-dim text-green" : "bg-amber-dim text-amber"
                        }`}>
                          {t.closed_at ? "Closed" : "Open"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-secondary text-sm">No trades yet</p>
        )}
      </Card>
    </div>
  );
}
