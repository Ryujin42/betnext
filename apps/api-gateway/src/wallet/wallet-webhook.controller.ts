import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RelayService } from '../proxy/relay.service';

/**
 * Webhook PSP (Lot 6) — **public**, sans JWT : appelé par le prestataire de
 * paiement, pas par un utilisateur. Relayé tel quel au wallet-service (qui
 * vérifie/parse et crédite de façon idempotente).
 */
@Controller('wallet/webhook')
export class WalletWebhookController {
  constructor(private readonly relay: RelayService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  handle(@Body() body: unknown, @Headers('stripe-signature') signature?: string): Promise<unknown> {
    const headers = signature ? { 'stripe-signature': signature } : undefined;
    return this.relay.forwardToWalletService('POST', '/wallet/webhook', { body, headers });
  }
}
