/**
 * Manipulation monétaire en **centimes entiers** pour éviter les erreurs de
 * flottants (`0.1 + 0.2 !== 0.3`). Un montant en euros est converti en
 * centimes dès l'entrée, puis toute l'arithmétique se fait sur des entiers.
 */
export type Cents = number;

export function toCents(euros: number): Cents {
  return Math.round(euros * 100);
}

export function fromCents(cents: Cents): number {
  return cents / 100;
}

export function addCents(a: Cents, b: Cents): Cents {
  return a + b;
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return a - b;
}

/**
 * Applique une cote décimale à une mise (en centimes) et renvoie le gain brut
 * arrondi au centime le plus proche.
 */
export function applyOdds(stakeCents: Cents, odds: number): Cents {
  return Math.round(stakeCents * odds);
}

export function formatEuros(cents: Cents, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
