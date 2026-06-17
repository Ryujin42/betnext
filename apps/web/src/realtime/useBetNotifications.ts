import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './socket';

export interface BetNotification {
  type: 'won' | 'lost';
  betId: number;
  amount: number;
  payout: number;
  receivedAt: number;
}

/**
 * Reçoit les notifs `bet.won` / `bet.lost` adressées à l'utilisateur courant
 * (Lot 9 T9.3, salle `user:<id>` côté gateway). Invalide les requêtes solde
 * et historique pour synchroniser l'UI sans recharger.
 */
export function useBetNotifications(): BetNotification | null {
  const qc = useQueryClient();
  const [last, setLast] = useState<BetNotification | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      qc.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
      qc.invalidateQueries({ queryKey: ['bets', 'mine'] });
    };

    interface Payload {
      betId: number;
      amount: number;
      payout: number;
    }
    const onWon = (payload: Payload) => {
      setLast({ type: 'won', ...payload, receivedAt: Date.now() });
      refresh();
    };
    const onLost = (payload: Payload) => {
      setLast({ type: 'lost', ...payload, receivedAt: Date.now() });
      refresh();
    };

    socket.on('bet.won', onWon);
    socket.on('bet.lost', onLost);

    return () => {
      socket.off('bet.won', onWon);
      socket.off('bet.lost', onLost);
    };
  }, [qc]);

  return last;
}
