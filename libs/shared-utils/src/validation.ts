/** Bornes métier des cotes (cf. BETNEXT_CONTEXT §6). */
export const ODDS_MIN = 1.1;
export const ODDS_MAX = 5.0;
export const ODDS_DEFAULT = 1.5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Borne une cote dans l'intervalle métier [1.10 – 5.00]. */
export function clampOdds(odds: number): number {
  return clamp(odds, ODDS_MIN, ODDS_MAX);
}
