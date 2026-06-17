import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from './payment.interface';
import { MockStripeProvider } from './mock-stripe.provider';
import { RealStripeProvider } from './real-stripe.provider';

/**
 * Sélectionne le PSP selon `PAYMENT_PROVIDER` (`mock` par défaut, `real` pour
 * Stripe). Les deux implémentations partagent {@link IPaymentProvider}, donc le
 * basculement ne touche aucun consommateur.
 */
@Module({
  providers: [
    MockStripeProvider,
    RealStripeProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, MockStripeProvider, RealStripeProvider],
      useFactory: (config: ConfigService, mock: MockStripeProvider, real: RealStripeProvider) =>
        config.get<string>('PAYMENT_PROVIDER') === 'real' ? real : mock,
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentModule {}
