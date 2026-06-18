import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/** Statut comptabilisé par `betnext_bets_total`. */
export type BetMetricStatus = 'placed' | 'won' | 'lost';

/**
 * Métriques techniques BetNext (T11.2), exposées au format Prometheus.
 *
 * **Distinct de l'audit** (CONTEXT §11) : le monitoring sert la supervision
 * temps réel (latence, volume, erreurs) et est purgeable ; l'audit
 * (`audit_logs`) est immuable et conservé 5 ans.
 *
 * Chaque instance possède son **propre `Registry`** (au lieu du registre global
 * de prom-client) : pas de collision de noms si plusieurs instances coexistent
 * (tests), et le label `service` est appliqué par défaut à toutes les séries.
 * Les métriques par défaut du process Node (CPU, mémoire, event loop) sont
 * collectées en plus des 6 métriques métier du CONTEXT.
 */
export class BetNextMetrics {
  readonly registry: Registry;

  /** `betnext_bets_total` — nombre de paris par statut (placed / won / lost). */
  private readonly betsTotal: Counter<'status'>;
  /** `betnext_bet_amount_sum` — volume financier total misé (€). */
  private readonly betAmountSum: Counter<string>;
  /** `betnext_odds_calculation_duration_ms` — latence de recalcul des cotes. */
  private readonly oddsCalculationDuration: Histogram<string>;
  /** `betnext_active_users_gauge` — utilisateurs connectés en temps réel (WebSocket). */
  private readonly activeUsers: Gauge<string>;
  /** `betnext_stripe_webhook_errors_total` — échecs de webhook paiement (mock). */
  private readonly stripeWebhookErrors: Counter<string>;
  /** `betnext_rg_limit_hits_total` — limites jeu responsable atteintes, par type. */
  private readonly rgLimitHits: Counter<'limit'>;

  constructor(service: string) {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ service });
    collectDefaultMetrics({ register: this.registry });

    this.betsTotal = new Counter({
      name: 'betnext_bets_total',
      help: 'Nombre de paris par statut',
      labelNames: ['status'],
      registers: [this.registry],
    });
    this.betAmountSum = new Counter({
      name: 'betnext_bet_amount_sum',
      help: 'Volume financier total misé (euros)',
      registers: [this.registry],
    });
    this.oddsCalculationDuration = new Histogram({
      name: 'betnext_odds_calculation_duration_ms',
      help: 'Durée de recalcul des cotes en millisecondes',
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });
    this.activeUsers = new Gauge({
      name: 'betnext_active_users_gauge',
      help: 'Utilisateurs connectés en temps réel (WebSocket)',
      registers: [this.registry],
    });
    this.stripeWebhookErrors = new Counter({
      name: 'betnext_stripe_webhook_errors_total',
      help: 'Nombre d’échecs de traitement de webhook paiement (mock)',
      registers: [this.registry],
    });
    this.rgLimitHits = new Counter({
      name: 'betnext_rg_limit_hits_total',
      help: 'Nombre de fois qu’une limite jeu responsable a été atteinte',
      labelNames: ['limit'],
      registers: [this.registry],
    });
  }

  /** Un pari vient d'être placé : incrémente le compteur et le volume misé. */
  recordBetPlaced(amount: number): void {
    this.betsTotal.inc({ status: 'placed' });
    this.betAmountSum.inc(amount);
  }

  /** Un pari a été résolu (gagné/perdu). */
  recordBetResolved(status: 'won' | 'lost', count = 1): void {
    this.betsTotal.inc({ status }, count);
  }

  /** Observe la durée d'un recalcul de cotes (ms). */
  observeOddsCalculation(durationMs: number): void {
    this.oddsCalculationDuration.observe(durationMs);
  }

  /** Met à jour la jauge d'utilisateurs connectés (valeur absolue). */
  setActiveUsers(count: number): void {
    this.activeUsers.set(count);
  }

  incActiveUsers(): void {
    this.activeUsers.inc();
  }

  decActiveUsers(): void {
    this.activeUsers.dec();
  }

  /** Un webhook de paiement (mock) a échoué. */
  recordStripeWebhookError(): void {
    this.stripeWebhookErrors.inc();
  }

  /** Une limite jeu responsable a été atteinte (`daily_bet`, `weekly_bet`, `deposit`...). */
  recordRgLimitHit(limit: string): void {
    this.rgLimitHits.inc({ limit });
  }

  /** Rendu Prometheus texte de toutes les séries. */
  render(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type Prometheus à renvoyer sur `/metrics`. */
  get contentType(): string {
    return this.registry.contentType;
  }
}
