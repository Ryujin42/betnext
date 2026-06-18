import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventStatus } from '@betnext/shared-types';
import { EsportEventEntity, EventTeamEntity } from '@betnext/database';
import { BetNextTopic, EVENT_BUS, type IEventBus } from '@betnext/shared-events';
import { EventsService } from './events.service';
import { BetNextException } from '../common/betnext.exception';

interface RepoMock {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
}

function repoMock(): RepoMock {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d: unknown) => d),
    save: jest.fn((e: unknown) =>
      Promise.resolve(Array.isArray(e) ? e : { id: 1, ...(e as object) }),
    ),
    remove: jest.fn(() => Promise.resolve(undefined)),
  };
}

describe('EventsService (cycle de vie T4.2)', () => {
  let service: EventsService;
  let events: RepoMock;
  let eventTeams: RepoMock;
  let bus: { publish: jest.Mock; subscribe: jest.Mock };

  beforeEach(async () => {
    events = repoMock();
    eventTeams = repoMock();
    bus = { publish: jest.fn(() => Promise.resolve()), subscribe: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(EsportEventEntity), useValue: events },
        { provide: getRepositoryToken(EventTeamEntity), useValue: eventTeams },
        { provide: EVENT_BUS, useValue: bus as unknown as IEventBus },
      ],
    }).compile();
    service = moduleRef.get(EventsService);
  });

  it('crée un événement en BROUILLON avec ses event_teams', async () => {
    const created = await service.create({
      name: 'T1 vs Gen.G',
      startDate: '2026-07-01T17:00:00.000Z',
      tournamentId: 1,
      gameId: 1,
      teamIds: [1, 2],
    });
    expect(events.create.mock.calls[0][0].status).toBe(EventStatus.BROUILLON);
    expect(created.status).toBe(EventStatus.BROUILLON);
    expect(eventTeams.create).toHaveBeenCalledTimes(2);
    expect(eventTeams.save).toHaveBeenCalled();
  });

  it('publie un BROUILLON (BROUILLON → PUBLIE)', async () => {
    events.findOne.mockResolvedValue({ id: 1, status: EventStatus.BROUILLON });
    const updated = await service.transition(1, EventStatus.PUBLIE);
    expect(updated.status).toBe(EventStatus.PUBLIE);
  });

  it('refuse la suppression une fois publié', async () => {
    events.findOne.mockResolvedValue({ id: 1, status: EventStatus.PUBLIE });
    await expect(service.remove(1)).rejects.toBeInstanceOf(BetNextException);
    expect(events.remove).not.toHaveBeenCalled();
  });

  it('autorise la suppression en BROUILLON', async () => {
    const event = { id: 1, status: EventStatus.BROUILLON };
    events.findOne.mockResolvedValue(event);
    await service.remove(1);
    expect(events.remove).toHaveBeenCalledWith(event);
  });

  it("publie event.cancelled lors d'une annulation (PUBLIE → ANNULE)", async () => {
    events.findOne.mockResolvedValue({ id: 42, status: EventStatus.PUBLIE });
    const updated = await service.transition(42, EventStatus.ANNULE);
    expect(updated.status).toBe(EventStatus.ANNULE);
    expect(bus.publish).toHaveBeenCalledWith(
      BetNextTopic.EventCancelled,
      expect.objectContaining({ eSportEventId: 42 }),
    );
  });

  it("ne publie pas event.cancelled lors d'une transition non-annulante", async () => {
    events.findOne.mockResolvedValue({ id: 1, status: EventStatus.BROUILLON });
    await service.transition(1, EventStatus.PUBLIE);
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('refuse une transition illégale (BROUILLON → TERMINE)', async () => {
    events.findOne.mockResolvedValue({ id: 1, status: EventStatus.BROUILLON });
    await expect(service.transition(1, EventStatus.TERMINE)).rejects.toBeInstanceOf(
      BetNextException,
    );
  });

  it('refuse la modification hors BROUILLON', async () => {
    events.findOne.mockResolvedValue({ id: 1, status: EventStatus.PUBLIE });
    await expect(service.update(1, { name: 'x' })).rejects.toBeInstanceOf(BetNextException);
  });

  it('getOrThrow lève NOT_FOUND si absent', async () => {
    events.findOne.mockResolvedValue(null);
    await expect(service.getOrThrow(99)).rejects.toBeInstanceOf(BetNextException);
  });
});
