/** Contrato único de persistência: a API não sabe se está em memória ou no SQL Server. */
export type PaymentMethod = 'credit' | 'debit' | 'pix';
export type TransactionStatus = 'approved' | 'declined' | 'pending' | 'cancelled';

export interface Transaction {
  id: string;
  idempotencyKey: string;
  /** Hash do corpo da requisição: identifica "mesma key com body diferente". */
  requestHash: string;
  amount: number;
  method: PaymentMethod;
  installments: number;
  status: TransactionStatus;
  authorizationCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type NewTransaction = Omit<Transaction, 'createdAt' | 'updatedAt'>;

export interface TransactionRepository {
  readonly mode: 'memory' | 'sqlserver';
  insert(tx: NewTransaction): Promise<Transaction>;
  findById(id: string): Promise<Transaction | undefined>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Transaction[]>;
  updateStatus(id: string, status: TransactionStatus, authorizationCode?: string): Promise<Transaction | undefined>;
  reset(): Promise<void>;
}

/** Lançado quando o banco rejeita uma Idempotency-Key repetida (índice único). */
export class DuplicateIdempotencyKeyError extends Error {
  constructor(idempotencyKey: string) {
    super(`Idempotency-Key já utilizada: ${idempotencyKey}`);
  }
}
