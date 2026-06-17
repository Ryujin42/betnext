import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullMqModule, MessagingModule } from '@betnext/shared-events';
import { HealthController } from './health.controller';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    MessagingModule.forRoot(),
    BullMqModule.forRoot(),
    NotificationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
