import { api } from './client';

export interface EventSummary {
  id: number;
  name: string;
  startDate: string;
  status: string;
  tournamentId: number;
  gameId: number;
}

export interface Outcome {
  id: number;
  label: string;
  odds: number;
  isWinner: boolean | null;
  condition: Record<string, unknown>;
  eSportEventId: number;
  eventPlayerId: number | null;
}

export function listEvents(): Promise<EventSummary[]> {
  return api<EventSummary[]>('/events');
}

export function getEvent(id: number): Promise<EventSummary> {
  return api<EventSummary>(`/events/${id}`);
}

export function getOutcomes(eventId: number): Promise<Outcome[]> {
  return api<Outcome[]>(`/events/${eventId}/outcomes`);
}
