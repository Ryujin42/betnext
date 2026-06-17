import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Button, Card, Modal } from '@betnext/ui';
import { getEvent, getOutcomes, type EventSummary, type Outcome } from '../api/events';
import { placeBet } from '../api/bets';
import { ApiException } from '../api/client';
import { useWalletStore } from '../store/wallet';
import { useLiveOddsStore } from '../store/live-odds';

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatStart(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export function EventPage() {
  const { eventId } = useParams({ strict: false }) as { eventId: string };
  const id = Number(eventId);

  const eventQ = useQuery<EventSummary>({
    queryKey: ['events', id],
    queryFn: () => getEvent(id),
  });
  const outcomesQ = useQuery<Outcome[]>({
    queryKey: ['events', id, 'outcomes'],
    queryFn: () => getOutcomes(id),
    // Rafraîchit toutes les 5s en attendant les cotes live WebSocket (T9.3).
    refetchInterval: 5_000,
  });

  const [picked, setPicked] = useState<Outcome | null>(null);

  if (eventQ.isLoading) return <p className="text-sm text-ink-300">Chargement…</p>;
  if (eventQ.isError || !eventQ.data) {
    return (
      <Card>
        <p className="text-sm text-red-300">Évènement introuvable.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-brand-500 hover:underline">
          ← Retour au catalogue
        </Link>
      </Card>
    );
  }

  const ev = eventQ.data;
  const outcomes = outcomesQ.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Link to="/" className="text-sm text-ink-300 hover:text-brand-500">
        ← Catalogue
      </Link>

      <header className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-brand-500">
          {ev.status === 'PUBLIE' ? 'Ouvert aux paris' : ev.status}
        </span>
        <h1 className="text-3xl font-bold text-ink-50">{ev.name}</h1>
        <p className="text-sm text-ink-300">Début : {formatStart(ev.startDate)}</p>
      </header>

      <Card
        title="Issues pariables"
        hint={outcomes.length ? `${outcomes.length} possibilités` : ''}
      >
        {outcomes.length === 0 && (
          <p className="text-sm text-ink-300">Aucune issue n'est définie pour cet évènement.</p>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {outcomes.map((o) => (
            <OutcomeCard
              key={o.id}
              outcome={o}
              disabled={ev.status !== 'PUBLIE'}
              onPick={() => setPicked(o)}
            />
          ))}
        </div>
      </Card>

      {picked && <PlaceBetModal outcome={picked} eventId={id} onClose={() => setPicked(null)} />}
    </div>
  );
}

function OutcomeCard({
  outcome,
  disabled,
  onPick,
}: {
  outcome: Outcome;
  disabled: boolean;
  onPick: () => void;
}) {
  const liveOdds = useLiveOddsStore((s) => s.odds.get(outcome.id));
  const odds = liveOdds ?? Number(outcome.odds);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="group flex items-center justify-between rounded-xl border border-surface-200 bg-surface-100 p-4 text-left transition-colors hover:border-brand-500/60 hover:bg-surface-100/80 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-surface-200"
    >
      <span className="font-medium text-ink-50">{outcome.label}</span>
      <span className="rounded-lg bg-brand-500/15 px-3 py-1 text-lg font-semibold text-brand-100 group-hover:bg-brand-500/25">
        {odds.toFixed(2)}
      </span>
    </button>
  );
}

function PlaceBetModal({
  outcome,
  eventId,
  onClose,
}: {
  outcome: Outcome;
  eventId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const setBalance = useWalletStore((s) => s.setBalance);
  const balance = useWalletStore((s) => s.balance);
  const liveOdds = useLiveOddsStore((s) => s.odds.get(outcome.id));
  const odds = liveOdds ?? Number(outcome.odds);

  const [amountStr, setAmountStr] = useState('5');
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountStr);
  const potential = amount > 0 ? amount * odds : 0;

  const mut = useMutation({
    mutationFn: () => placeBet({ outcomeId: outcome.id, amount }),
    onSuccess: () => {
      // Solde déduit optimistement, sera réconcilié par la requête /wallet/balance.
      if (balance !== null) setBalance(balance - amount);
      qc.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      qc.invalidateQueries({ queryKey: ['bets', 'mine'] });
      qc.invalidateQueries({ queryKey: ['events', eventId, 'outcomes'] });
      onClose();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiException) {
        const code = err.body?.errorCode;
        if (code === 'WAL_003' || code === 'BET_003') {
          setError('Solde insuffisant pour ce pari.');
          return;
        }
        if (code === 'BET_004' || code === 'BET_005') {
          setError('Limite de mise atteinte (jeu responsable).');
          return;
        }
        if (code === 'BET_006') {
          setError('La cote vient de changer — vérifie le nouveau taux avant de valider.');
          return;
        }
        if (code === 'BET_002') {
          setError("L'évènement a déjà commencé, les paris sont fermés.");
          return;
        }
        setError(err.body?.message ?? 'Pari refusé.');
        return;
      }
      setError('Erreur réseau, réessaie.');
    },
  });

  return (
    <Modal open onClose={onClose} title={outcome.label} width="max-w-md">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-ink-300">Cote</span>
        <span className="rounded-lg bg-brand-500/15 px-3 py-1 text-lg font-semibold text-brand-100">
          {odds.toFixed(2)}
        </span>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-300">Mise (€)</span>
        <input
          type="number"
          min={0.01}
          step={0.01}
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
        />
      </label>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2 text-sm">
        <span className="text-ink-300">Gain potentiel</span>
        <span className="text-lg font-semibold text-ink-50">{formatEur(potential)}</span>
      </div>

      {balance !== null && (
        <p className="mt-2 text-xs text-ink-300">Solde actuel : {formatEur(balance)}</p>
      )}

      {error && (
        <div className="mt-3 rounded-lg bg-danger-500/15 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button
          disabled={!(amount > 0)}
          loading={mut.isPending}
          onClick={() => {
            setError(null);
            mut.mutate();
          }}
        >
          Confirmer le pari
        </Button>
      </div>
    </Modal>
  );
}
