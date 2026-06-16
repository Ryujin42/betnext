import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AdminController } from './admin/admin.controller';
import { AuthModule } from './auth/auth.module';
import { BetNextExceptionFilter } from './common/exceptions/betnext-exception.filter';
import { EventsController } from './events/events.controller';
import { HealthController } from './health/health.controller';
import { ProxyModule } from './proxy/proxy.module';
import { UsersController } from './users/users.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    ProxyModule,
  ],
  controllers: [HealthController, UsersController, AdminController, EventsController],
  providers: [{ provide: APP_FILTER, useClass: BetNextExceptionFilter }],
})
export class AppModule {}
