import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdaptersModule } from './adapters/adapters.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AdaptersModule],
})
export class AppModule {}
