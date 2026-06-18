import { create } from 'zustand';

interface WalletState {
  balance: number | null;
  /** Mise à jour optimiste (placement de pari, dépôt). */
  setBalance: (amount: number) => void;
  reset: () => void;
}

/**
 * Solde courant côté client. Hydraté depuis `GET /wallet/balance` (React
 * Query) ; les mutations (pari, dépôt) peuvent l'écraser optimistement pour
 * un retour visuel instantané, puis être réconciliées par invalidation.
 */
export const useWalletStore = create<WalletState>((set) => ({
  balance: null,
  setBalance: (amount) => set({ balance: amount }),
  reset: () => set({ balance: null }),
}));
