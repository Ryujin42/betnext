import { api } from './client';

export interface Bet {
  id: number;
  title: string;
  createdAt: string;
  closeDate: string;
  amount: number;
  lockedOdds: number;
  status: 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
  outcomeId: number;
  userId: number;
}

export interface BetView extends Bet {
  eventName: string;
  eventStatus: string;
  outcomeLabel: string;
  potentialGain: number;
  actualGain: number | null;
}

export function placeBet(input: {
  outcomeId: number;
  amount: number;
  expectedOdds: number;
}): Promise<Bet> {
  return api<Bet>('/bets', { method: 'POST', body: input });
}

export function listMyBets(): Promise<BetView[]> {
  return api<BetView[]>('/bets');
}
