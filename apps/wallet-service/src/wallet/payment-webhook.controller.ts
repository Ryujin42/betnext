import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { IPaymentProvider, PAYMENT_PROVIDER } from '../payment/payment.interface';

/**
 * Endpoint webhook du PSP (T6.2). **Public** : un webhook provient du prestataire
 * de paiement, pas d'un utilisateur authentifié (le vrai provider vérifierait la
 * signature). Le crédit est idempotent côté {@link WalletService}.
 */
@Controller('wallet/webhook')
export class PaymentWebhookController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly payment: IPaymentProvider,
    private readonly wallet: WalletService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Body() body: unknown,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true; credited: boolean }> {
    const event = this.payment.parseWebhook(body, signature);
    const result = await this.wallet.applyDepositEvent(event);
    return { received: true, credited: result.credited };
  }
}
