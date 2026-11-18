import { expect, type Locator, type Page } from '@playwright/test';
import type { Method } from './factories';

/** Page Object da tela da maquininha. */
export class PosPage {
  readonly amountInput: Locator;
  readonly installmentsSelect: Locator;
  readonly payButton: Locator;
  readonly receipt: Locator;
  readonly receiptStatus: Locator;
  readonly receiptAmount: Locator;
  readonly receiptMethod: Locator;
  readonly networkError: Locator;
  readonly retryButton: Locator;
  readonly pendingMessage: Locator;

  constructor(private readonly page: Page) {
    this.amountInput = page.getByTestId('amount-input');
    this.installmentsSelect = page.getByTestId('installments-select');
    this.payButton = page.getByTestId('pay-button');
    this.receipt = page.getByTestId('receipt');
    this.receiptStatus = page.getByTestId('receipt-status');
    this.receiptAmount = page.getByTestId('receipt-amount');
    this.receiptMethod = page.getByTestId('receipt-method');
    this.networkError = page.getByTestId('network-error');
    this.retryButton = page.getByTestId('retry-button');
    this.pendingMessage = page.getByTestId('pending-message');
  }

  async open() {
    await this.page.goto('/');
    await expect(this.payButton).toBeVisible();
  }

  /** Digita o valor como na maquininha: "2550" → R$ 25,50. */
  async typeAmount(digits: string) {
    await this.amountInput.fill(digits);
  }

  async chooseMethod(method: Method) {
    await this.page.getByTestId(`method-${method}`).click();
  }

  async chooseInstallments(n: number) {
    await this.installmentsSelect.selectOption(String(n));
  }

  async pay() {
    await this.payButton.click();
  }

  async sell(digits: string, method: Method, installments?: number) {
    await this.typeAmount(digits);
    await this.chooseMethod(method);
    if (installments) await this.chooseInstallments(installments);
    await this.pay();
  }

  async expectReceipt(status: string, amountText: string, methodText: string) {
    await expect(this.receipt).toBeVisible();
    await expect(this.receiptStatus).toHaveText(status);
    await expect(this.receiptAmount).toContainText(amountText);
    await expect(this.receiptMethod).toHaveText(methodText);
  }
}
