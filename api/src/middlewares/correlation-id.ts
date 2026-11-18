import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'X-Correlation-Id';

/**
 * Lê o X-Correlation-Id enviado pela maquininha (ou gera um novo) e devolve no header
 * da resposta. O mesmo id é repassado ao autorizador, ligando POS → API → bandeira nos logs.
 */
export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(CORRELATION_HEADER);
  const id = incoming && incoming.trim().length > 0 && incoming.length <= 128 ? incoming : randomUUID();
  res.locals.correlationId = id;
  res.setHeader(CORRELATION_HEADER, id);
  next();
}
