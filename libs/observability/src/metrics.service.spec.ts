import 'reflect-metadata';
import { BetNextMetrics } from './metrics.service';

/**
 * T11.2 — vérifie que les métriques métier sont bien exposées au format
 * Prometheus avec le label `service`, et qu'un pic de paris est mesurable.
 */
describe('BetNextMetrics (T11.2)', () => {
  it('expose les 6 métriques métier avec le label service', async () => {
    const metrics = new BetNextMetrics('betting-service');
    const out = await metrics.render();
    for (const name of [
      'betnext_bets_total',
      'betnext_bet_amount_sum',
      'betnext_odds_calculation_duration_ms',
      'betnext_active_users_gauge',
      'betnext_stripe_webhook_errors_total',
      'betnext_rg_limit_hits_total',
    ]) {
      expect(out).toContain(name);
    }
    expect(out).toContain('service="betting-service"');
  });

  it('comptabilise les paris placés et le volume misé (pic de paris)', async () => {
    const metrics = new BetNextMetrics('betting-service');
    metrics.recordBetPlaced(25);
    metrics.recordBetPlaced(10);
    const out = await metrics.render();
    expect(out).toContain('betnext_bets_total{status="placed",service="betting-service"} 2');
    expect(out).toContain('betnext_bet_amount_sum{service="betting-service"} 35');
  });

  it('comptabilise résolutions, limites RG et erreurs webhook', async () => {
    const metrics = new BetNextMetrics('betting-service');
    metrics.recordBetResolved('won');
    metrics.recordBetResolved('lost', 3);
    metrics.recordRgLimitHit('daily_bet');
    metrics.recordStripeWebhookError();
    const out = await metrics.render();
    expect(out).toContain('betnext_bets_total{status="won",service="betting-service"} 1');
    expect(out).toContain('betnext_bets_total{status="lost",service="betting-service"} 3');
    expect(out).toContain(
      'betnext_rg_limit_hits_total{limit="daily_bet",service="betting-service"} 1',
    );
    expect(out).toContain('betnext_stripe_webhook_errors_total{service="betting-service"} 1');
  });

  it('met à jour la jauge d’utilisateurs connectés', async () => {
    const metrics = new BetNextMetrics('api-gateway');
    metrics.incActiveUsers();
    metrics.incActiveUsers();
    metrics.decActiveUsers();
    const out = await metrics.render();
    expect(out).toContain('betnext_active_users_gauge{service="api-gateway"} 1');
  });
});
