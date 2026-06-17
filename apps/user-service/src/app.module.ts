import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '@betnext/shared-events';
import { AdminController } from './admin/admin.controller';
import { KpisService } from './admin/kpis.service';
import { UsersAdminService } from './admin/users-admin.service';
import { AuthModule } from './auth/auth.module';
import { BetNextExceptionFilter } from './common/exceptions/betnext-exception.filter';
import { databaseConfigFactory, UserEntity } from '@betnext/database';
import { HealthController } from './health/health.controller';
import { RgProfilesModule } from './rg/rg-profiles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfigFactory }),
    MessagingModule.forRoot(),
    TypeOrmModule.forFeature([UserEntity]),
    AuthModule,
    UsersModule,
    RgProfilesModule,
  ],
  controllers: [HealthController, AdminController],
  providers: [
    { provide: APP_FILTER, useClass: BetNextExceptionFilter },
    KpisService,
    UsersAdminService,
  ],
})
export class AppModule {}
