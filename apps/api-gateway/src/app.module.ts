import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AdminController } from './admin/admin.controller';
import { AuthModule } from './auth/auth.module';
import { BetsController } from './bets/bets.controller';
import { BetNextExceptionFilter } from './common/exceptions/betnext-exception.filter';
import { EventsController } from './events/events.controller';
import { HealthController } from './health/health.controller';
import { ProxyModule } from './proxy/proxy.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsersController } from './users/users.controller';
import { WalletController } from './wallet/wallet.controller';
import { WalletWebhookController } from './wallet/wallet-webhook.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    ProxyModule,
    RealtimeModule,
  ],
  controllers: [
    HealthController,
    UsersController,
    AdminController,
    EventsController,
    BetsController,
    WalletController,
    WalletWebhookController,
  ],
  providers: [{ provide: APP_FILTER, useClass: BetNextExceptionFilter }],
})
export class AppModule {}
