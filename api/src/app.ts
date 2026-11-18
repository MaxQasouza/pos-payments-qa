import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { correlationId } from './middlewares/correlation-id';
import { log, requestLogger } from './logger';
import { transactionsRouter } from './routes/transactions';
import { testSupportRouter } from './routes/test-support';
import type { TransactionRepository } from './repositories/transaction-repository';

export function createApp(repo: TransactionRepository) {
  const app = express();
  app.disable('x-powered-by');

  app.use(correlationId);
  app.use(requestLogger);
  app.use(express.json());

  // Tela da maquininha (POS) servida em GET /
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', dbMode: repo.mode });
  });

  app.use('/transactions', transactionsRouter(repo));

  if (process.env.ENABLE_TEST_ROUTES === '1') {
    app.use('/__test', testSupportRouter(repo));
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada.' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'INVALID_JSON', message: 'Corpo da requisição não é um JSON válido.' });
      return;
    }
    log('error', { correlationId: res.locals.correlationId, message: 'erro inesperado', errorName: err.name });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' });
  });

  return app;
}
