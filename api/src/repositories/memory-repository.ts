import type { NewTransaction, Transaction, TransactionRepository, TransactionStatus } from './transaction-repository';

/** Implementação em memória (padrão, DB_MODE=memory). Ideal para testes rápidos e demo. */
export class MemoryTransactionRepository implements TransactionRepository {
  readonly mode = 'memory' as const;
  private readonly items = new Map<string, Transaction>();

  async insert(tx: NewTransaction): Promise<Transaction> {
    const now = new Date().toISOString();
    const saved: Transaction = { ...tx, createdAt: now, updatedAt: now };
    this.items.set(saved.id, saved);
    return { ...saved };
  }

  async findById(id: string): Promise<Transaction | undefined> {
    const tx = this.items.get(id);
    return tx ? { ...tx } : undefined;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Transaction[]> {
    return [...this.items.values()]
      .filter((tx) => tx.idempotencyKey === idempotencyKey)
      .map((tx) => ({ ...tx }));
  }

  async updateStatus(id: string, status: TransactionStatus, authorizationCode?: string): Promise<Transaction | undefined> {
    const tx = this.items.get(id);
    if (!tx) return undefined;
    tx.status = status;
    if (authorizationCode) tx.authorizationCode = authorizationCode;
    tx.updatedAt = new Date().toISOString();
    return { ...tx };
  }

  async reset(): Promise<void> {
    this.items.clear();
  }
}
