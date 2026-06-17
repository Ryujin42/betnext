import { Card } from '@betnext/ui';

export function CatalogPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-ink-50">Évènements à venir</h1>
      <Card title="Catalogue à venir" hint="T9.2">
        <p className="text-sm text-ink-300">
          La liste des évènements PUBLIE et le tunnel de placement seront branchés au prochain
          commit.
        </p>
      </Card>
    </div>
  );
}
