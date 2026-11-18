import { expect, test } from '@playwright/test';
import { createTransaction, listByIdempotencyKey, type TransactionBody } from '../support/api-client';
import { AMOUNTS, buildTransaction, newIdempotencyKey } from '../support/factories';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test.describe('Venda - fluxo principal', () => {
  test('POS-001 @smoke deve aprovar venda no débito', async ({ request }) => {
    const { response, idempotencyKey } = await createTransaction(request, buildTransaction({ method: 'debit' }));
    expect(response.status()).toBe(201);
    const body = (await response.json()) as TransactionBody;
    expect(body).toMatchObject({ amount: 1500, method: 'debit', installments: 1, status: 'approved', idempotencyKey });
    expect(body.id).toMatch(UUID);
    expect(body.authorizationCode).toMatch(/^\d{6}$/);
    expect(new Date(body.createdAt).toString()).not.toBe('Invalid Date');
  });

  test('POS-002 @smoke deve aprovar venda no pix', async ({ request }) => {
    const { response } = await createTransaction(request, buildTransaction({ method: 'pix' }));
    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({ method: 'pix', installments: 1, status: 'approved' });
  });

  test('POS-003 @smoke deve aprovar venda no crédito parcelado em 3x', async ({ request }) => {
    const { response } = await createTransaction(request, buildTransaction({ method: 'credit', installments: 3 }));
    expect(response.status()).toBe(201);
    expect(await response.json()).toMatchObject({ method: 'credit', installments: 3, status: 'approved' });
  });

  test('POS-004 deve consultar uma transação pelo id', async ({ request }) => {
    const { response } = await createTransaction(request);
    const created = (await response.json()) as TransactionBody;

    const found = await request.get(`/transactions/${created.id}`);
    expect(found.status()).toBe(200);
    expect(await found.json()).toEqual(created);
  });

  test('POS-005 deve retornar 404 para transação inexistente', async ({ request }) => {
    const response = await request.get('/transactions/00000000-0000-4000-8000-000000000000');
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'TRANSACTION_NOT_FOUND' });
  });

  test('POS-006 @smoke deve exigir o header Idempotency-Key (400)', async ({ request }) => {
    const response = await request.post('/transactions', { data: buildTransaction() });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'MISSING_IDEMPOTENCY_KEY' });
  });

  test('POS-007 @smoke health check deve responder ok', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
});

test.describe('Valor limite - amount (centavos)', () => {
  const cases = [
    { id: 'POS-010', amount: 0, expected: 422, label: 'zero é inválido' },
    { id: 'POS-011', amount: 1, expected: 201, label: '1 centavo é o mínimo válido' },
    { id: 'POS-012', amount: 10_000_000, expected: 201, label: 'R$ 100.000,00 é o máximo válido' },
    { id: 'POS-013', amount: 10_000_001, expected: 422, label: 'acima do máximo é inválido' },
  ];
  for (const c of cases) {
    test(`${c.id} amount=${c.amount}: ${c.label} (${c.expected})`, async ({ request }) => {
      const { response } = await createTransaction(request, buildTransaction({ amount: c.amount }));
      expect(response.status()).toBe(c.expected);
      if (c.expected === 422) expect(await response.json()).toMatchObject({ error: 'INVALID_AMOUNT' });
    });
  }
});

test.describe('Valor limite - parcelas no crédito', () => {
  const cases = [
    { id: 'POS-014', installments: 0, expected: 422 },
    { id: 'POS-015', installments: 1, expected: 201 },
    { id: 'POS-016', installments: 12, expected: 201 },
    { id: 'POS-017', installments: 13, expected: 422 },
  ];
  for (const c of cases) {
    test(`${c.id} crédito com ${c.installments} parcela(s) → ${c.expected}`, async ({ request }) => {
      const { response } = await createTransaction(
        request,
        buildTransaction({ method: 'credit', installments: c.installments }),
      );
      expect(response.status()).toBe(c.expected);
      const body = await response.json();
      if (c.expected === 422) {
        expect(body).toMatchObject({ error: 'INVALID_INSTALLMENTS' });
        expect(body.message).toEqual(expect.any(String));
      } else {
        expect(body.installments).toBe(c.installments);
      }
    });
  }
});

test.describe('Partição de equivalência - amount inválido', () => {
  const invalid = [
    { id: 'POS-020', label: 'string', payload: { amount: '1500', method: 'debit' } },
    { id: 'POS-021', label: 'decimal', payload: { amount: 15.5, method: 'debit' } },
    { id: 'POS-022', label: 'negativo', payload: { amount: -100, method: 'debit' } },
    { id: 'POS-023', label: 'ausente', payload: { method: 'debit' } },
  ];
  for (const c of invalid) {
    test(`${c.id} amount ${c.label} deve retornar 422`, async ({ request }) => {
      const { response } = await createTransaction(request, c.payload);
      expect(response.status()).toBe(422);
      const body = await response.json();
      expect(body.error).toBe('INVALID_AMOUNT');
      expect(body.message).toContain('centavos');
    });
  }

  test('POS-024 forma de pagamento desconhecida deve retornar 422', async ({ request }) => {
    const { response } = await createTransaction(request, buildTransaction({ method: 'boleto' }));
    expect(response.status()).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'INVALID_METHOD' });
  });
});

