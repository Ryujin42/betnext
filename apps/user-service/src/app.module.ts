import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin/admin.controller';
import { AuthModule } from './auth/auth.module';
import { BetNextExceptionFilter } from './common/exceptions/betnext-exception.filter';
import { databaseConfigFactory } from './config/database.config';
import { HealthController } from './health/health.controller';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfigFactory }),
    AuthModule,
    UsersModule,
  ],
  controllers: [HealthController, AdminController],
  providers: [{ provide: APP_FILTER, useClass: BetNextExceptionFilter }],
})
export class AppModule {}
