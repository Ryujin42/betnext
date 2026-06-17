import { Module } from '@nestjs/common';
import { NotificationWorker } from './notification.worker';

@Module({
  providers: [NotificationWorker],
})
export class NotificationModule {}
