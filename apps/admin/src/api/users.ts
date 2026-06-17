import { api } from './client';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  birthDate: string;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
}

export interface PaginatedUsers {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

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

export interface ListUsersParams {
  search?: string;
  role?: string;
  suspended?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'name' | 'email';
  sortDir?: 'asc' | 'desc';
}

function toQuery(params: ListUsersParams): string {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.role) qs.set('role', params.role);
  if (params.suspended !== undefined) qs.set('suspended', String(params.suspended));
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortDir) qs.set('sortDir', params.sortDir);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function listUsers(params: ListUsersParams): Promise<PaginatedUsers> {
  return api<PaginatedUsers>(`/admin/users${toQuery(params)}`);
}

export function suspendUser(id: number, reason: string | null): Promise<AdminUser> {
  return api<AdminUser>(`/admin/users/${id}/suspend`, {
    method: 'POST',
    body: reason ? { reason } : {},
  });
}

export function unsuspendUser(id: number): Promise<AdminUser> {
  return api<AdminUser>(`/admin/users/${id}/unsuspend`, { method: 'POST', body: {} });
}

export function getUserRg(id: number): Promise<RgProfile> {
  return api<RgProfile>(`/admin/users/${id}/rg`);
}