test.describe('Tabela de decisão - method x installments', () => {
  // Cada linha é uma regra da tabela de decisão (docs/estrategia-de-testes.md).
  const rules = [
    { id: 'POS-030', method: 'credit', installments: undefined, expected: 201, finalInstallments: 1 },
    { id: 'POS-031', method: 'credit', installments: 6, expected: 201, finalInstallments: 6 },
    { id: 'POS-032', method: 'debit', installments: undefined, expected: 201, finalInstallments: 1 },
    { id: 'POS-033', method: 'debit', installments: 1, expected: 201, finalInstallments: 1 },
    { id: 'POS-034', method: 'debit', installments: 2, expected: 422 },
    { id: 'POS-035', method: 'pix', installments: 1, expected: 201, finalInstallments: 1 },
    { id: 'POS-036', method: 'pix', installments: 3, expected: 422 },
  ];
  for (const r of rules) {
    test(`${r.id} ${r.method} com parcelas=${r.installments ?? 'omitido'} → ${r.expected}`, async ({ request }) => {
      const payload = buildTransaction({ method: r.method });
      if (r.installments !== undefined) payload.installments = r.installments;
      const { response } = await createTransaction(request, payload);
      expect(response.status()).toBe(r.expected);
      if (r.expected === 201) expect((await response.json()).installments).toBe(r.finalInstallments);
    });
  }
});

test.describe('Idempotência - proteção contra cobrança duplicada', () => {
  test('POS-040 @smoke @idempotencia mesma key repetida deve gerar uma única transação', async ({ request }) => {
    const key = newIdempotencyKey();
    const first = await createTransaction(request, buildTransaction(), key);
    const second = await createTransaction(request, buildTransaction(), key);

    expect(first.response.status()).toBe(201);
    expect(second.response.status()).toBe(200);
    expect((await second.response.json()).id).toBe((await first.response.json()).id);
    expect(await listByIdempotencyKey(request, key)).toHaveLength(1);
  });

  test('POS-041 @idempotencia mesma key com body diferente deve retornar 409', async ({ request }) => {
    const key = newIdempotencyKey();
    await createTransaction(request, buildTransaction({ amount: 1500 }), key);
    const conflict = await createTransaction(request, buildTransaction({ amount: 2500 }), key);

    expect(conflict.response.status()).toBe(409);
    expect(await conflict.response.json()).toMatchObject({ error: 'IDEMPOTENCY_KEY_CONFLICT' });
    expect(await listByIdempotencyKey(request, key)).toHaveLength(1);
  });

  test('POS-042 @idempotencia requisições simultâneas com a mesma key geram uma única transação', async ({ request }) => {
    const key = newIdempotencyKey();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => createTransaction(request, buildTransaction(), key)),
    );
    const ids = new Set(await Promise.all(responses.map(async (r) => (await r.response.json()).id)));

    expect(ids.size).toBe(1);
    expect(await listByIdempotencyKey(request, key)).toHaveLength(1);
  });
});

test.describe('Integração com o autorizador (mock)', () => {
  test('POS-050 venda recusada pela bandeira deve ficar declined (201)', async ({ request }) => {
    const { response } = await createTransaction(request, buildTransaction({ amount: AMOUNTS.declined }));
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('declined');
    expect(body.authorizationCode).toBeUndefined();
  });

  test('POS-051 timeout do autorizador deve deixar a venda pending (202), nunca aprovar/recusar', async ({
    request,
  }) => {
    const { response } = await createTransaction(request, buildTransaction({ amount: AMOUNTS.slow }));
    expect(response.status()).toBe(202);
    const body = await response.json();
    expect(body.status).toBe('pending');
    expect(body.authorizationCode).toBeUndefined();
  });

  test('POS-052 @idempotencia retentativa de venda pending não deve chamar o autorizador de novo', async ({
    request,
  }) => {
    const key = newIdempotencyKey();
    await createTransaction(request, buildTransaction({ amount: AMOUNTS.slow }), key);

    const started = Date.now();
    const retry = await createTransaction(request, buildTransaction({ amount: AMOUNTS.slow }), key);
    expect(retry.response.status()).toBe(200);
    expect((await retry.response.json()).status).toBe('pending');
    // Se tivesse chamado o autorizador de novo, levaria >= 1,5 s (timeout).
    expect(Date.now() - started).toBeLessThan(1000);
    expect(await listByIdempotencyKey(request, key)).toHaveLength(1);
  });
});

test.describe('Observabilidade', () => {
  test('POS-060 @smoke X-Correlation-Id enviado deve ser devolvido na resposta', async ({ request }) => {
    const correlationId = `pos-terminal-${Date.now()}`;
    const { response } = await createTransaction(request, buildTransaction(), newIdempotencyKey(), {
      'X-Correlation-Id': correlationId,
    });
    expect(response.headers()['x-correlation-id']).toBe(correlationId);
  });

  test('POS-061 X-Correlation-Id deve ser gerado quando não enviado', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.headers()['x-correlation-id']).toMatch(UUID);
  });
});
