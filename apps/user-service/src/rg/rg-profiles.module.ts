import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RgProfileEntity } from '@betnext/database';
import { RgProfilesController } from './rg-profiles.controller';
import { RgProfilesService } from './rg-profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([RgProfileEntity])],
  controllers: [RgProfilesController],
  providers: [RgProfilesService],
  exports: [RgProfilesService],
})
export class RgProfilesModule {}
