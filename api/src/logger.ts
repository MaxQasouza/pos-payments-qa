/**
 * Logger estruturado em JSON (uma linha por evento), pronto para Splunk/Datadog.
 * Regra: NUNCA logar dados sensíveis (PAN, CVV, token de cartão, corpo da requisição).
 * Logamos apenas metadados: rota, status HTTP, duração, id e status da transação.
 */
import type { NextFunction, Request, Response } from 'express';

export const SERVICE_NAME = 'pos-payments-api';

type Level = 'info' | 'warn' | 'error';

export function log(level: Level, fields: Record<string, unknown>): void {
  if (process.env.LOG_SILENT === '1') return;
  const entry = { timestamp: new Date().toISOString(), level, service: SERVICE_NAME, ...fields };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

/** Middleware: registra uma linha por requisição ao final da resposta. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const level: Level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log(level, {
      correlationId: res.locals.correlationId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      transactionId: res.locals.transactionId,
      transactionStatus: res.locals.transactionStatus,
    });
  });
  next();
}
