import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RgProfileEntity, UserEntity } from '@betnext/database';
import { AccountStatusService } from './account-status.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, RgProfileEntity])],
  providers: [AccountStatusService],
  exports: [AccountStatusService],
})
export class AccountStatusModule {}
