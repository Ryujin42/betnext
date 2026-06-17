import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MessagingModule } from '@betnext/shared-events';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Module WebSocket du gateway (Lot 9 T9.3). Réutilise `MessagingModule.forRoot()`
 * pour brancher l'`IEventBus` (Redis Pub/Sub en runtime) et reposer dessus pour
 * relayer les évènements bus vers les clients connectés.
 */
@Module({
  imports: [
    MessagingModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
