import type { TransactionRepository } from './transaction-repository';

/** Implementada na Fase 5. */
export class SqlServerTransactionRepository {
  static async connect(): Promise<TransactionRepository> {
    throw new Error('DB_MODE=sqlserver ainda não implementado');
  }
}
