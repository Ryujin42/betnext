import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, KpiCard } from '@betnext/ui';
import { fetchKpis, type AdminKpis } from '../api/admin';

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function Dashboard() {
  const query = useQuery<AdminKpis>({ queryKey: ['admin', 'kpis'], queryFn: fetchKpis });

  if (query.isLoading) {
    return <div className="text-sm text-ink-300">Chargement des KPI…</div>;
  }
  if (query.isError || !query.data) {
    return (
      <Card title="Erreur">
        <p className="text-sm text-red-300">Impossible de charger les KPI.</p>
      </Card>
    );
  }

  const kpis = query.data;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink-50">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Volume de paris" value={kpis.totalBets} delta="Tous statuts" />
        <KpiCard
          label="Volume misé"
          value={formatEur(kpis.totalStakedEur)}
          delta="Hors paris annulés"
        />
        <KpiCard label="Joueurs actifs 30j" value={kpis.activeUsers} delta="Au moins 1 pari" />
        <KpiCard
          label="Évènements"
          value={kpis.eventsByStatus.reduce((acc, e) => acc + e.count, 0)}
          delta={`${kpis.eventsByStatus.length} statuts`}
        />
      </div>

      <Card title="Volume misé — 30 derniers jours" hint="€/jour">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kpis.stakedPerDay} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232c45" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#98a2bd', fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis
                tick={{ fill: '#98a2bd', fontSize: 11 }}
                tickFormatter={(v: number) => `${v}€`}
              />
              <Tooltip
                contentStyle={{
                  background: '#11172a',
                  border: '1px solid #232c45',
                  borderRadius: 8,
                  color: '#e3e7f1',
                }}
                labelStyle={{ color: '#98a2bd' }}
                formatter={(v: number) => [formatEur(v), 'Misé']}
              />
              <Line type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Évènements par statut">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {kpis.eventsByStatus.map((s) => (
            <div key={s.status} className="rounded-lg border border-surface-200 p-3">
              <div className="text-xs uppercase tracking-wide text-ink-300">{s.status}</div>
              <div className="text-2xl font-semibold text-ink-50">{s.count}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
