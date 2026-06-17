/** Handler d'un topic. Peut être synchrone ou asynchrone. */
export type EventHandler<T> = (payload: T) => void | Promise<void>;

/**
 * Bus d'événements inter-services. L'interface est volontairement minimale
 * pour que l'implémentation in-memory du Lot 5 et l'implémentation
 * Redis Pub/Sub + BullMQ du Lot 7 soient interchangeables sans toucher aux
 * producteurs/consommateurs.
 */
export interface IEventBus {
  publish<T>(topic: string, payload: T): Promise<void>;
  subscribe<T>(topic: string, handler: EventHandler<T>): void;
}

/** Token d'injection NestJS du bus. */
export const EVENT_BUS = Symbol('EVENT_BUS');
