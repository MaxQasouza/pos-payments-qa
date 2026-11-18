import { execSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { Verifier } from '@pact-foundation/pact';
import { APPROVED_TX_ID, PACT_FILE, PROVIDER, STATES } from '../pact-config';

/**
 * Verificação do provider "pos-payments-api".
 * - Se PROVIDER_BASE_URL estiver definida, verifica contra a API já rodando (com ENABLE_TEST_ROUTES=1).
 * - Senão, sobe a API e o mock do autorizador em portas livres, dentro do próprio teste.
 */
let baseUrl = process.env.PROVIDER_BASE_URL ?? '';
const servers: Server[] = [];

function listen(app: { listen: (port: number, cb: () => void) => Server }): Promise<string> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
    servers.push(server);
  });
}

function gitInfo(command: string, fallback: string): string {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  } catch {
    return fallback;
  }
}

async function callTestRoute(path: string, body?: unknown): Promise<void> {
  const response = await fetch(`${baseUrl}/__test/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`/__test/${path} respondeu ${response.status} (ENABLE_TEST_ROUTES=1?)`);
}

describe('Verificação do provider pos-payments-api', () => {
  beforeAll(async () => {
    if (baseUrl) return;
    process.env.ENABLE_TEST_ROUTES = '1';
    process.env.LOG_SILENT = '1';
    const { createAuthorizerMock } = await import('../../../mocks/authorizer/server');
    process.env.AUTHORIZER_URL = await listen(createAuthorizerMock());
    const { createApp } = await import('../../../api/src/app');
    const { MemoryTransactionRepository } = await import('../../../api/src/repositories/memory-repository');
    baseUrl = await listen(createApp(new MemoryTransactionRepository()));
  });

  afterAll(() => {
    servers.forEach((s) => s.close());
  });

  it('honra o contrato do consumer pos-terminal', async () => {
    await new Verifier({
      provider: PROVIDER,
      providerBaseUrl: baseUrl,
      pactUrls: [PACT_FILE],
      providerVersion: process.env.GIT_SHA ?? gitInfo('git rev-parse --short HEAD', 'local'),
      providerVersionBranch: process.env.GIT_BRANCH ?? gitInfo('git rev-parse --abbrev-ref HEAD', 'local'),
      publishVerificationResult: false,
      logLevel: 'warn',
      stateHandlers: {
        [STATES.noTransactionForKey]: async () => {
          await callTestRoute('reset');
        },
        [STATES.approvedTransactionExists]: async () => {
          await callTestRoute('reset');
          await callTestRoute('seed', { id: APPROVED_TX_ID, amount: 1500, method: 'debit', status: 'approved' });
        },
        [STATES.transactionDoesNotExist]: async () => {
          await callTestRoute('reset');
        },
      },
    }).verifyProvider();
  });
});
