"use client";

import { create } from "zustand";
import type { ParlayLeg } from "@sharp-edge/shared";

interface ParlayStore {
  legs: ParlayLeg[];
  addLeg: (leg: ParlayLeg) => void;
  removeLeg: (index: number) => void;
  clearLegs: () => void;
}

export const useParlayStore = create<ParlayStore>((set) => ({
  legs: [],

  addLeg: (leg) =>
    set((state) => {
      const exists = state.legs.some(
        (l) => l.gameId === leg.gameId && l.market === leg.market && l.label === leg.label
      );
      return exists ? state : { legs: [...state.legs, leg] };
    }),

  removeLeg: (index) =>
    set((state) => ({ legs: state.legs.filter((_, i) => i !== index) })),

  clearLegs: () => set({ legs: [] }),
}));
