"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/",               label: "Edge Feed",       icon: "⚡" },
  { href: "/parlay",         label: "Parlay",          icon: "🎯" },
  { href: "/accountability", label: "Accountability",  icon: "🔍" },
  { href: "/live",           label: "Live",            icon: "📡" },
  { href: "/account",        label: "Account",         icon: "👤" },
];

const hasClerk = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("...")
);

function UserSection() {
  if (!hasClerk) {
    return (
      <div className="flex items-center gap-2 px-1">
        <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-muted">
          ?
        </div>
        <span className="text-xs text-muted">Dev mode</span>
      </div>
    );
  }

  // Lazy-import UserButton only when Clerk is available
  const { UserButton } = require("@clerk/nextjs");
  return (
    <UserButton
      appearance={{
        variables: { colorPrimary: "#10b981" },
        elements: { userButtonBox: "gap-2" },
      }}
      showName
    />
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-screen w-56 flex-col border-r bg-surface"
      style={{ borderColor: "rgba(255,255,255,0.07)" }}
    >
      {/* Logo */}
      <div
        className="flex h-14 items-center px-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <span className="font-display text-lg font-bold text-text tracking-tight">
          Bag<span className="text-sharp-green">Chaser</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active =
            pathname === href || (href !== "/" && pathname.startsWith(href));
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
      <div
        className="border-t p-3"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
      >
        <UserSection />
      </div>
    </aside>
  );
}
