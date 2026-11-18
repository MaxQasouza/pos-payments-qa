import type { config as SqlConfig } from 'mssql';

/** Configuração do SQL Server a partir das variáveis DB_*. Valores padrão = ambiente de dev (docker-compose). */
export function sqlServerConfig(database = process.env.DB_NAME ?? 'PosPayments'): SqlConfig {
  return {
    server: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 1433),
    user: process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? 'PosPayments@2026',
    database,
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  };
}
