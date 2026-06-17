import { Card } from '@betnext/ui';

export function EventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink-50">Évènements</h1>
      <Card title="Gestion à venir" hint="T8.4">
        <p className="text-sm text-ink-300">
          Création / édition d'évènements et d'outcomes, import depuis l'adapter mocké, saisie des
          résultats.
        </p>
      </Card>
    </div>
  );
}
