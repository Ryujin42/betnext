import { api } from './client';

export interface RgProfile {
  id: number;
  userId: number;
  dailyBetLimit: number | null;
  weeklyBetLimit: number | null;
  dailyDepositLimit: number | null;
  weeklyDepositLimit: number | null;
  selfExcludedUntil: string | null;
  limitUpdatedAt: string | null;
}

export function getRgProfile(): Promise<RgProfile> {
  return api<RgProfile>('/me/rg');
}

export function updateRgLimits(input: {
  dailyBetLimit?: number | null;
  weeklyBetLimit?: number | null;
  dailyDepositLimit?: number | null;
  weeklyDepositLimit?: number | null;
}): Promise<RgProfile> {
  return api<RgProfile>('/me/rg/limits', { method: 'PATCH', body: input });
}

export function selfExclude(durationDays: number): Promise<RgProfile> {
  return api<RgProfile>('/me/rg/self-exclude', { method: 'POST', body: { durationDays } });
}
