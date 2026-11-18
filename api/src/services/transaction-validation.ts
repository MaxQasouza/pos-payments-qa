import { createHash } from 'node:crypto';
import type { PaymentMethod } from '../repositories/transaction-repository';

export const MAX_AMOUNT = 10_000_000; // R$ 100.000,00 em centavos
export const MAX_INSTALLMENTS = 12;
const METHODS: PaymentMethod[] = ['credit', 'debit', 'pix'];

export interface TransactionInput {
  amount: number;
  method: PaymentMethod;
  installments: number;
}

export type ValidationResult =
  | { ok: true; value: TransactionInput }
  | { ok: false; error: string; message: string };

/** Regras de validação do pedido de venda. Erros retornam 422 com mensagem em português. */
export function validateTransactionInput(body: unknown): ValidationResult {
  const data = (body ?? {}) as Record<string, unknown>;
  const { amount, method, installments } = data;

  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return {
      ok: false,
      error: 'INVALID_AMOUNT',
      message: `O valor deve ser um número inteiro em centavos, maior que 0 e no máximo ${MAX_AMOUNT}.`,
    };
  }

  if (typeof method !== 'string' || !METHODS.includes(method as PaymentMethod)) {
    return { ok: false, error: 'INVALID_METHOD', message: 'Forma de pagamento inválida. Use credit, debit ou pix.' };
  }

  const parsedInstallments = installments === undefined ? 1 : installments;
  if (typeof parsedInstallments !== 'number' || !Number.isInteger(parsedInstallments)) {
    return { ok: false, error: 'INVALID_INSTALLMENTS', message: 'O número de parcelas deve ser um inteiro.' };
  }

  if (method === 'credit' && (parsedInstallments < 1 || parsedInstallments > MAX_INSTALLMENTS)) {
    return {
      ok: false,
      error: 'INVALID_INSTALLMENTS',
      message: `No crédito o parcelamento deve ser de 1 a ${MAX_INSTALLMENTS} vezes.`,
    };
  }

  if (method !== 'credit' && parsedInstallments !== 1) {
    return { ok: false, error: 'INVALID_INSTALLMENTS', message: 'Débito e pix não aceitam parcelamento.' };
  }

  return { ok: true, value: { amount, method: method as PaymentMethod, installments: parsedInstallments } };
}

/** Hash estável do pedido normalizado: mesma key + hash diferente = conflito (409). */
export function hashRequest(input: TransactionInput): string {
  const canonical = JSON.stringify({ amount: input.amount, method: input.method, installments: input.installments });
  return createHash('sha256').update(canonical).digest('hex');
}
