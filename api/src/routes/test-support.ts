import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { hashRequest } from '../services/transaction-validation';
import type { PaymentMethod, TransactionRepository, TransactionStatus } from '../repositories/transaction-repository';
import { toResponse } from './transactions';

/**
 * Rotas exclusivas de teste (montadas SOMENTE com ENABLE_TEST_ROUTES=1).
 * Usadas pelos provider states do Pact e para preparar massa de dados.
 */
export function testSupportRouter(repo: TransactionRepository): Router {
  const router = Router();

  router.post('/reset', async (_req, res) => {
    await repo.reset();
    res.status(204).end();
  });

  router.post('/seed', async (req, res) => {
    const body = req.body ?? {};
    const amount: number = body.amount ?? 1500;
    const method: PaymentMethod = body.method ?? 'debit';
    const installments: number = body.installments ?? 1;
    const status: TransactionStatus = body.status ?? 'approved';

    const existing = body.id ? await repo.findById(body.id) : undefined;
    if (existing) {
      res.status(200).json(toResponse(existing));
      return;
    }

    const tx = await repo.insert({
      id: body.id ?? randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `seed-${randomUUID()}`,
      requestHash: hashRequest({ amount, method, installments }),
      amount,
      method,
      installments,
      status,
      authorizationCode: body.authorizationCode ?? (status === 'approved' ? '123456' : undefined),
    });
    res.status(201).json(toResponse(tx));
  });

  return router;
}
