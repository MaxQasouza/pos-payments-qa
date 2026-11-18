/**
 * Cliente do autorizador externo.
 * Regra de negócio crítica: em timeout ou erro de comunicação a API NUNCA decide sozinha
 * (nem aprova, nem recusa). A transação fica "pending" para conciliação posterior.
 */
import { CORRELATION_HEADER } from '../middlewares/correlation-id';
import type { PaymentMethod } from '../repositories/transaction-repository';

export type AuthorizationResult =
  | { outcome: 'approved'; authorizationCode: string }
  | { outcome: 'declined'; reason: string }
  | { outcome: 'unknown'; reason: 'TIMEOUT' | 'ERRO_DE_COMUNICACAO' };

export async function authorize(
  input: { amount: number; method: PaymentMethod },
  correlationId: string,
): Promise<AuthorizationResult> {
  const baseUrl = process.env.AUTHORIZER_URL ?? 'http://localhost:4010';
  const timeoutMs = Number(process.env.AUTHORIZER_TIMEOUT_MS ?? 1500);

  try {
    const response = await fetch(`${baseUrl}/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [CORRELATION_HEADER]: correlationId },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { outcome: 'unknown', reason: 'ERRO_DE_COMUNICACAO' };

    const body = (await response.json()) as { approved: boolean; authorizationCode?: string; reason?: string };
    if (body.approved && body.authorizationCode) {
      return { outcome: 'approved', authorizationCode: body.authorizationCode };
    }
    return { outcome: 'declined', reason: body.reason ?? 'RECUSADO' };
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return { outcome: 'unknown', reason: isTimeout ? 'TIMEOUT' : 'ERRO_DE_COMUNICACAO' };
  }
}
