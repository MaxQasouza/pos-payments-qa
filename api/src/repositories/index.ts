import { MemoryTransactionRepository } from './memory-repository';
import type { TransactionRepository } from './transaction-repository';

/** Escolhe a implementação de persistência pela variável DB_MODE (memory | sqlserver). */
export async function createRepository(): Promise<TransactionRepository> {
  const mode = process.env.DB_MODE ?? 'memory';
  if (mode === 'sqlserver') {
    const { SqlServerTransactionRepository } = await import('./sqlserver-repository');
    return SqlServerTransactionRepository.connect();
  }
  return new MemoryTransactionRepository();
}
