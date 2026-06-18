import { api } from './client';

export interface EventDto {
  id: number;
  name: string;
  startDate: string;
  status: string;
  tournamentId: number;
  gameId: number;
}

export interface OutcomeDto {
  id: number;
  label: string;
  isWinner: boolean | null;
  odds: number;
  condition: Record<string, unknown>;
  eSportEventId: number;
  eventPlayerId: number | null;
}

export interface ImportedEvent {
  externalId: string;
  name: string;
  startDate: string;
  game: string;
  tournament: string;
  teams: string[];
}

export function listEvents(): Promise<EventDto[]> {
  return api<EventDto[]>('/events?all=true');
}

export function getEvent(id: number): Promise<EventDto> {
  return api<EventDto>(`/events/${id}`);
}

export function getOutcomes(eventId: number): Promise<OutcomeDto[]> {
  return api<OutcomeDto[]>(`/events/${eventId}/outcomes`);
}

export function createEvent(body: {
  name: string;
  startDate: string;
  tournamentId: number;
  gameId: number;
}): Promise<EventDto> {
  return api<EventDto>('/events', { method: 'POST', body });
}

export function publishEvent(id: number): Promise<EventDto> {
  return api<EventDto>(`/events/${id}/publish`, { method: 'POST' });
}

export function closeEvent(id: number): Promise<EventDto> {
  return api<EventDto>(`/events/${id}/close`, { method: 'POST' });
}

export function cancelEvent(id: number): Promise<EventDto> {
  return api<EventDto>(`/events/${id}/cancel`, { method: 'POST' });
}

export function addOutcome(
  eventId: number,
  body: { label: string; odds: number; condition: Record<string, unknown> },
): Promise<OutcomeDto> {
  return api<OutcomeDto>(`/events/${eventId}/outcomes`, { method: 'POST', body });
}

export function setResult(eventId: number, body: { winnerOutcomeId: number }): Promise<EventDto> {
  return api<EventDto>(`/events/${eventId}/result`, { method: 'POST', body });
}

export function importLive(type: string): Promise<ImportedEvent[]> {
  return api<ImportedEvent[]>(`/events/import/${type}`);
}

export interface IngestionSummary {
  type: string;
  created: number;
  skipped: number;
  createdIds: number[];
}

export function importPersist(type: string): Promise<IngestionSummary> {
  return api<IngestionSummary>(`/events/import/${type}`, { method: 'POST' });
}

export interface ImportOneResult {
  created: boolean;
  id: number | null;
}

export function importPersistOne(type: string, externalId: string): Promise<ImportOneResult> {
  return api<ImportOneResult>(`/events/import/${type}/${encodeURIComponent(externalId)}`, {
    method: 'POST',
  });
}
