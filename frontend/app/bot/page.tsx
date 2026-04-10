"use client";

import { useCallback } from "react";
import { usePolling } from "@/lib/hooks";
import { getBotState, getBotConfig, getLogs, startBot, stopBot, type BotState, type BotConfig, type LogEntry } from "@/lib/api";
import { Card } from "@/components/card";
import { StatePipeline } from "@/components/state-pipeline";

export default function BotControl() {
  const { data: state, refresh: refreshState } = usePolling<BotState>(getBotState, 3000);
  const { data: config, refresh: refreshConfig } = usePolling<BotConfig>(getBotConfig, 5000);
  const { data: logs } = usePolling<LogEntry[]>(() => getLogs(30), 5000);

  const handleToggle = useCallback(async () => {
    if (!config) return;
    if (config.enabled) {
      await stopBot();
    } else {
      await startBot();
    }
    refreshConfig();
    refreshState();
  }, [config, refreshConfig, refreshState]);

  if (!state || !config) {
    return <div className="text-text-secondary font-mono text-sm animate-pulse p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bot Control</h1>
        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded text-sm font-mono font-semibold transition-all ${
            config.enabled
              ? "bg-rose-dim text-rose border border-rose hover:bg-rose hover:text-bg-primary"
              : "bg-green-dim text-green border border-green hover:bg-green hover:text-bg-primary"
          }`}
        >
          {config.enabled ? "STOP BOT" : "START BOT"}
        </button>
      </div>

      {/* State Machine */}
      <Card title="State Machine">
        <StatePipeline status={state.status} />
      </Card>

      {/* Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Reference Price</p>
          <p className="text-lg font-mono text-cyan">
            {state.reference_price ? Number(state.reference_price).toFixed(6) : "---"}
          </p>
          <p className="text-xs text-text-secondary mt-1">Local high (WATCHING)</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Peak Price</p>
          <p className="text-lg font-mono text-amber">
            {state.peak_price ? Number(state.peak_price).toFixed(6) : "---"}
          </p>
          <p className="text-xs text-text-secondary mt-1">Post-entry high (HOLDING)</p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Entry Price</p>
          <p className="text-lg font-mono text-text-primary">
            {state.entry_price ? Number(state.entry_price).toFixed(6) : "---"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Position Size</p>
          <p className="text-lg font-mono text-text-primary">
            {state.entry_size
              ? `${Number(state.entry_size).toFixed(4)} ${config.symbol.split("_")[0]}`
              : "---"}
          </p>
        </Card>
      </div>

      {/* Live Log */}
      <Card title="Log Stream">
        <div className="max-h-80 overflow-y-auto space-y-1">
          {logs && logs.length > 0 ? (
            logs.map((log, i) => (
              <div key={i} className="flex gap-3 text-xs font-mono py-1 border-b border-border/50">
                <span className="text-text-secondary shrink-0">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 w-12 ${
                  log.level === "ERROR" ? "text-rose" :
                  log.level === "WARN" ? "text-amber" :
                  log.level === "INFO" ? "text-cyan" : "text-text-secondary"
                }`}>
                  {log.level}
                </span>
                <span className="text-text-primary">{log.message}</span>
              </div>
            ))
          ) : (
            <p className="text-text-secondary text-sm">No logs yet</p>
          )}
        </div>
      </Card>
    </div>
  );
}
