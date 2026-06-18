import { create } from 'zustand';

interface LiveOddsState {
  /** Map outcomeId → cote live reçue par WebSocket. */
  odds: Map<number, number>;
  /** Met à jour les cotes d'un événement (Lot 9 T9.3). */
  apply: (updates: Array<{ outcomeId: number; odds: number }>) => void;
  reset: () => void;
}

/**
 * État live des cotes (Lot 9 T9.3). Alimenté par le hook `useLiveOdds` qui
 * écoute les events `odds.updated` du gateway. Une nouvelle Map est créée à
 * chaque update pour que les composants connectés se re-rendent (Zustand =
 * shallow-equal par défaut sur les valeurs primitives).
 */
export const useLiveOddsStore = create<LiveOddsState>((set) => ({
  odds: new Map(),
  apply: (updates) =>
    set((state) => {
      const next = new Map(state.odds);
      for (const u of updates) next.set(u.outcomeId, u.odds);
      return { odds: next };
    }),
  reset: () => set({ odds: new Map() }),
}));
