"use client";

import { useState, useMemo } from "react";
import { usePolling } from "@/lib/hooks";
import { getPrices, getBotState, type PricePoint, type BotState } from "@/lib/api";
import { Card } from "@/components/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

const TIME_RANGES = [
  { label: "1H", hours: 1 },
  { label: "6H", hours: 6 },
  { label: "24H", hours: 24 },
  { label: "7D", hours: 168 },
] as const;

export default function PriceTerminal() {
  const [range, setRange] = useState(24);
  const { data: prices } = usePolling<PricePoint[]>(() => getPrices(2000), 10000);
  const { data: state } = usePolling<BotState>(getBotState, 5000);

  const chartData = useMemo(() => {
    if (!prices) return [];
    const cutoff = Date.now() - range * 60 * 60 * 1000;
    return prices
      .filter((p) => new Date(p.created_at).getTime() > cutoff)
      .reverse()
      .map((p) => ({
        time: new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        price: Number(p.price),
      }));
  }, [prices, range]);

  const refPrice = state?.reference_price ? Number(state.reference_price) : null;
  const peakPrice = state?.peak_price ? Number(state.peak_price) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Price Terminal</h1>
        <div className="flex gap-1 bg-bg-card border border-border rounded p-1">
          {TIME_RANGES.map(({ label, hours }) => (
            <button
              key={label}
              onClick={() => setRange(hours)}
              className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                range === hours
                  ? "bg-cyan-dim text-cyan"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="h-[500px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickFormatter={(v: number) => v.toFixed(4)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111118",
                    border: "1px solid #1e1e2e",
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: "monospace",
                  }}
                  labelStyle={{ color: "#71717a" }}
                  formatter={(value) => [Number(value).toFixed(6), "Price"]}
                />
                {refPrice && (
                  <ReferenceLine
                    y={refPrice}
                    stroke="#e4e4e7"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    label={{ value: "Ref", fill: "#71717a", fontSize: 10 }}
                  />
                )}
                {peakPrice && (
                  <ReferenceLine
                    y={peakPrice}
                    stroke="#ffb300"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    label={{ value: "Peak", fill: "#ffb300", fontSize: 10 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#00e5ff"
                  fill="url(#priceGrad)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-text-secondary font-mono text-sm">No price data yet</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
