import { Card } from '@betnext/ui';

export function EventPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card title="Évènement — détail" hint="T9.2 / T9.3">
        <p className="text-sm text-ink-300">
          Affichage des outcomes avec cotes (live WebSocket T9.3) + tunnel de placement.
        </p>
      </Card>
    </div>
  );
}
