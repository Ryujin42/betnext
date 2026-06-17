import { EntityManager } from 'typeorm';
import { TransactionType } from '@betnext/shared-types';

/**
 * Abstraction du portefeuille consommée par le betting-service (T5.1 / T5.3).
 * Au Lot 5, implémentée localement ({@link LocalWalletService}, accès direct
 * aux tables `balances`/`transactions` du schéma unique). Au Lot 6, le
 * wallet-service prendra le relais derrière la même interface (appel HTTP
 * synchrone) sans changer l'appelant.
 *
 * `debit`/`credit` reçoivent l'`EntityManager` de la transaction en cours :
 * le mouvement de solde est ainsi atomique avec l'écriture du pari.
 */
export interface IWalletService {
  getBalance(userId: number): Promise<number>;
  /** Débite `amount` €. Lève `INSUFFICIENT_BALANCE` si le solde est insuffisant. */
  debit(manager: EntityManager, userId: number, amount: number, description: string): Promise<void>;
  /** Crédite `amount` € (gain, remboursement…). */
  credit(
    manager: EntityManager,
    userId: number,
    amount: number,
    type: TransactionType,
    description: string,
  ): Promise<void>;
}

/** Token d'injection NestJS du wallet. */
export const WALLET_SERVICE = Symbol('WALLET_SERVICE');
