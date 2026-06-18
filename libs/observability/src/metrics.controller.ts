import { Controller, Get, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { BetNextMetrics } from './metrics.service';

/**
 * Expose `GET /metrics` au format texte Prometheus pour le scraping (T11.2).
 * Endpoint technique non authentifié, destiné au réseau interne / Prometheus.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: BetNextMetrics) {}

  @Get()
  async scrape(@Res() reply: FastifyReply): Promise<void> {
    const body = await this.metrics.render();
    await reply.header('Content-Type', this.metrics.contentType).send(body);
  }
}
