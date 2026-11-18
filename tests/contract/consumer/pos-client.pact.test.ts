import { describe, expect, it } from 'vitest';
import { MatchersV3, PactV3 } from '@pact-foundation/pact';
import { PosClient } from '../../../client/pos-client';
import {
  APPROVED_TX_ID,
  CONSUMER,
  CONTRACT_IDEMPOTENCY_KEY,
  MISSING_TX_ID,
  PACT_DIR,
  PROVIDER,
  STATES,
} from '../pact-config';

const { like, uuid, regex, integer, datetime } = MatchersV3;

const provider = new PactV3({ consumer: CONSUMER, provider: PROVIDER, dir: PACT_DIR, logLevel: 'warn' });

const JSON_CONTENT_TYPE = { 'Content-Type': regex('application/json.*', 'application/json; charset=utf-8') };
const STATUS = regex('^(approved|declined|pending|cancelled)$', 'approved');
const ISO_DATETIME = datetime("yyyy-MM-dd'T'HH:mm:ss.SSSX", '2026-11-17T12:00:00.000Z');

describe('Contrato pos-terminal → pos-payments-api', () => {
  it('POS-110 cria venda no débito aprovada', async () => {
    provider
      .given(STATES.noTransactionForKey)
      .uponReceiving('uma venda no débito de R$ 15,00')
      .withRequest({
        method: 'POST',
        path: '/transactions',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': like(CONTRACT_IDEMPOTENCY_KEY) },
        body: { amount: 1500, method: 'debit' },
      })
      .willRespondWith({
        status: 201,
        headers: JSON_CONTENT_TYPE,
        body: {
          id: uuid('3b9f6c1e-2a4d-4f8e-9b7a-1c2d3e4f5a6b'),
          amount: integer(1500),
          method: like('debit'),
          installments: integer(1),
          status: STATUS,
          authorizationCode: regex('^\\d{6}$', '123456'),
          idempotencyKey: like(CONTRACT_IDEMPOTENCY_KEY),
          createdAt: ISO_DATETIME,
        },
      });

    await provider.executeTest(async (mockServer) => {
      const client = new PosClient(mockServer.url);
      const tx = await client.createTransaction({ amount: 1500, method: 'debit' }, CONTRACT_IDEMPOTENCY_KEY);
      expect(tx.status).toBe('approved');
      expect(tx.authorizationCode).toMatch(/^\d{6}$/);
    });
  });

  it('POS-111 consulta uma transação existente', async () => {
    provider
      .given(STATES.approvedTransactionExists)
      .uponReceiving('a consulta de uma transação aprovada')
      .withRequest({ method: 'GET', path: `/transactions/${APPROVED_TX_ID}` })
      .willRespondWith({
        status: 200,
        headers: JSON_CONTENT_TYPE,
        body: {
          id: uuid(APPROVED_TX_ID),
          amount: integer(1500),
          method: like('debit'),
          installments: integer(1),
          status: regex('^approved$', 'approved'),
          authorizationCode: regex('^\\d{6}$', '123456'),
          idempotencyKey: like('seed-key'),
          createdAt: ISO_DATETIME,
        },
      });

    await provider.executeTest(async (mockServer) => {
      const tx = await new PosClient(mockServer.url).getTransaction(APPROVED_TX_ID);
      expect(tx?.id).toBe(APPROVED_TX_ID);
      expect(tx?.status).toBe('approved');
    });
  });

  it('POS-112 consulta uma transação inexistente', async () => {
    provider
      .given(STATES.transactionDoesNotExist)
      .uponReceiving('a consulta de uma transação inexistente')
      .withRequest({ method: 'GET', path: `/transactions/${MISSING_TX_ID}` })
      .willRespondWith({
        status: 404,
        headers: JSON_CONTENT_TYPE,
        body: { error: 'TRANSACTION_NOT_FOUND', message: like('Transação não encontrada.') },
      });

    await provider.executeTest(async (mockServer) => {
      const tx = await new PosClient(mockServer.url).getTransaction(MISSING_TX_ID);
      expect(tx).toBeNull();
    });
  });

  it('POS-113 cancela uma transação aprovada', async () => {
    provider
      .given(STATES.approvedTransactionExists)
      .uponReceiving('o cancelamento de uma transação aprovada')
      .withRequest({ method: 'POST', path: `/transactions/${APPROVED_TX_ID}/cancel` })
      .willRespondWith({
        status: 200,
        headers: JSON_CONTENT_TYPE,
        body: {
          id: uuid(APPROVED_TX_ID),
          amount: integer(1500),
          method: like('debit'),
          installments: integer(1),
          status: regex('^cancelled$', 'cancelled'),
          idempotencyKey: like('seed-key'),
          createdAt: ISO_DATETIME,
        },
      });

    await provider.executeTest(async (mockServer) => {
      const tx = await new PosClient(mockServer.url).cancelTransaction(APPROVED_TX_ID);
      expect(tx.status).toBe('cancelled');
    });
  });
});
