import path from 'node:path';

export const CONSUMER = 'pos-terminal';
export const PROVIDER = 'pos-payments-api';
export const PACT_DIR = path.resolve(__dirname, '..', '..', 'pacts');
export const PACT_FILE = path.join(PACT_DIR, `${CONSUMER}-${PROVIDER}.json`);

/** Dados fixos compartilhados entre consumer e provider states. */
export const APPROVED_TX_ID = '6f1c2a3e-4b5d-4e6f-8a7b-9c0d1e2f3a4b';
export const MISSING_TX_ID = '00000000-0000-4000-8000-000000000404';
export const CONTRACT_IDEMPOTENCY_KEY = 'contract-key-0001';

export const STATES = {
  noTransactionForKey: 'não existe transação para a Idempotency-Key contract-key-0001',
  approvedTransactionExists: `existe uma transação aprovada com id ${APPROVED_TX_ID}`,
  transactionDoesNotExist: `não existe transação com id ${MISSING_TX_ID}`,
};
