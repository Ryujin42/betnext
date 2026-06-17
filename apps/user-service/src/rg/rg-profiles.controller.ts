import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { IRgProfile } from '@betnext/shared-types';
import { InternalAuthGuard, type InternalUser } from '../common/internal-auth.guard';
import { Internal } from '../common/internal-user.decorator';
import { RgProfilesService } from './rg-profiles.service';
import { SelfExcludeDto } from './dto/self-exclude.dto';
import { UpdateRgLimitsDto } from './dto/update-limits.dto';

/**
 * Routes RG d'un utilisateur (T7.2). Auth au gateway, headers internes
 * (`x-user-id` / `x-user-role`) consommés par {@link InternalAuthGuard}.
 */
@Controller('me/rg')
@UseGuards(InternalAuthGuard)
export class RgProfilesController {
  constructor(private readonly rg: RgProfilesService) {}

  @Get()
  profile(@Internal() user: InternalUser): Promise<IRgProfile> {
    return this.rg.getProfile(user.id);
  }

  @Patch('limits')
  @HttpCode(HttpStatus.OK)
  updateLimits(
    @Internal() user: InternalUser,
    @Body() dto: UpdateRgLimitsDto,
  ): Promise<IRgProfile> {
    return this.rg.updateLimits(user.id, dto);
  }

  @Post('self-exclude')
  @HttpCode(HttpStatus.OK)
  selfExclude(@Internal() user: InternalUser, @Body() dto: SelfExcludeDto): Promise<IRgProfile> {
    return this.rg.selfExclude(user.id, dto);
  }
}
