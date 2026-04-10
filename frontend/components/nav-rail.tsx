"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  ArrowLeftRight,
  LineChart,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Command Center" },
  { href: "/bot", icon: Bot, label: "Bot Control" },
  { href: "/trades", icon: ArrowLeftRight, label: "Trade Ledger" },
  { href: "/chart", icon: LineChart, label: "Price Terminal" },
  { href: "/config", icon: Settings, label: "Settings" },
];

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 h-full w-[60px] hover:w-[200px] transition-all duration-200 bg-bg-card border-r border-border z-50 group overflow-hidden">
      <div className="flex flex-col items-start pt-4 gap-1">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-3 mb-4">
          <div className="w-7 h-7 rounded bg-cyan flex items-center justify-center shrink-0">
            <span className="text-bg-primary font-bold text-sm font-mono">P</span>
          </div>
          <span className="text-text-primary font-semibold text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Pionex Bot
          </span>
        </div>

        {/* Nav items */}
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2.5 w-full transition-colors ${
                active
                  ? "text-cyan bg-cyan-dim border-r-2 border-cyan"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <Icon size={20} className="shrink-0" />
              <span className="text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
