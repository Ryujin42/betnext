import { Card } from '@betnext/ui';

export function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink-50">Dashboard</h1>
      <Card title="KPI à venir" hint="T8.2">
        <p className="text-sm text-ink-300">
          Volume de paris, utilisateurs actifs, évènements par statut — branchement sur `GET
          /admin/kpis` au prochain commit.
        </p>
      </Card>
    </div>
  );
}
