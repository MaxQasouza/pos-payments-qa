/**
 * Cliente usado pela maquininha (consumer "pos-terminal") para falar com a Payments API.
 * É este cliente que os testes de contrato (Pact) exercitam do lado consumer.
 */
export type PaymentMethod = 'credit' | 'debit' | 'pix';
export type TransactionStatus = 'approved' | 'declined' | 'pending' | 'cancelled';

export interface CreateTransactionInput {
  amount: number;
  method: PaymentMethod;
  installments?: number;
}

export interface Transaction {
  id: string;
  amount: number;
  method: PaymentMethod;
  installments: number;
  status: TransactionStatus;
  authorizationCode?: string;
  idempotencyKey: string;
  createdAt: string;
}

export class PosApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Payments API respondeu ${status}`);
  }
}

export class PosClient {
  constructor(private readonly baseUrl: string) {}

  async createTransaction(input: CreateTransactionInput, idempotencyKey: string): Promise<Transaction> {
    const response = await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    });
    return this.parse(response);
  }

  /** Retorna null quando a transação não existe (404). */
  async getTransaction(id: string): Promise<Transaction | null> {
    const response = await fetch(`${this.baseUrl}/transactions/${encodeURIComponent(id)}`);
    if (response.status === 404) return null;
    return this.parse(response);
  }

  async cancelTransaction(id: string): Promise<Transaction> {
    const response = await fetch(`${this.baseUrl}/transactions/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    return this.parse(response);
  }

  private async parse(response: Response): Promise<Transaction> {
    const body = await response.json().catch(() => undefined);
    if (!response.ok) throw new PosApiError(response.status, body);
    return body as Transaction;
  }
}
