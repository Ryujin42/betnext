/**
 * Concatène des classes utilitaires (style Tailwind) en filtrant les valeurs
 * fausses. Équivalent minimal de `clsx`/`classnames` — évite la dépendance.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
