import { randomUUID } from 'node:crypto';

export type Method = 'credit' | 'debit' | 'pix';

export interface TransactionPayload {
  amount?: unknown;
  method?: unknown;
  installments?: unknown;
}

/** Valores com significado no mock do autorizador (últimos 2 dígitos dos centavos). */
export const AMOUNTS = {
  approved: 1500, // R$ 15,00
  declined: 1099, // termina em 99 → CARTAO_RECUSADO
  slow: 1098, // termina em 98 → autorizador demora 3 s → pending
} as const;

/** Factory de payload válido; sobrescreva só o que importa para o caso. */
export function buildTransaction(overrides: TransactionPayload = {}): TransactionPayload {
  return { amount: AMOUNTS.approved, method: 'debit', ...overrides };
}

/** Uma key única por venda, como a maquininha faria. */
export function newIdempotencyKey(prefix = 'test'): string {
  return `${prefix}-${randomUUID()}`;
}
