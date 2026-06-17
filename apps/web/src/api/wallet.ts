import { api } from './client';

export interface Balance {
  id: number;
  userId: number;
  amount: number;
  updatedAt: string;
}

export interface Transaction {
  id: number;
  userId: number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'BET' | 'WIN' | 'REFUND';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  description: string | null;
  stripeId: string | null;
  createdAt: string;
}

export function getBalance(): Promise<Balance> {
  return api<Balance>('/wallet/balance');
}

export function listTransactions(): Promise<Transaction[]> {
  return api<Transaction[]>('/wallet/transactions');
}

export function deposit(amount: number): Promise<unknown> {
  return api('/wallet/deposit', { method: 'POST', body: { amount } });
}

export function withdraw(amount: number): Promise<unknown> {
  return api('/wallet/withdraw', { method: 'POST', body: { amount } });
}
