"use client";

import { useEffect, useState } from "react";
import type { BotState, BotConfig } from "@/lib/api";

/**
 * Dip Proximity Meter
 *
 * WATCHING: shows how close current price is to the buy trigger (ref * (1 - dip_pct))
 * HOLDING:  shows how close current price is to the trailing stop (peak * (1 - trail_pct))
 *
 * Bar fills LEFT (trigger/stop — "imminent") to RIGHT (ref/peak — "safe").
 * The marker slides left as the trap closes, and the whole gauge pulses amber
 * when the marker enters the last 20% of the range.
 */

interface Props {
  state: BotState;
  config: BotConfig;
  currentPrice: string | null;
  lastUpdate: Date | null;
}

export function DipProximity({ state, config, currentPrice, lastUpdate }: Props) {
  const now = currentPrice ? Number(currentPrice) : null;
  const isWatching = state.status === "WATCHING";
  const isHolding = state.status === "HOLDING";

  // Determine anchors based on state
  let topAnchor: number | null = null;   // "safe" end (ref or peak)
  let bottomAnchor: number | null = null; // "trigger" end (buy or stop)
  let topLabel = "";
  let bottomLabel = "";
  let actionLabel = "";
  let triggerPct = 0;

  if (isWatching && state.reference_price) {
    topAnchor = Number(state.reference_price);
    triggerPct = Number(config.dip_pct);
    bottomAnchor = topAnchor * (1 - triggerPct);
    topLabel = "REFERENCE";
    bottomLabel = "BUY TRIGGER";
    actionLabel = "buy";
  } else if (isHolding && state.peak_price) {
    topAnchor = Number(state.peak_price);
    triggerPct = Number(config.trail_pct);
    bottomAnchor = topAnchor * (1 - triggerPct);
    topLabel = "PEAK";
    bottomLabel = "TRAIL STOP";
    actionLabel = "sell";
  }

  // Position along the range: 1.0 = at safe anchor, 0.0 = at trigger, <0 = past trigger
  const positionPct =
    now !== null && topAnchor !== null && bottomAnchor !== null && topAnchor !== bottomAnchor
      ? (now - bottomAnchor) / (topAnchor - bottomAnchor)
      : null;

  // Distance to trigger (in USDT per unit and as %)
  const distUsdt = now !== null && bottomAnchor !== null ? now - bottomAnchor : null;
  const distPct = now !== null && bottomAnchor !== null ? ((now - bottomAnchor) / now) * 100 : null;

  // Imminence: amplify glow as marker enters the last 20% of the range
  const imminent = positionPct !== null && positionPct < 0.2 && positionPct >= 0;
  const past = positionPct !== null && positionPct < 0;

  // "Last tick" counter — time since last dashboard refresh
  const [tickAgo, setTickAgo] = useState(0);
  useEffect(() => {
    if (!lastUpdate) return;
    setTickAgo(0);
    const id = setInterval(() => {
      setTickAgo(Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdate]);

  if (!topAnchor || !bottomAnchor || now === null || positionPct === null) {
    return <ProximityEmpty status={state.status} />;
  }

  // Clamp marker to visible range for display (but allow overrun indicator)
  const clampedPct = Math.max(0, Math.min(1, positionPct));
  const markerLeft = `${clampedPct * 100}%`;
  const fillWidth = `${clampedPct * 100}%`;

  const precision = topAnchor < 10 ? 6 : topAnchor < 1000 ? 4 : 2;
  const accentClass = imminent ? "text-rose glow-text-rose" : "text-cyan glow-text-cyan";
  const fillBg = imminent
    ? "bg-gradient-to-r from-rose/50 via-rose/20 to-transparent"
    : "bg-gradient-to-r from-cyan/40 via-cyan/10 to-transparent";

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-bg-card p-6">
      {/* Header: eyebrow + tick counter */}
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
            Dip Proximity
          </span>
          <span className="font-display italic text-xs text-text-secondary">
            {isWatching ? "awaiting the entry" : isHolding ? "guarding the position" : "idle"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-secondary">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan heartbeat" />
          last tick <span className="text-text-primary tabular">{tickAgo}s</span>
        </div>
      </div>

      {/* Anchor row: BOTTOM (left, trigger) ←→ TOP (right, safe) */}
      <div className="grid grid-cols-3 gap-4 mb-3 font-mono text-xs">
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">
            {bottomLabel}
          </div>
          <div className={`tabular ${imminent ? "text-rose" : "text-text-primary"}`}>
            {bottomAnchor.toFixed(precision)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">
            Now
          </div>
          <div className={`tabular text-base ${accentClass}`}>{now.toFixed(precision)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-text-secondary mb-1">
            {topLabel}
          </div>
          <div className="tabular text-text-primary">{topAnchor.toFixed(precision)}</div>
        </div>
      </div>

      {/* The gauge itself */}
      <div className="relative h-10 mb-4">
        {/* Base track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-border" />

        {/* Filled portion (from left/trigger toward current position) */}
        <div
          className={`absolute inset-y-0 left-0 ${fillBg} transition-[width] duration-700 ease-out ${imminent ? "heartbeat-glow" : ""}`}
          style={{ width: fillWidth }}
        />

        {/* Graduation marks every 25% */}
        {[0.25, 0.5, 0.75].map((t) => (
          <div
            key={t}
            className="absolute top-1/2 -translate-y-1/2 w-px h-2 bg-border"
            style={{ left: `${t * 100}%` }}
          />
        ))}

        {/* Trigger end-cap (left) */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-5 border-l-2 border-rose/70" />
        {/* Safe end-cap (right) */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-5 border-r-2 border-cyan/70" />

        {/* Current marker */}
        <div
          className="absolute top-0 bottom-0 transition-[left] duration-700 ease-out"
          style={{ left: markerLeft, transform: "translateX(-50%)" }}
        >
          <div className="relative h-full flex flex-col items-center">
            <div className={`w-[1px] h-full ${imminent ? "bg-rose" : "bg-cyan"}`} />
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${imminent ? "bg-rose glow-cyan" : "bg-cyan glow-cyan"} ${past ? "pulse-dot" : ""}`}
            />
          </div>
        </div>
      </div>

      {/* Footer: distance readout */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-baseline gap-2 text-xs font-mono">
          <span className="text-[10px] uppercase tracking-widest text-text-secondary">
            distance to {actionLabel}
          </span>
          {distUsdt !== null && distPct !== null && (
            <>
              <span className={`tabular text-sm ${imminent ? "text-rose" : "text-text-primary"}`}>
                {distUsdt < 0 ? "" : "−"}
                {Math.abs(distUsdt).toFixed(precision)} USDT
              </span>
              <span className="text-text-secondary tabular">
                ({distPct < 0 ? "+" : "−"}
                {Math.abs(distPct).toFixed(2)}%)
              </span>
            </>
          )}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-text-secondary">
          {(triggerPct * 100).toFixed(1)}% {isWatching ? "dip" : "trail"}
        </div>
      </div>
    </div>
  );
}

function ProximityEmpty({ status }: { status: string }) {
  const msg =
    status === "BUYING"
      ? "executing entry"
      : status === "SELLING"
        ? "executing exit"
        : "no reference price yet";
  return (
    <div className="rounded-lg border border-border bg-bg-card p-6">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
          Dip Proximity
        </span>
        <span className="font-display italic text-xs text-text-secondary">{msg}</span>
      </div>
      <div className="h-10 border-t border-dashed border-border mt-4" />
    </div>
  );
}
