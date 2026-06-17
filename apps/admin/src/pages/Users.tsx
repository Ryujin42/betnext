import { Card } from '@betnext/ui';

export function UsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink-50">Utilisateurs</h1>
      <Card title="Gestion à venir" hint="T8.3">
        <p className="text-sm text-ink-300">
          Liste paginée, suspension de compte, consultation du profil RG.
        </p>
      </Card>
    </div>
  );
}
