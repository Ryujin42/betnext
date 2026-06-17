import { clampOdds, ODDS_DEFAULT } from './validation';

/**
 * Calcul des cotes (T5.2). Cote décimale d'une issue :
 *
 *   cote = total misé sur l'événement / total misé sur l'issue
 *
 * Une issue qui concentre beaucoup de mises (favorite) tend vers une cote
 * basse ; une issue peu jouée vers une cote haute. Le résultat est borné dans
 * l'intervalle métier `[ODDS_MIN, ODDS_MAX]` (via {@link clampOdds}) et arrondi
 * à 2 décimales. Sans mise sur l'issue (ou sur l'événement), on renvoie
 * {@link ODDS_DEFAULT}.
 */

/** Arrondi commercial à 2 décimales (évite les artefacts flottants). */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * @param totalEventStake total misé sur l'ensemble des issues de l'événement.
 * @param totalOutcomeStake total misé sur l'issue concernée.
 */
export function computeOdds(totalEventStake: number, totalOutcomeStake: number): number {
  if (totalOutcomeStake <= 0 || totalEventStake <= 0) {
    return ODDS_DEFAULT;
  }
  return round2(clampOdds(totalEventStake / totalOutcomeStake));
}
