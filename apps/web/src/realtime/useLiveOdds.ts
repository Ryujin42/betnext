import { useEffect } from 'react';
import { useLiveOddsStore } from '../store/live-odds';
import { getSocket } from './socket';

interface OddsUpdatedEvent {
  eSportEventId: number;
  odds: Array<{ outcomeId: number; odds: number }>;
  occurredAt: string;
}

/**
 * Branche le client Socket.IO pour recevoir les cotes live d'un évènement
 * (Lot 9 T9.3). Quand le composant se démonte, on quitte la salle pour ne
 * plus recevoir de mises à jour.
 */
export function useLiveOdds(eSportEventId: number | null): void {
  const apply = useLiveOddsStore((s) => s.apply);

  useEffect(() => {
    if (eSportEventId === null) return;
    const socket = getSocket();

    const onOdds = (event: OddsUpdatedEvent) => {
      if (event.eSportEventId !== eSportEventId) return;
      apply(event.odds);
    };

    socket.emit('subscribeEvent', { eSportEventId });
    socket.on('odds.updated', onOdds);

    return () => {
      socket.off('odds.updated', onOdds);
      socket.emit('unsubscribeEvent', { eSportEventId });
    };
  }, [eSportEventId, apply]);
}
