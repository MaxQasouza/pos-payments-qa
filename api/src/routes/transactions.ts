import { randomUUID } from 'node:crypto';
import { Router, type Response } from 'express';
import { authorize } from '../services/authorizer-client';
import { hashRequest, validateTransactionInput } from '../services/transaction-validation';
import {
  DuplicateIdempotencyKeyError,
  type Transaction,
  type TransactionRepository,
} from '../repositories/transaction-repository';

const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

/** Formato público da transação (não expõe requestHash nem updatedAt). */
export function toResponse(tx: Transaction) {
  return {
    id: tx.id,
    amount: tx.amount,
    method: tx.method,
    installments: tx.installments,
    status: tx.status,
    ...(tx.authorizationCode ? { authorizationCode: tx.authorizationCode } : {}),
    idempotencyKey: tx.idempotencyKey,
    createdAt: tx.createdAt,
  };
}

function track(res: Response, tx: Transaction): void {
  res.locals.transactionId = tx.id;
  res.locals.transactionStatus = tx.status;
}

/**
 * ATENÇÃO — MODO BUG PROPOSITAL (somente para demonstração):
 * com BUG_MODE=1 a verificação de idempotência é ignorada e TODA chamada cria uma
 * transação nova, reproduzindo o defeito mais caro de um POS: cobrança duplicada.
 * Serve para mostrar os testes @idempotencia (e a pipeline) ficando vermelhos.
 */
function isBugMode(): boolean {
  return process.env.BUG_MODE === '1';
}

export function transactionsRouter(repo: TransactionRepository): Router {
  const router = Router();

  /** Devolve a transação já existente para a key (200) ou 409 se o corpo for diferente. */
  function replay(res: Response, existing: Transaction, requestHash: string) {
    track(res, existing);
    if (existing.requestHash !== requestHash) {
      res.status(409).json({
        error: 'IDEMPOTENCY_KEY_CONFLICT',
        message: 'Esta Idempotency-Key já foi usada com outros dados de venda.',
      });
      return;
    }
    res.status(200).json(toResponse(existing));
  }

  router.post('/', async (req, res) => {
    const idempotencyKey = req.header('Idempotency-Key')?.trim();
    if (!idempotencyKey) {
      res.status(400).json({ error: 'MISSING_IDEMPOTENCY_KEY', message: 'O header Idempotency-Key é obrigatório.' });
      return;
    }
    if (idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      res.status(400).json({
        error: 'INVALID_IDEMPOTENCY_KEY',
        message: `A Idempotency-Key deve ter no máximo ${MAX_IDEMPOTENCY_KEY_LENGTH} caracteres.`,
      });
      return;
    }

    const validation = validateTransactionInput(req.body);
    if (!validation.ok) {
      res.status(422).json({ error: validation.error, message: validation.message });
      return;
    }
    const input = validation.value;
    const requestHash = hashRequest(input);

    // 1ª camada contra cobrança duplicada: a aplicação verifica a key antes de autorizar.
    if (!isBugMode()) {
      const [existing] = await repo.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        replay(res, existing, requestHash);
        return;
      }
    }

    // A transação nasce "pending" ANTES de chamar a bandeira: se a API cair no meio,
    // fica registro para conciliação (nunca uma venda "invisível").
    let tx: Transaction;
    try {
      tx = await repo.insert({ id: randomUUID(), idempotencyKey, requestHash, ...input, status: 'pending' });
    } catch (error) {
      // 2ª camada: índice único no banco (SQL Server) barra a duplicidade em corrida.
      if (error instanceof DuplicateIdempotencyKeyError) {
        const [existing] = await repo.findByIdempotencyKey(idempotencyKey);
        if (existing) {
          replay(res, existing, requestHash);
          return;
        }
      }
      throw error;
    }

    const result = await authorize({ amount: input.amount, method: input.method }, res.locals.correlationId);

    if (result.outcome === 'approved') {
      tx = (await repo.updateStatus(tx.id, 'approved', result.authorizationCode)) ?? tx;
    } else if (result.outcome === 'declined') {
      tx = (await repo.updateStatus(tx.id, 'declined')) ?? tx;
    }
    // outcome "unknown" (timeout/erro): permanece pending → 202.

    track(res, tx);
    res.status(tx.status === 'pending' ? 202 : 201).json(toResponse(tx));
  });

  router.get('/', async (req, res) => {
    const idempotencyKey = typeof req.query.idempotencyKey === 'string' ? req.query.idempotencyKey : '';
    if (!idempotencyKey) {
      res.status(400).json({ error: 'MISSING_FILTER', message: 'Informe o parâmetro idempotencyKey.' });
      return;
    }
    const items = await repo.findByIdempotencyKey(idempotencyKey);
    res.json(items.map(toResponse));
  });

  router.get('/:id', async (req, res) => {
    const tx = await repo.findById(req.params.id);
    if (!tx) {
      res.status(404).json({ error: 'TRANSACTION_NOT_FOUND', message: 'Transação não encontrada.' });
      return;
    }
    track(res, tx);
    res.json(toResponse(tx));
  });

  router.post('/:id/cancel', async (req, res) => {
    const tx = await repo.findById(req.params.id);
    if (!tx) {
      res.status(404).json({ error: 'TRANSACTION_NOT_FOUND', message: 'Transação não encontrada.' });
      return;
    }
    track(res, tx);

    if (tx.status === 'cancelled') {
      res.status(409).json({ error: 'ALREADY_CANCELLED', message: 'Esta transação já foi cancelada.' });
      return;
    }
    if (tx.status !== 'approved') {
      res.status(422).json({
        error: 'INVALID_STATUS_TRANSITION',
        message: `Somente transações aprovadas podem ser canceladas (status atual: ${tx.status}).`,
      });
      return;
    }

    const cancelled = (await repo.updateStatus(tx.id, 'cancelled')) ?? tx;
    track(res, cancelled);
    res.json(toResponse(cancelled));
  });

  return router;
}
