"use client";

import { useState, useEffect } from "react";
import { usePolling } from "@/lib/hooks";
import { getBotConfig, updateBotConfig, type BotConfig } from "@/lib/api";
import { Card } from "@/components/card";

export default function ConfigPage() {
  const { data: config, refresh } = usePolling<BotConfig>(getBotConfig, 10000);
  const [form, setForm] = useState({
    position_size: "",
    dip_pct: "",
    trail_pct: "",
    poll_interval: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        position_size: config.position_size,
        dip_pct: (Number(config.dip_pct) * 100).toString(),
        trail_pct: (Number(config.trail_pct) * 100).toString(),
        poll_interval: config.poll_interval.toString(),
      });
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateBotConfig({
        position_size: form.position_size,
        dip_pct: (Number(form.dip_pct) / 100).toString(),
        trail_pct: (Number(form.trail_pct) / 100).toString(),
        poll_interval: parseInt(form.poll_interval),
      });
      setSaved(true);
      refresh();
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return <div className="text-text-secondary font-mono text-sm animate-pulse p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card title="Bot Configuration">
        <div className="space-y-4">
          <Field
            label="Position Size (USDT)"
            value={form.position_size}
            onChange={(v) => setForm({ ...form, position_size: v })}
            type="number"
          />
          <Field
            label="Dip Trigger (%)"
            value={form.dip_pct}
            onChange={(v) => setForm({ ...form, dip_pct: v })}
            type="number"
            step="0.1"
          />
          <Field
            label="Trailing Stop (%)"
            value={form.trail_pct}
            onChange={(v) => setForm({ ...form, trail_pct: v })}
            type="number"
            step="0.1"
          />
          <Field
            label="Poll Interval (seconds)"
            value={form.poll_interval}
            onChange={(v) => setForm({ ...form, poll_interval: v })}
            type="number"
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-cyan-dim text-cyan border border-cyan rounded text-sm font-mono font-semibold hover:bg-cyan hover:text-bg-primary transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saved && (
              <span className="text-green text-sm font-mono">Saved</span>
            )}
          </div>
        </div>
      </Card>

      <Card title="Current Config">
        <div className="space-y-2 text-sm font-mono">
          <Row label="Symbol" value={config.symbol} />
          <Row label="Position Size" value={`${config.position_size} USDT`} />
          <Row label="Dip Trigger" value={`${(Number(config.dip_pct) * 100).toFixed(1)}%`} />
          <Row label="Trailing Stop" value={`${(Number(config.trail_pct) * 100).toFixed(1)}%`} />
          <Row label="Poll Interval" value={`${config.poll_interval}s`} />
          <Row label="Enabled" value={config.enabled ? "Yes" : "No"} color={config.enabled ? "text-green" : "text-rose"} />
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-text-secondary uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm font-mono text-text-primary focus:border-cyan focus:outline-none transition-colors"
      />
    </div>
  );
}

function Row({ label, value, color = "text-text-primary" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/50">
      <span className="text-text-secondary">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}
