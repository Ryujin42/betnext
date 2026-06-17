import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@betnext/ui';
import { listEvents, type EventSummary } from '../api/events';

function formatStart(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Aujourd'hui · ${time}`;
  return `${date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${time}`;
}

export function CatalogPage() {
  const eventsQ = useQuery<EventSummary[]>({
    queryKey: ['events', 'list'],
    queryFn: listEvents,
  });

  const publishedEvents = (eventsQ.data ?? []).filter((e) => e.status === 'PUBLIE');

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold text-ink-50">Évènements à venir</h1>
        <p className="mt-1 text-sm text-ink-300">
          Choisis un évènement pour voir les cotes et placer ton pari.
        </p>
      </header>

      {eventsQ.isLoading && <p className="text-sm text-ink-300">Chargement…</p>}
      {eventsQ.isError && (
        <Card>
          <p className="text-sm text-red-300">
            Impossible de récupérer le catalogue, réessaie dans un instant.
          </p>
        </Card>
      )}

      {!eventsQ.isLoading && publishedEvents.length === 0 && (
        <Card>
          <p className="text-sm text-ink-300">Aucun évènement ouvert aux paris pour le moment.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {publishedEvents.map((ev) => (
          <Link
            key={ev.id}
            to="/events/$eventId"
            params={{ eventId: String(ev.id) }}
            className="group"
          >
            <Card className="h-full transition-colors group-hover:border-brand-500/60">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-md bg-brand-500/20 px-2 py-0.5 text-xs uppercase tracking-wide text-brand-100">
                  Ouvert
                </span>
                <span className="text-xs text-ink-300">{formatStart(ev.startDate)}</span>
              </div>
              <h2 className="text-lg font-semibold text-ink-50 group-hover:text-brand-100">
                {ev.name}
              </h2>
              <p className="mt-2 text-xs text-ink-300">Cliquer pour voir les cotes.</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
