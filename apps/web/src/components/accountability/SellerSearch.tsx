"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export function SellerSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim().replace(/^@/, "");
      if (trimmed) router.push(`/accountability/${trimmed}`);
    },
    [query, router]
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="@handle"
        className="w-40 rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus:border-white/20 font-mono"
      />
      <button
        type="submit"
        className="rounded-md bg-white/[0.07] hover:bg-white/[0.12] border border-border text-sm text-text px-3 py-1.5 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
