import { Card } from '@betnext/ui';

export function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-ink-50">Mon profil</h1>
      <Card title="Profil à venir" hint="T9.4">
        <p className="text-sm text-ink-300">
          Historique paris/transactions, stats personnelles, gestion des limites RG.
        </p>
      </Card>
    </div>
  );
}
