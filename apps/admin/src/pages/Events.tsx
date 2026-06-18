import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Modal, Table, TableCell, TableHead, TableRow } from '@betnext/ui';
import {
  addOutcome,
  cancelEvent,
  closeEvent,
  createEvent,
  getOutcomes,
  importLive,
  importPersistOne,
  listEvents,
  publishEvent,
  setResult,
  type EventDto,
  type ImportedEvent,
  type OutcomeDto,
} from '../api/events';
import { ApiException } from '../api/client';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_COLORS: Record<string, string> = {
  BROUILLON: 'bg-surface-300 text-ink-300',
  PUBLIE: 'bg-brand-500/20 text-brand-100',
  FERME: 'bg-warning-500/20 text-amber-300',
  TERMINE: 'bg-success-500/20 text-emerald-300',
  ANNULE: 'bg-danger-500/20 text-red-300',
};

export function EventsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [detail, setDetail] = useState<EventDto | null>(null);

  const eventsQuery = useQuery<EventDto[]>({
    queryKey: ['admin', 'events'],
    queryFn: listEvents,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-50">Évènements</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)}>
            Importer LoL
          </Button>
          <Button onClick={() => setCreating(true)}>Nouvel évènement</Button>
        </div>
      </header>

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell header>ID</TableCell>
              <TableCell header>Nom</TableCell>
              <TableCell header>Début</TableCell>
              <TableCell header>Statut</TableCell>
              <TableCell header />
            </TableRow>
          </TableHead>
          <tbody>
            {(eventsQuery.data ?? []).map((ev) => (
              <TableRow key={ev.id}>
                <TableCell>{ev.id}</TableCell>
                <TableCell>{ev.name}</TableCell>
                <TableCell>{formatDate(ev.startDate)}</TableCell>
                <TableCell>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs ${STATUS_COLORS[ev.status] ?? 'bg-surface-200'}`}
                  >
                    {ev.status}
                  </span>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => setDetail(ev)}>
                    Détails
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {eventsQuery.data?.length === 0 && !eventsQuery.isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-300">
                  Aucun évènement.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {creating && (
        <CreateEventModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'events'] });
            setCreating(false);
          }}
        />
      )}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {detail && <EventDetailModal event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [tournamentId, setTournamentId] = useState('1');
  const [gameId, setGameId] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () =>
      createEvent({
        name,
        startDate: new Date(startDate).toISOString(),
        tournamentId: Number(tournamentId),
        gameId: Number(gameId),
      }),
    onSuccess: () => onCreated(),
    onError: (err: unknown) => {
      setError(err instanceof ApiException ? (err.body?.message ?? 'Erreur') : 'Erreur réseau.');
    },
  });

  return (
    <Modal open onClose={onClose} title="Nouvel évènement" width="max-w-md">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mut.mutate();
        }}
      >
        <Field label="Nom">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
          />
        </Field>
        <Field label="Date de début">
          <input
            type="datetime-local"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tournoi (ID)">
            <input
              type="number"
              min={1}
              required
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Jeu (ID)">
            <input
              type="number"
              min={1}
              required
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </Field>
        </div>
        {error && (
          <div className="rounded-lg bg-danger-500/15 px-3 py-2 text-sm text-red-300">{error}</div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const query = useQuery<ImportedEvent[]>({
    queryKey: ['admin', 'events', 'import', 'lol'],
    queryFn: () => importLive('lol'),
  });

  return (
    <Modal open onClose={onClose} title="Import — adaptateur LoL" width="max-w-2xl">
      <p className="mb-3 text-xs text-ink-300">
        Clique sur un match pour l'ajouter en <strong>BROUILLON</strong>. Il apparaîtra dans la
        liste des événements, prêt à être publié.
      </p>
      {query.isLoading && <p className="text-sm text-ink-300">Récupération…</p>}
      {query.isError && (
        <p className="text-sm text-red-300">
          Impossible d'interroger l'adaptateur (token manquant ou API en erreur).
        </p>
      )}
      {query.data && query.data.length === 0 && (
        <p className="text-sm text-ink-300">Aucun évènement disponible.</p>
      )}
      <ul className="flex flex-col gap-2">
        {(query.data ?? []).map((ev) => (
          <ImportRow key={ev.externalId} event={ev} />
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>Fermer</Button>
      </div>
    </Modal>
  );
}

function ImportRow({ event }: { event: ImportedEvent }) {
  const qc = useQueryClient();
  const [state, setState] = useState<'idle' | 'created' | 'duplicate' | 'error'>('idle');
  const mut = useMutation({
    mutationFn: () => importPersistOne('lol', event.externalId),
    onSuccess: (res) => {
      setState(res.created ? 'created' : 'duplicate');
      qc.invalidateQueries({ queryKey: ['admin', 'events'] });
    },
    onError: () => setState('error'),
  });

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm">
      <div className="flex-1">
        <div className="font-medium text-ink-50">{event.name}</div>
        <div className="text-xs text-ink-300">
          {event.tournament} · {event.game.toUpperCase()} · {formatDate(event.startDate)}
        </div>
        <div className="text-xs text-ink-300">Équipes : {event.teams.join(' vs ')}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          variant={state === 'created' || state === 'duplicate' ? 'ghost' : 'secondary'}
          onClick={() => mut.mutate()}
          disabled={mut.isPending || state === 'created' || state === 'duplicate'}
        >
          {mut.isPending
            ? 'Import…'
            : state === 'created'
              ? 'Ajouté'
              : state === 'duplicate'
                ? 'Déjà présent'
                : 'Importer'}
        </Button>
        {state === 'error' && <span className="text-xs text-red-300">Erreur</span>}
      </div>
    </li>
  );
}

function EventDetailModal({ event, onClose }: { event: EventDto; onClose: () => void }) {
  const qc = useQueryClient();
  const outcomesQ = useQuery<OutcomeDto[]>({
    queryKey: ['admin', 'events', event.id, 'outcomes'],
    queryFn: () => getOutcomes(event.id),
  });

  const [label, setLabel] = useState('');
  const [odds, setOdds] = useState('2.00');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'events'] });
    qc.invalidateQueries({ queryKey: ['admin', 'events', event.id, 'outcomes'] });
  };
  const publishMut = useMutation({ mutationFn: () => publishEvent(event.id), onSuccess: refresh });
  const closeMut = useMutation({ mutationFn: () => closeEvent(event.id), onSuccess: refresh });
  const cancelMut = useMutation({ mutationFn: () => cancelEvent(event.id), onSuccess: refresh });
  const addOutcomeMut = useMutation({
    mutationFn: () =>
      addOutcome(event.id, {
        label,
        odds: Number(odds),
        condition: { type: 'manual' },
      }),
    onSuccess: () => {
      setLabel('');
      refresh();
    },
  });
  const setResultMut = useMutation({
    mutationFn: (outcomeId: number) => setResult(event.id, { winnerOutcomeId: outcomeId }),
    onSuccess: refresh,
  });

  return (
    <Modal open onClose={onClose} title={event.name} width="max-w-3xl">
      <div className="mb-4 flex items-center gap-3 text-sm">
        <span
          className={`rounded-md px-2 py-0.5 text-xs ${STATUS_COLORS[event.status] ?? 'bg-surface-200'}`}
        >
          {event.status}
        </span>
        <span className="text-ink-300">Début : {formatDate(event.startDate)}</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={event.status !== 'BROUILLON'}
          loading={publishMut.isPending}
          onClick={() => publishMut.mutate()}
        >
          Publier
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={event.status !== 'PUBLIE'}
          loading={closeMut.isPending}
          onClick={() => closeMut.mutate()}
        >
          Fermer
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={event.status === 'TERMINE' || event.status === 'ANNULE'}
          loading={cancelMut.isPending}
          onClick={() => cancelMut.mutate()}
        >
          Annuler
        </Button>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-ink-100">Issues pariables</h3>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell header>Libellé</TableCell>
            <TableCell header>Cote</TableCell>
            <TableCell header>Statut</TableCell>
            <TableCell header />
          </TableRow>
        </TableHead>
        <tbody>
          {(outcomesQ.data ?? []).map((o) => (
            <TableRow key={o.id}>
              <TableCell>{o.label}</TableCell>
              <TableCell>{Number(o.odds).toFixed(2)}</TableCell>
              <TableCell>
                {o.isWinner === true && (
                  <span className="rounded-md bg-success-500/20 px-2 py-0.5 text-xs text-emerald-300">
                    Gagnant
                  </span>
                )}
                {o.isWinner === false && (
                  <span className="rounded-md bg-surface-200 px-2 py-0.5 text-xs text-ink-300">
                    Perdant
                  </span>
                )}
                {o.isWinner === null && (
                  <span className="rounded-md bg-surface-200 px-2 py-0.5 text-xs text-ink-300">
                    Pendant
                  </span>
                )}
              </TableCell>
              <TableCell>
                {event.status === 'FERME' && o.isWinner === null && (
                  <Button
                    size="sm"
                    loading={setResultMut.isPending}
                    onClick={() => setResultMut.mutate(o.id)}
                  >
                    Désigner gagnant
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>

      {event.status === 'BROUILLON' && (
        <div className="mt-4 grid grid-cols-[1fr_auto_auto] items-end gap-2 text-sm">
          <Field label="Nouveau libellé">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="T1 gagne"
              className="rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Field label="Cote">
            <input
              type="number"
              step={0.01}
              min={1.01}
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              className="w-24 rounded-lg border border-surface-300 bg-surface-200 px-3 py-2 text-ink-50 focus:border-brand-500 focus:outline-none"
            />
          </Field>
          <Button
            disabled={!label}
            loading={addOutcomeMut.isPending}
            onClick={() => addOutcomeMut.mutate()}
          >
            Ajouter
          </Button>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-300">{label}</span>
      {children}
    </label>
  );
}
