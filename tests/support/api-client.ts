import type { APIRequestContext } from '@playwright/test';
import { buildTransaction, newIdempotencyKey, type TransactionPayload } from './factories';

export interface TransactionBody {
  id: string;
  amount: number;
  method: string;
  installments: number;
  status: 'approved' | 'declined' | 'pending' | 'cancelled';
  authorizationCode?: string;
  idempotencyKey: string;
  createdAt: string;
}

/** Envia POST /transactions com a Idempotency-Key informada (ou uma nova). */
export async function createTransaction(
  request: APIRequestContext,
  payload: TransactionPayload = buildTransaction(),
  idempotencyKey: string = newIdempotencyKey(),
  extraHeaders: Record<string, string> = {},
) {
  const response = await request.post('/transactions', {
    data: payload,
    headers: { 'Idempotency-Key': idempotencyKey, ...extraHeaders },
  });
  return { response, idempotencyKey };
}

export async function listByIdempotencyKey(request: APIRequestContext, idempotencyKey: string) {
  const response = await request.get('/transactions', { params: { idempotencyKey } });
  return (await response.json()) as TransactionBody[];
}
