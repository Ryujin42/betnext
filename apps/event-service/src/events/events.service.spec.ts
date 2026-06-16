import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventStatus } from '@betnext/shared-types';
import { EsportEventEntity, EventTeamEntity } from '@betnext/database';
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

  beforeEach(async () => {
    events = repoMock();
    eventTeams = repoMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(EsportEventEntity), useValue: events },
        { provide: getRepositoryToken(EventTeamEntity), useValue: eventTeams },
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
