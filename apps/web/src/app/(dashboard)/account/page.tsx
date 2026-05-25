import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Account</h1>
        <p className="text-sm text-muted mt-0.5">Manage your profile and preferences</p>
      </div>

      {/* Profile section */}
      <section
        className="rounded-xl border p-6 space-y-4"
        style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.07)" }}
      >
        <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Profile</h2>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center text-2xl">
            👤
          </div>
          <div>
            <p className="text-text font-medium">Dev User</p>
            <p className="text-sm text-muted">Connect Clerk to manage your account</p>
          </div>
        </div>
      </section>

      {/* Subscription section */}
      <section
        className="rounded-xl border p-6 space-y-4"
        style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.07)" }}
      >
        <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Subscription</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text font-medium">Free Plan</p>
            <p className="text-sm text-muted">Upgrade to unlock all features</p>
          </div>
          <button
            className="rounded-md px-4 py-2 text-sm font-medium text-black"
            style={{ background: "#10b981" }}
          >
            Upgrade
          </button>
        </div>
      </section>

      {/* Preferences section */}
      <section
        className="rounded-xl border p-6 space-y-4"
        style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,0.07)" }}
      >
        <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Preferences</h2>
        <div className="space-y-3">
          {[
            { label: "Sharp move alerts", description: "Notify when line moves ≥15 points" },
            { label: "Daily edge digest", description: "Morning summary of top confidence plays" },
            { label: "Parlay suggestions", description: "AI-generated correlated parlay picks" },
          ].map(({ label, description }) => (
            <div key={label} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-text">{label}</p>
                <p className="text-xs text-muted">{description}</p>
              </div>
              <div className="h-5 w-9 rounded-full bg-white/10 relative cursor-pointer">
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white/40" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
