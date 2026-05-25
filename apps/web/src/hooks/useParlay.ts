"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ParlayLeg, ParlayResult } from "@sharp-edge/shared";
import { api } from "@/lib/api";
import { useParlayStore } from "@/store/parlayStore";

export function useParlay() {
  const queryClient = useQueryClient();
  const { legs, addLeg, removeLeg, clearLegs } = useParlayStore();

  const probabilityQuery = useQuery({
    queryKey: ["parlay-probability", legs],
    queryFn: () => api.post<ParlayResult>("/api/parlays/probability", { legs }),
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
