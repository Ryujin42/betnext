import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventStatus } from '@betnext/shared-types';
import { EsportEventEntity } from '@betnext/database';
import { EVENT_BUS } from '@betnext/shared-events';
import { ResolutionService } from './resolution.service';
import { BetNextException } from '../common/betnext.exception';

describe('ResolutionService (garde de saisie T4.4)', () => {
  let service: ResolutionService;
  const events = { findOne: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const bus = { publish: jest.fn(), subscribe: jest.fn() };

  beforeEach(async () => {
    events.findOne.mockReset();
    dataSource.transaction.mockReset();
    bus.publish.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResolutionService,
        { provide: getRepositoryToken(EsportEventEntity), useValue: events },
        { provide: DataSource, useValue: dataSource },
        { provide: EVENT_BUS, useValue: bus },
      ],
    }).compile();
    service = moduleRef.get(ResolutionService);
  });

  it('refuse la saisie si l’événement n’est pas FERME', async () => {
    events.findOne.mockResolvedValue({ id: 1, status: EventStatus.PUBLIE });
    await expect(service.setResult(1, { ranking: [] })).rejects.toBeInstanceOf(BetNextException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('lève NOT_FOUND si l’événement est absent', async () => {
    events.findOne.mockResolvedValue(null);
    await expect(service.setResult(99, { ranking: [] })).rejects.toBeInstanceOf(BetNextException);
  });
});
