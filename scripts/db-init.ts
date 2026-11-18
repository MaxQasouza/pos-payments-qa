/**
 * Executa db/init.sql no SQL Server usando o pacote mssql (sem depender de sqlcmd).
 * Faz retry até DB_INIT_TIMEOUT_MS (padrão 60 s) esperando o SQL Server subir.
 * Lotes separados por "GO"; um lote "USE <banco>" reconecta no banco indicado.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sql from 'mssql';
import { sqlServerConfig } from '../api/src/repositories/sqlserver-config';

const TIMEOUT_MS = Number(process.env.DB_INIT_TIMEOUT_MS ?? 60_000);
const RETRY_INTERVAL_MS = 3_000;

async function connectWithRetry(database: string): Promise<sql.ConnectionPool> {
  const deadline = Date.now() + TIMEOUT_MS;
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return await new sql.ConnectionPool({ ...sqlServerConfig(database), pool: { max: 1, min: 0 } }).connect();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      console.log(`[db:init] SQL Server ainda indisponível (tentativa ${attempt}): ${(error as Error).message}`);
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
    }
  }
}

async function main() {
  const script = readFileSync(path.resolve(__dirname, '..', 'db', 'init.sql'), 'utf8');
  const batches = script
    .split(/^\s*GO\s*$/im)
    .map((b) => b.trim())
    .filter((b) => b.replace(/--.*$/gm, '').trim().length > 0);

  let pool = await connectWithRetry('master');
  for (const batch of batches) {
    const use = batch.replace(/--.*$/gm, '').trim().match(/^USE\s+\[?(\w+)\]?\s*;?$/i);
    if (use) {
      await pool.close();
      pool = await connectWithRetry(use[1]);
      continue;
    }
    await pool.request().batch(batch);
  }
  await pool.close();
  console.log('[db:init] Banco PosPayments pronto.');
}

main().catch((error) => {
  console.error(`[db:init] Falhou: ${(error as Error).message}`);
  process.exit(1);
});
