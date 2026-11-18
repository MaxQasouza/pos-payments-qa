import { expect, test } from '@playwright/test';
import sql from 'mssql';
import { sqlServerConfig } from '../../api/src/repositories/sqlserver-config';
import { createTransaction, type TransactionBody } from '../support/api-client';
import { buildTransaction } from '../support/factories';

/**
 * Validação direta no banco: o que a API respondeu é o que ficou gravado?
 * Só roda com DB_MODE=sqlserver (API e testes apontando para o mesmo SQL Server).
 */
test.describe('Persistência no SQL Server', () => {
  test.skip(process.env.DB_MODE !== 'sqlserver', 'Requer DB_MODE=sqlserver');

  let pool: sql.ConnectionPool;

  test.beforeAll(async () => {
    pool = await new sql.ConnectionPool(sqlServerConfig()).connect();
  });

  test.afterAll(async () => {
    await pool?.close();
  });

  async function selectById(id: string) {
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query('SELECT Id, Status, Amount, Method, CreatedAt, UpdatedAt FROM dbo.Transactions WHERE Id = @id');
    return result.recordset[0];
  }

  async function countByKey(key: string): Promise<number> {
    const result = await pool
      .request()
      .input('key', sql.NVarChar(100), key)
      .query('SELECT COUNT(*) AS total FROM dbo.Transactions WHERE IdempotencyKey = @key');
    return result.recordset[0].total;
  }

  test('POS-090 @db venda criada pela API deve estar no banco com o mesmo status e sem duplicidade', async ({
    request,
  }) => {
    const { response, idempotencyKey } = await createTransaction(request, buildTransaction({ amount: 4321 }));
    const tx = (await response.json()) as TransactionBody;

    // Repete a mesma venda (retry da maquininha)
    await createTransaction(request, buildTransaction({ amount: 4321 }), idempotencyKey);

    const row = await selectById(tx.id);
    expect(row).toBeDefined();
    expect(row.Status).toBe(tx.status);
    expect(row.Amount).toBe(4321);
    expect(row.Method).toBe('debit');
    expect(await countByKey(idempotencyKey)).toBe(1);
  });

  test('POS-091 @db cancelamento deve gravar Status cancelled e UpdatedAt > CreatedAt', async ({ request }) => {
    const { response } = await createTransaction(request, buildTransaction());
    const tx = (await response.json()) as TransactionBody;
    expect((await request.post(`/transactions/${tx.id}/cancel`)).status()).toBe(200);

    const row = await selectById(tx.id);
    expect(row.Status).toBe('cancelled');
    expect(row.UpdatedAt.getTime()).toBeGreaterThan(row.CreatedAt.getTime());
  });

  test('POS-092 @db índice único deve impedir duas linhas com a mesma IdempotencyKey', async ({ request }) => {
    const { response, idempotencyKey } = await createTransaction(request, buildTransaction());
    expect(response.status()).toBe(201);

    // Simula uma falha na 1ª camada (aplicação): insert direto com a mesma key.
    const duplicateInsert = pool
      .request()
      .input('key', sql.NVarChar(100), idempotencyKey)
      .query(`INSERT INTO dbo.Transactions (Id, IdempotencyKey, RequestHash, Amount, Method, Installments, Status)
              VALUES (NEWID(), @key, REPLICATE('0', 64), 1500, 'debit', 1, 'approved')`);
    await expect(duplicateInsert).rejects.toThrow(/duplicate key|UX_Transactions_IdempotencyKey/i);
    expect(await countByKey(idempotencyKey)).toBe(1);
  });
});
