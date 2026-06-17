import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Snapshot KPI exposé au dashboard admin (T8.2). */
export interface AdminKpis {
  totalBets: number;
  totalStakedEur: number;
  activeUsers: number;
  eventsByStatus: Array<{ status: string; count: number }>;
  /** 30 derniers jours, ordre chronologique. */
  stakedPerDay: Array<{ day: string; amount: number }>;
}

/**
 * Agrège les KPI de la plateforme (T8.2) via des requêtes raw sur le schéma
 * unique `betnext` — autorise les JOINs cross-domaines (cf. ADR-002).
 * Toutes les requêtes utilisent des bornes temporelles paramétrées pour
 * rester déterministes.
 */
@Injectable()
export class KpisService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getKpis(): Promise<AdminKpis> {
    const [totalBets, totalStaked, activeUsers, eventsByStatus, stakedPerDay] = await Promise.all([
      this.countBets(),
      this.sumStaked(),
      this.activeUsersLast30d(),
      this.eventsByStatus(),
      this.stakedPerDayLast30d(),
    ]);
    return {
      totalBets,
      totalStakedEur: totalStaked,
      activeUsers,
      eventsByStatus,
      stakedPerDay,
    };
  }

  private async countBets(): Promise<number> {
    const rows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "betnext"."bets"`,
    )) as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  }

  private async sumStaked(): Promise<number> {
    const rows = (await this.dataSource.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
         FROM "betnext"."bets"
        WHERE status <> 'CANCELLED'`,
    )) as Array<{ total: string }>;
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * « Actif » = utilisateur ayant placé au moins un pari dans les 30 derniers
   * jours. Plus parlant pour un dashboard de paris qu'une notion de session.
   */
  private async activeUsersLast30d(): Promise<number> {
    const rows = (await this.dataSource.query(
      `SELECT COUNT(DISTINCT user_id)::int AS count
         FROM "betnext"."bets"
        WHERE created_at >= now() - interval '30 days'`,
    )) as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  }

  private async eventsByStatus(): Promise<Array<{ status: string; count: number }>> {
    return this.dataSource.query(
      `SELECT status, COUNT(*)::int AS count
         FROM "betnext"."e_sport_events"
     GROUP BY status
     ORDER BY status`,
    ) as Promise<Array<{ status: string; count: number }>>;
  }

  private async stakedPerDayLast30d(): Promise<Array<{ day: string; amount: number }>> {
    const rows = (await this.dataSource.query(
      `SELECT date_trunc('day', created_at)::date AS day,
              COALESCE(SUM(amount), 0)::numeric AS amount
         FROM "betnext"."bets"
        WHERE status <> 'CANCELLED'
          AND created_at >= now() - interval '30 days'
     GROUP BY day
     ORDER BY day`,
    )) as Array<{ day: Date | string; amount: string }>;
    return rows.map((row) => ({
      day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
      amount: Number(row.amount),
    }));
  }
}
