import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RelayService } from './relay.service';

@Module({
  imports: [HttpModule.register({ timeout: 5000, maxRedirects: 0 })],
  providers: [RelayService],
  exports: [RelayService],
})
export class ProxyModule {}
