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
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventStatus, type IEvent, type IOutcome } from '@betnext/shared-types';
import { InternalAuthGuard } from '../common/internal-auth.guard';
import { ManagerGuard } from '../common/manager.guard';
import { EventsService } from './events.service';
import { OutcomesService } from './outcomes.service';
import { ResolutionService } from './resolution.service';
import { EventIngestionService, type IngestionSummary } from './event-ingestion.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateOutcomeDto } from './dto/create-outcome.dto';
import { SetResultDto } from './dto/set-result.dto';

/**
 * API événements (T4.2–T4.4). Toutes les routes exigent que le gateway ait
 * injecté l'identité (InternalAuthGuard) ; les mutations sont en plus
 * réservées aux gestionnaires (ManagerGuard) — le gateway impose déjà
 * `@Roles(ROLE_MANAGER)`.
 */
@Controller('events')
@UseGuards(InternalAuthGuard)
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly outcomes: OutcomesService,
    private readonly resolution: ResolutionService,
    private readonly ingestion: EventIngestionService,
  ) {}

  @Get()
  async list(@Query('all') all?: string): Promise<IEvent[]> {
    const events = all === 'true' ? await this.events.listAll() : await this.events.listPublished();
    return events.map((event) => event.toPublic());
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<IEvent> {
    const event = await this.events.getOrThrow(id);
    return event.toPublic();
  }

  @Get(':id/outcomes')
  async outcomesOf(@Param('id', ParseIntPipe) id: number): Promise<IOutcome[]> {
    const list = await this.outcomes.listForEvent(id);
    return list.map((outcome) => outcome.toPublic());
  }

  @Post()
  @UseGuards(ManagerGuard)
  async create(@Body() dto: CreateEventDto): Promise<IEvent> {
    const event = await this.events.create(dto);
    return event.toPublic();
  }

  @Patch(':id')
  @UseGuards(ManagerGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ): Promise<IEvent> {
    const event = await this.events.update(id, dto);
    return event.toPublic();
  }

  @Delete(':id')
  @UseGuards(ManagerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.events.remove(id);
  }

  @Post(':id/publish')
  @UseGuards(ManagerGuard)
  async publish(@Param('id', ParseIntPipe) id: number): Promise<IEvent> {
    const event = await this.events.transition(id, EventStatus.PUBLIE);
    return event.toPublic();
  }

  @Post(':id/close')
  @UseGuards(ManagerGuard)
  async close(@Param('id', ParseIntPipe) id: number): Promise<IEvent> {
    const event = await this.events.transition(id, EventStatus.FERME);
    return event.toPublic();
  }

  @Post(':id/cancel')
  @UseGuards(ManagerGuard)
  async cancel(@Param('id', ParseIntPipe) id: number): Promise<IEvent> {
    const event = await this.events.transition(id, EventStatus.ANNULE);
    return event.toPublic();
  }

  @Post(':id/outcomes')
  @UseGuards(ManagerGuard)
  async addOutcome(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOutcomeDto,
  ): Promise<IOutcome> {
    const outcome = await this.outcomes.create(id, dto);
    return outcome.toPublic();
  }

  @Post(':id/result')
  @UseGuards(ManagerGuard)
  async setResult(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetResultDto,
  ): Promise<IEvent> {
    const event = await this.resolution.setResult(id, dto);
    return event.toPublic();
  }

  /**
   * T8.4 — ingestion : interroge l'adapter `type` (`lol` etc.) puis crée en
   * BROUILLON les évènements pas encore présents (idempotent). Réservé manager.
   */
  @Post('import/:type')
  @UseGuards(ManagerGuard)
  async importFromAdapter(@Param('type') type: string): Promise<IngestionSummary> {
    return this.ingestion.ingestAll(type);
  }

  /** T8.4 — ingestion d'un seul match identifié par son `externalId`. */
  @Post('import/:type/:externalId')
  @UseGuards(ManagerGuard)
  async importOneFromAdapter(
    @Param('type') type: string,
    @Param('externalId') externalId: string,
  ): Promise<{ created: boolean; id: number | null }> {
    const id = await this.ingestion.ingestByExternalId(type, externalId);
    return { created: id !== null, id };
  }
}
