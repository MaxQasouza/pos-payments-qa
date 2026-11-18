import { expect, test, type APIRequestContext } from '@playwright/test';
import { createTransaction, type TransactionBody } from '../support/api-client';
import { AMOUNTS, buildTransaction } from '../support/factories';

async function createWithAmount(request: APIRequestContext, amount: number): Promise<TransactionBody> {
  const { response } = await createTransaction(request, buildTransaction({ amount }));
  return (await response.json()) as TransactionBody;
}

test.describe('Transição de estado - cancelamento', () => {
  test('POS-070 @smoke venda aprovada deve ser cancelada (approved → cancelled)', async ({ request }) => {
    const tx = await createWithAmount(request, AMOUNTS.approved);
    expect(tx.status).toBe('approved');

    const response = await request.post(`/transactions/${tx.id}/cancel`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ id: tx.id, status: 'cancelled' });

    const after = await request.get(`/transactions/${tx.id}`);
    expect((await after.json()).status).toBe('cancelled');
  });

  test('POS-071 cancelar venda já cancelada deve retornar 409', async ({ request }) => {
    const tx = await createWithAmount(request, AMOUNTS.approved);
    await request.post(`/transactions/${tx.id}/cancel`);

    const response = await request.post(`/transactions/${tx.id}/cancel`);
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'ALREADY_CANCELLED' });
  });

  test('POS-072 cancelar venda recusada deve retornar 422', async ({ request }) => {
    const tx = await createWithAmount(request, AMOUNTS.declined);
    expect(tx.status).toBe('declined');

    const response = await request.post(`/transactions/${tx.id}/cancel`);
    expect(response.status()).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'INVALID_STATUS_TRANSITION' });
  });

  test('POS-073 cancelar venda pending deve retornar 422', async ({ request }) => {
    const tx = await createWithAmount(request, AMOUNTS.slow);
    expect(tx.status).toBe('pending');

    const response = await request.post(`/transactions/${tx.id}/cancel`);
    expect(response.status()).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'INVALID_STATUS_TRANSITION' });
  });

  test('POS-074 cancelar transação inexistente deve retornar 404', async ({ request }) => {
    const response = await request.post('/transactions/00000000-0000-4000-8000-000000000000/cancel');
    expect(response.status()).toBe(404);
  });
});
