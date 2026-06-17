import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  BetNextTopic,
  BetPlacedEvent,
  BetResolvedEvent,
  EVENT_BUS,
  IEventBus,
} from '@betnext/shared-events';
import { WalletService } from './wallet.service';

/**
 * Branche le portefeuille sur les événements de paris (T6.1) : `bet.placed`
 * (débit) et `bet.won` (crédit), de façon idempotente.
 *
 * ⚠️ INACTIF au Lot 6 : le bus est in-memory **mono-processus** ; les
 * événements émis par le betting-service (autre process) n'arrivent pas ici.
 * Le débit/crédit de pari reste donc assuré en synchrone par le betting-service.
 * Au **Lot 7** (bus Redis inter-services), il faudra retirer le débit synchrone
 * du betting-service pour que ce consommateur devienne l'unique source — sinon
 * double mouvement (l'idempotence par référence `bet:<id>` limite déjà le risque).
 */
@Injectable()
export class BetEventsSubscriber implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
    private readonly wallet: WalletService,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe<BetPlacedEvent>(BetNextTopic.BetPlaced, (event) =>
      this.wallet.debitForBet(event.betId, event.userId, event.amount),
    );
    this.bus.subscribe<BetResolvedEvent>(BetNextTopic.BetWon, (event) =>
      this.wallet.creditForWin(event.betId, event.userId, event.payout),
    );
  }
}
