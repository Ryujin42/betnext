import 'reflect-metadata';
import * as argon2 from 'argon2';
import { EventStatus, Role, type OutcomeCondition } from '@betnext/shared-types';
import dataSource from './data-source';
import {
  BalanceEntity,
  EsportEventEntity,
  EventTeamEntity,
  GameEntity,
  OutcomeEntity,
  TeamEntity,
  TournamentEntity,
  UserEntity,
} from './index';

/**
 * Seed de démonstration (Lot 3 — T3.2). Idempotent : repart d'un état propre
 * (TRUNCATE) puis recharge les 7 comptes démo (mot de passe `password`, haché
 * Argon2id) et un jeu de données LoL réaliste (tournois, équipes, événements
 * PUBLIE + issues pariables) ainsi que les soldes initiaux.
 */
async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.query(`
      TRUNCATE TABLE
        "betnext"."users", "betnext"."sessions", "betnext"."games", "betnext"."tournaments",
        "betnext"."teams", "betnext"."e_sport_events", "betnext"."event_teams",
        "betnext"."outcomes", "betnext"."bets", "betnext"."bets_history",
        "betnext"."transactions", "betnext"."balances"
      RESTART IDENTITY CASCADE
    `);

    const passwordHash = await argon2.hash('password', { type: argon2.argon2id });

    // ── Comptes démo (cf. README) ──
    const usersRepo = dataSource.getRepository(UserEntity);
    const users = await usersRepo.save(
      [
        { name: 'AdminBetNext', email: 'admin@betnext-v2.gg', role: Role.ADMIN },
        { name: 'Diarapak', email: 'manager@betnext-v2.gg', role: Role.MANAGER },
        { name: 'Faker_Fan', email: 'faker@betnext-v2.gg', role: Role.USER },
        { name: 'T1_Enjoyer', email: 't1@betnext-v2.gg', role: Role.USER },
        { name: 'GenG_King', email: 'geng@betnext-v2.gg', role: Role.USER },
        { name: 'G2_Believer', email: 'g2@betnext-v2.gg', role: Role.USER },
        { name: 'BLG_Support', email: 'blg@betnext-v2.gg', role: Role.USER },
      ].map((u) => usersRepo.create({ ...u, passwordHash, birthDate: '1998-05-07' })),
    );

    // Solde initial de 100 € par utilisateur.
    const balancesRepo = dataSource.getRepository(BalanceEntity);
    await balancesRepo.save(
      users.map((u) => balancesRepo.create({ userId: u.id, amount: '100.00' })),
    );

    // ── Données e-sport (LoL) ──
    const gamesRepo = dataSource.getRepository(GameEntity);
    const lol = await gamesRepo.save(gamesRepo.create({ name: 'lol' }));

    const tournamentsRepo = dataSource.getRepository(TournamentEntity);
    const [lck, msi] = await tournamentsRepo.save([
      tournamentsRepo.create({ name: 'LCK Spring 2026', gameId: lol.id }),
      tournamentsRepo.create({ name: 'MSI 2026', gameId: lol.id }),
    ]);

    const teamsRepo = dataSource.getRepository(TeamEntity);
    const [t1, geng, g2, blg] = await teamsRepo.save(
      ['T1', 'Gen.G', 'G2 Esports', 'Bilibili Gaming'].map((name) => teamsRepo.create({ name })),
    );

    const eventsRepo = dataSource.getRepository(EsportEventEntity);
    const finalLck = await eventsRepo.save(
      eventsRepo.create({
        name: 'T1 vs Gen.G — Finale',
        startDate: new Date('2026-07-01T17:00:00.000Z'),
        status: EventStatus.PUBLIE,
        tournamentId: lck.id,
        gameId: lol.id,
      }),
    );
    const semiMsi = await eventsRepo.save(
      eventsRepo.create({
        name: 'G2 vs BLG — Demi-finale',
        startDate: new Date('2026-07-03T16:00:00.000Z'),
        status: EventStatus.PUBLIE,
        tournamentId: msi.id,
        gameId: lol.id,
      }),
    );

    const eventTeamsRepo = dataSource.getRepository(EventTeamEntity);
    const [etT1, etGenG] = await eventTeamsRepo.save([
      eventTeamsRepo.create({ eSportEventId: finalLck.id, teamId: t1.id }),
      eventTeamsRepo.create({ eSportEventId: finalLck.id, teamId: geng.id }),
    ]);
    const [etG2, etBlg] = await eventTeamsRepo.save([
      eventTeamsRepo.create({ eSportEventId: semiMsi.id, teamId: g2.id }),
      eventTeamsRepo.create({ eSportEventId: semiMsi.id, teamId: blg.id }),
    ]);

    const teamWins: OutcomeCondition = { type: 'TEAM_WINS' };
    const outcomesRepo = dataSource.getRepository(OutcomeEntity);
    await outcomesRepo.save([
      outcomesRepo.create({
        label: 'T1 gagne',
        odds: '1.85',
        condition: teamWins,
        eSportEventId: finalLck.id,
        eventPlayerId: etT1.id,
        isWinner: null,
      }),
      outcomesRepo.create({
        label: 'Gen.G gagne',
        odds: '1.95',
        condition: teamWins,
        eSportEventId: finalLck.id,
        eventPlayerId: etGenG.id,
        isWinner: null,
      }),
      outcomesRepo.create({
        label: 'Match < 30 min',
        odds: '2.40',
        condition: {
          type: 'MATCH_DURATION',
          operator: 'LESS_THAN',
          threshold: 30,
          unit: 'minutes',
        },
        eSportEventId: finalLck.id,
        eventPlayerId: null,
        isWinner: null,
      }),
      outcomesRepo.create({
        label: '+ de 25 kills au total',
        odds: '1.70',
        condition: { type: 'TOTAL_KILLS', operator: 'GREATER_THAN', threshold: 25 },
        eSportEventId: finalLck.id,
        eventPlayerId: null,
        isWinner: null,
      }),
      outcomesRepo.create({
        label: 'G2 gagne',
        odds: '2.10',
        condition: teamWins,
        eSportEventId: semiMsi.id,
        eventPlayerId: etG2.id,
        isWinner: null,
      }),
      outcomesRepo.create({
        label: 'BLG gagne',
        odds: '1.72',
        condition: teamWins,
        eSportEventId: semiMsi.id,
        eventPlayerId: etBlg.id,
        isWinner: null,
      }),
    ]);

    console.warn(
      `[seed] OK — ${users.length} comptes (mdp "password"), 1 jeu, 2 tournois, 4 équipes, 2 événements PUBLIE, 6 issues.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] échec', error);
  process.exitCode = 1;
});
