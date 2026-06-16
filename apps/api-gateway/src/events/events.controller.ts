import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role, type IEvent, type IOutcome } from '@betnext/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { RelayService } from '../proxy/relay.service';

/**
 * Proxy des routes événements (Lot 4) vers l'event-service. La vérification
 * JWT a lieu ici ; les mutations exigent `ROLE_MANAGER`. Le gateway injecte
 * `x-user-id` / `x-user-role` que l'event-service consomme.
 */
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly relay: RelayService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<IEvent[]> {
    return this.relay.forwardToEventService('GET', '/events', { user });
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IEvent> {
    return this.relay.forwardToEventService('GET', `/events/${id}`, { user });
  }

  @Get(':id/outcomes')
  outcomes(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IOutcome[]> {
    return this.relay.forwardToEventService('GET', `/events/${id}/outcomes`, { user });
  }

  @Post()
  @Roles(Role.MANAGER)
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser): Promise<IEvent> {
    return this.relay.forwardToEventService('POST', '/events', { user, body });
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IEvent> {
    return this.relay.forwardToEventService('PATCH', `/events/${id}`, { user, body });
  }

  @Delete(':id')
  @Roles(Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.relay.forwardToEventService('DELETE', `/events/${id}`, { user });
  }

  @Post(':id/publish')
  @Roles(Role.MANAGER)
  publish(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IEvent> {
    return this.relay.forwardToEventService('POST', `/events/${id}/publish`, { user });
  }

  @Post(':id/close')
  @Roles(Role.MANAGER)
  close(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IEvent> {
    return this.relay.forwardToEventService('POST', `/events/${id}/close`, { user });
  }

  @Post(':id/cancel')
  @Roles(Role.MANAGER)
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IEvent> {
    return this.relay.forwardToEventService('POST', `/events/${id}/cancel`, { user });
  }

  @Post(':id/outcomes')
  @Roles(Role.MANAGER)
  addOutcome(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IOutcome> {
    return this.relay.forwardToEventService('POST', `/events/${id}/outcomes`, { user, body });
  }

  @Post(':id/result')
  @Roles(Role.MANAGER)
  setResult(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IEvent> {
    return this.relay.forwardToEventService('POST', `/events/${id}/result`, { user, body });
  }
}
