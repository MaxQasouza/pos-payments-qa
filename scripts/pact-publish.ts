/**
 * Publica os pacts gerados em /pacts no Pact Broker / PactFlow.
 * - Sem PACT_BROKER_BASE_URL e PACT_BROKER_TOKEN: imprime aviso e sai com código 0
 *   (não quebra a pipeline de quem ainda não tem broker).
 * - Versão do consumer = git sha; branch = git branch (ou GIT_SHA / GIT_BRANCH no CI).
 * Usa o endpoint POST /contracts/publish (Pact Broker >= 2.86 e PactFlow).
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PACT_DIR = path.resolve(__dirname, '..', 'pacts');

function git(command: string, fallback: string): string {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  } catch {
    return fallback;
  }
}

async function main() {
  const baseUrl = process.env.PACT_BROKER_BASE_URL;
  const token = process.env.PACT_BROKER_TOKEN;
  if (!baseUrl || !token) {
    console.warn('[pact:publish] PACT_BROKER_BASE_URL/PACT_BROKER_TOKEN não definidos. Publicação ignorada.');
    return;
  }

  const files = existsSync(PACT_DIR) ? readdirSync(PACT_DIR).filter((f) => f.endsWith('.json')) : [];
  if (files.length === 0) {
    console.error('[pact:publish] Nenhum pact em /pacts. Rode "npm run test:contract" antes.');
    process.exitCode = 1;
    return;
  }

  const version = process.env.GIT_SHA ?? git('git rev-parse HEAD', 'local');
  const branch = process.env.GIT_BRANCH ?? git('git rev-parse --abbrev-ref HEAD', 'local');

  for (const file of files) {
    const content = readFileSync(path.join(PACT_DIR, file), 'utf8');
    const pact = JSON.parse(content);
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/contracts/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pacticipantName: pact.consumer.name,
        pacticipantVersionNumber: version,
        branch,
        contracts: [
          {
            consumerName: pact.consumer.name,
            providerName: pact.provider.name,
            specification: 'pact',
            contentType: 'application/json',
            content: Buffer.from(content).toString('base64'),
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error(`[pact:publish] Falha ao publicar ${file}: HTTP ${response.status} ${await response.text()}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[pact:publish] ${file} publicado (versão ${version}, branch ${branch}).`);
  }
}

main();
