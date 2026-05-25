"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ParlayLeg, ParlayResult } from "@sharp-edge/shared";
import { api } from "@/lib/api";

async function getAuthToken(): Promise<string | null> {
  try {
    const { useAuth } = await import("@clerk/nextjs");
    // Can't call hooks dynamically — token is null in dev-mode (no Clerk)
    return null;
  } catch {
    return null;
  }
}

export function useParlay() {
  const queryClient = useQueryClient();
  const [legs, setLegs] = useState<ParlayLeg[]>([]);

  const probabilityQuery = useQuery({
    queryKey: ["parlay-probability", legs],
    queryFn: () =>
      api.post<ParlayResult>("/api/parlays/probability", { legs }),
    enabled: legs.length >= 2,
    refetchInterval: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { sportsbook?: string }) => {
      const prob = probabilityQuery.data;
      return api.post("/api/parlays", {
        legs,
        combinedProb: prob?.adjustedProbability,
        bookImplied: prob?.bookImpliedProbability,
        edgeScore: prob?.edgeScore,
        payoutOdds: prob?.payoutOdds,
        sportsbook: data.sportsbook,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-parlays"] }),
  });

  const addLeg = useCallback((leg: ParlayLeg) => {
    setLegs((prev) => {
      const alreadyAdded = prev.some(
        (l) => l.gameId === leg.gameId && l.market === leg.market && l.label === leg.label
      );
      if (alreadyAdded) return prev;
      return [...prev, leg];
    });
  }, []);

  const removeLeg = useCallback((index: number) => {
    setLegs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearLegs = useCallback(() => setLegs([]), []);

  return {
    legs,
    addLeg,
    removeLeg,
    clearLegs,
    probability: probabilityQuery.data,
    probabilityLoading: probabilityQuery.isLoading,
    save: saveMutation.mutateAsync,
    saving: saveMutation.isPending,
  };
}
