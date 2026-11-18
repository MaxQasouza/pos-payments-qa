import sql from 'mssql';
import { sqlServerConfig } from './sqlserver-config';
import {
  DuplicateIdempotencyKeyError,
  type NewTransaction,
  type Transaction,
  type TransactionRepository,
  type TransactionStatus,
} from './transaction-repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = new Set([2601, 2627]);

interface Row {
  Id: string;
  IdempotencyKey: string;
  RequestHash: string;
  Amount: number;
  Method: Transaction['method'];
  Installments: number;
  Status: TransactionStatus;
  AuthorizationCode: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

function toTransaction(row: Row): Transaction {
  return {
    id: row.Id.toLowerCase(), // SQL Server devolve GUID em maiúsculas
    idempotencyKey: row.IdempotencyKey,
    requestHash: row.RequestHash,
    amount: row.Amount,
    method: row.Method,
    installments: row.Installments,
    status: row.Status,
    ...(row.AuthorizationCode ? { authorizationCode: row.AuthorizationCode } : {}),
    createdAt: row.CreatedAt.toISOString(),
    updatedAt: row.UpdatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { number?: number; originalError?: { info?: { number?: number } } };
  return UNIQUE_VIOLATION.has(e?.number ?? e?.originalError?.info?.number ?? 0);
}

/** Implementação SQL Server (DB_MODE=sqlserver). Todas as queries são parametrizadas. */
export class SqlServerTransactionRepository implements TransactionRepository {
  readonly mode = 'sqlserver' as const;

  private constructor(private readonly pool: sql.ConnectionPool) {}

  static async connect(): Promise<SqlServerTransactionRepository> {
    const pool = await new sql.ConnectionPool(sqlServerConfig()).connect();
    return new SqlServerTransactionRepository(pool);
  }

  async insert(tx: NewTransaction): Promise<Transaction> {
    try {
      const result = await this.pool
        .request()
        .input('id', sql.UniqueIdentifier, tx.id)
        .input('key', sql.NVarChar(100), tx.idempotencyKey)
        .input('hash', sql.Char(64), tx.requestHash)
        .input('amount', sql.Int, tx.amount)
        .input('method', sql.VarChar(10), tx.method)
        .input('installments', sql.TinyInt, tx.installments)
        .input('status', sql.VarChar(10), tx.status)
        .input('code', sql.Char(6), tx.authorizationCode ?? null).query<Row>(`
          INSERT INTO dbo.Transactions (Id, IdempotencyKey, RequestHash, Amount, Method, Installments, Status, AuthorizationCode)
          OUTPUT INSERTED.*
          VALUES (@id, @key, @hash, @amount, @method, @installments, @status, @code)`);
      return toTransaction(result.recordset[0]);
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateIdempotencyKeyError(tx.idempotencyKey);
      throw error;
    }
  }

  async findById(id: string): Promise<Transaction | undefined> {
    if (!UUID.test(id)) return undefined;
    const result = await this.pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .query<Row>('SELECT * FROM dbo.Transactions WHERE Id = @id');
    return result.recordset[0] ? toTransaction(result.recordset[0]) : undefined;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Transaction[]> {
    const result = await this.pool
      .request()
      .input('key', sql.NVarChar(100), idempotencyKey)
      .query<Row>('SELECT * FROM dbo.Transactions WHERE IdempotencyKey = @key ORDER BY CreatedAt');
    return result.recordset.map(toTransaction);
  }

  async updateStatus(id: string, status: TransactionStatus, authorizationCode?: string): Promise<Transaction | undefined> {
    if (!UUID.test(id)) return undefined;
    const result = await this.pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .input('status', sql.VarChar(10), status)
      .input('code', sql.Char(6), authorizationCode ?? null).query<Row>(`
        UPDATE dbo.Transactions
        SET Status = @status,
            AuthorizationCode = COALESCE(@code, AuthorizationCode),
            UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE Id = @id`);
    return result.recordset[0] ? toTransaction(result.recordset[0]) : undefined;
  }

  /** Usado apenas pelas rotas de teste (ENABLE_TEST_ROUTES=1). */
  async reset(): Promise<void> {
    await this.pool.request().query('DELETE FROM dbo.Transactions');
  }
}
