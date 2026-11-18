"""
POS-120 — Teste de carga da Payments API com Locust.

Pré-requisito: mock do autorizador + API rodando (npm run dev).
Execução: npm run test:perf  (20 usuários, spawn 5/s, 30 s, relatório em reports/locust.html)

Critérios de aceite (SLO da demo) — se violados, o processo sai com código 1:
  - taxa de falha <= 1%
  - p95 <= 500 ms
"""
import os
import random
import uuid

from locust import HttpUser, between, events, task

MAX_FAIL_RATIO = 0.01
MAX_P95_MS = 500

# Garante a pasta do relatório HTML (--html reports/locust.html) em qualquer SO.
os.makedirs("reports", exist_ok=True)


def safe_amount(minimum: int = 100, maximum: int = 50_000) -> int:
    """Valor aleatório que NUNCA termina em 98 (lento) ou 99 (recusado) no mock."""
    while True:
        amount = random.randint(minimum, maximum)
        if amount % 100 not in (98, 99):
            return amount


class PosTerminal(HttpUser):
    wait_time = between(0.2, 1.0)

    def on_start(self):
        self.transaction_ids: list[str] = []

    def _sell(self, method: str, installments: int | None = None, name: str = "POST /transactions"):
        body = {"amount": safe_amount(), "method": method}
        if installments:
            body["installments"] = installments
        headers = {"Idempotency-Key": f"locust-{uuid.uuid4()}", "X-Correlation-Id": f"locust-{uuid.uuid4()}"}
        with self.client.post("/transactions", json=body, headers=headers, name=name, catch_response=True) as resp:
            if resp.status_code != 201 or resp.json().get("status") != "approved":
                resp.failure(f"esperado 201/approved, recebido {resp.status_code}: {resp.text[:120]}")
                return
            self.transaction_ids.append(resp.json()["id"])
            self.transaction_ids = self.transaction_ids[-50:]

    @task(5)
    def venda_debito(self):
        self._sell("debit", name="POST /transactions [debito]")

    @task(3)
    def venda_credito_parcelado(self):
        self._sell("credit", installments=random.randint(2, 12), name="POST /transactions [credito parcelado]")

    @task(2)
    def venda_pix(self):
        self._sell("pix", name="POST /transactions [pix]")

    @task(2)
    def consultar_transacao(self):
        if not self.transaction_ids:
            return
        tx_id = random.choice(self.transaction_ids)
        self.client.get(f"/transactions/{tx_id}", name="GET /transactions/:id")


@events.quitting.add_listener
def aplicar_criterios_de_aceite(environment, **_kwargs):
    stats = environment.stats.total
    fail_ratio = stats.fail_ratio
    p95 = stats.get_response_time_percentile(0.95) or 0
    motivos = []
    if fail_ratio > MAX_FAIL_RATIO:
        motivos.append(f"taxa de falha {fail_ratio:.2%} acima do limite de {MAX_FAIL_RATIO:.0%}")
    if p95 > MAX_P95_MS:
        motivos.append(f"p95 de {p95:.0f} ms acima do limite de {MAX_P95_MS} ms")

    if motivos:
        print("[performance] REPROVADO: " + "; ".join(motivos))
        environment.process_exit_code = 1
    else:
        print(f"[performance] APROVADO: {stats.num_requests} requisições, falhas {fail_ratio:.2%}, p95 {p95:.0f} ms")
        environment.process_exit_code = 0
