"use client";

import { type BotState } from "@/lib/api";

const STATES = ["WATCHING", "BUYING", "HOLDING", "SELLING"] as const;

const STATE_COLORS: Record<string, { active: string; dot: string }> = {
  WATCHING: { active: "border-cyan text-cyan bg-cyan-dim", dot: "bg-cyan" },
  BUYING: { active: "border-amber text-amber bg-amber-dim", dot: "bg-amber" },
  HOLDING: { active: "border-green text-green bg-green-dim", dot: "bg-green" },
  SELLING: { active: "border-rose text-rose bg-rose-dim", dot: "bg-rose" },
};

export function StatePipeline({ status }: { status: BotState["status"] }) {
  return (
    <div className="flex items-center gap-2">
      {STATES.map((s, i) => {
        const active = s === status;
        const colors = STATE_COLORS[s];
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`px-3 py-1.5 rounded border text-xs font-mono uppercase tracking-wider transition-all ${
                active ? colors.active : "border-border text-text-secondary"
              }`}
            >
              <div className="flex items-center gap-2">
                {active && (
                  <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} pulse-dot`} />
                )}
                {s}
              </div>
            </div>
            {i < STATES.length - 1 && (
              <div className="text-text-secondary text-xs">→</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
