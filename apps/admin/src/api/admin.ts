import { api } from './client';

export interface AdminKpis {
  totalBets: number;
  totalStakedEur: number;
  activeUsers: number;
  eventsByStatus: Array<{ status: string; count: number }>;
  stakedPerDay: Array<{ day: string; amount: number }>;
}

export function fetchKpis(): Promise<AdminKpis> {
  return api<AdminKpis>('/admin/kpis');
}
