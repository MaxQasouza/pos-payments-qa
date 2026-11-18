import { expect, test } from '@playwright/test';
import { listByIdempotencyKey } from '../support/api-client';
import { PosPage } from '../support/pos-page';

test.describe('POS mobile - venda na maquininha', () => {
  let pos: PosPage;

  test.beforeEach(async ({ page }) => {
    pos = new PosPage(page);
    await pos.open();
  });

  test('POS-080 @smoke venda aprovada no débito exibe comprovante', async () => {
    await pos.sell('2550', 'debit');
    await pos.expectReceipt('APROVADA', '25,50', 'Débito');
    await expect(pos.pendingMessage).toBeHidden();
  });

  test('POS-081 venda aprovada no pix exibe comprovante', async () => {
    await pos.sell('1000', 'pix');
    await pos.expectReceipt('APROVADA', '10,00', 'Pix');
  });

  test('POS-082 venda aprovada no crédito em 3x exibe comprovante', async () => {
    await pos.chooseMethod('credit');
    await expect(pos.installmentsSelect).toBeVisible();
    await pos.sell('30000', 'credit', 3);
    await pos.expectReceipt('APROVADA', '300,00', 'Crédito 3x');
  });

  test('POS-083 seletor de parcelas só aparece no crédito', async () => {
    await pos.chooseMethod('debit');
    await expect(pos.installmentsSelect).toBeHidden();
    await pos.chooseMethod('credit');
    await expect(pos.installmentsSelect).toBeVisible();
    await pos.chooseMethod('pix');
    await expect(pos.installmentsSelect).toBeHidden();
  });

  test('POS-084 venda recusada pela bandeira exibe RECUSADA', async () => {
    await pos.sell('1099', 'debit'); // termina em 99 → recusa no mock
    await pos.expectReceipt('RECUSADA', '10,99', 'Débito');
  });

  test('POS-085 venda pending orienta a não cobrar o cliente novamente', async () => {
    await pos.sell('1098', 'debit'); // termina em 98 → timeout → pending
    await expect(pos.receiptStatus).toHaveText('EM PROCESSAMENTO', { timeout: 10_000 });
    await expect(pos.pendingMessage).toHaveText('Venda em processamento. Não cobre o cliente novamente.');
  });

  test('POS-086 @resiliencia sem internet: erro de rede, volta online e retry aprova uma única vez', async ({
    page,
    context,
    request,
  }) => {
    let idempotencyKey = '';
    page.on('request', (req) => {
      if (req.url().endsWith('/transactions') && req.method() === 'POST') {
        idempotencyKey = req.headers()['idempotency-key'];
      }
    });

    await pos.typeAmount('4200');
    await pos.chooseMethod('debit');
    await context.setOffline(true);
    await pos.pay();
    await expect(pos.networkError).toBeVisible();

    await context.setOffline(false);
    await pos.retryButton.click();
    await pos.expectReceipt('APROVADA', '42,00', 'Débito');
    await expect(pos.networkError).toBeHidden();

    expect(idempotencyKey).not.toBe('');
    expect(await listByIdempotencyKey(request, idempotencyKey)).toHaveLength(1);
  });

  test('POS-087 @idempotencia RESPOSTA PERDIDA: retry após aprovação não gera cobrança duplicada', async ({
    page,
    request,
  }) => {
    // Simula a maquininha que perde a conexão depois que a bandeira já aprovou:
    // a requisição chega à API (route.fetch) e a venda é aprovada, mas a resposta
    // nunca chega ao navegador (route.abort). O operador então toca em "Tentar novamente".
    const capturedKeys: string[] = [];
    await page.route(
      '**/transactions',
      async (route) => {
        capturedKeys.push(route.request().headers()['idempotency-key']);
        const response = await route.fetch(); // a API processa e aprova de verdade
        expect(response.status()).toBe(201);
        await route.abort('connectionreset'); // ...mas o POS não recebe a resposta
      },
      { times: 1 },
    );
    page.on('request', (req) => {
      if (req.url().endsWith('/transactions') && req.method() === 'POST') {
        capturedKeys.push(req.headers()['idempotency-key']);
      }
    });

    await pos.sell('15000', 'credit', 2);
    await expect(pos.networkError).toBeVisible();

    await pos.retryButton.click();
    await pos.expectReceipt('APROVADA', '150,00', 'Crédito 2x');

    // A mesma key foi usada nas duas tentativas...
    const key = capturedKeys[0];
    expect(new Set(capturedKeys)).toEqual(new Set([key]));
    // ...e no backend existe EXATAMENTE 1 transação para ela.
    const transactions = await listByIdempotencyKey(request, key);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].status).toBe('approved');
  });
});
