"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Edge Feed",        icon: "⚡" },
  { href: "/parlay", label: "Parlay",     icon: "🎯" },
  { href: "/accountability", label: "Accountability", icon: "🔍" },
  { href: "/live", label: "Live",          icon: "📡" },
  { href: "/account", label: "Account",   icon: "👤" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-screen w-56 flex-col border-r border-border bg-surface"
      style={{ borderColor: "rgba(255,255,255,0.07)" }}
    >
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <span className="font-display text-lg font-bold text-text tracking-tight">
          Sharp<span className="text-sharp-green">Edge</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors mb-0.5",
                active
                  ? "bg-white/[0.08] text-text"
                  : "text-muted hover:bg-white/[0.04] hover:text-text"
              )}
            >
              <span>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <UserButton
          appearance={{
            variables: { colorPrimary: "#10b981" },
            elements: { userButtonBox: "gap-2" },
          }}
          showName
        />
      </div>
    </aside>
  );
}
