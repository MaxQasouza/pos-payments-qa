# Casos de teste — pos-payments-qa

Prioridade definida por **risco** (impacto financeiro/cliente × probabilidade):

- **Alta**: pode gerar cobrança indevida, venda perdida ou status divergente.
- **Média**: venda bloqueada indevidamente, mas sem prejuízo financeiro.
- **Baixa**: diagnóstico, usabilidade ou conveniência.

Os IDs aparecem no título dos testes automatizados (`POS-001 ...`) e como tags nos arquivos Gherkin (`@POS-001`). Assim dá para rastrear cada caso até o Xray.

## Venda: fluxo principal

| ID | Título | Técnica | Prioridade | Tipo | Automação |
|---|---|---|---|---|---|
| POS-001 | Aprovar venda no débito | Caminho feliz | Alta | Funcional | API |
| POS-002 | Aprovar venda no pix | Caminho feliz | Alta | Funcional | API |
| POS-003 | Aprovar venda no crédito em 3x | Caminho feliz | Alta | Funcional | API |
| POS-004 | Consultar transação por id | Caminho feliz | Média | Funcional | API |
| POS-005 | Consultar transação inexistente → 404 | Partição de equivalência | Baixa | Funcional | API |
| POS-006 | Rejeitar venda sem `Idempotency-Key` → 400 | Partição de equivalência | Alta | Funcional | API |
| POS-007 | Health check | Smoke | Média | Funcional | API |

## Validação de valor e parcelas

| ID | Título | Técnica | Prioridade | Tipo | Automação |
|---|---|---|---|---|---|
| POS-010 | amount = 0 → 422 | Valor limite | Alta | Funcional | API |
| POS-011 | amount = 1 (mínimo) → 201 | Valor limite | Média | Funcional | API |
| POS-012 | amount = 10.000.000 (máximo) → 201 | Valor limite | Média | Funcional | API |
| POS-013 | amount = 10.000.001 → 422 | Valor limite | Alta | Funcional | API |
| POS-014 | crédito com 0 parcelas → 422 | Valor limite | Média | Funcional | API |
| POS-015 | crédito com 1 parcela → 201 | Valor limite | Média | Funcional | API |
| POS-016 | crédito com 12 parcelas → 201 | Valor limite | Média | Funcional | API |
| POS-017 | crédito com 13 parcelas → 422 | Valor limite | Média | Funcional | API |
| POS-020 | amount como string → 422 | Partição de equivalência | Alta | Funcional | API |
| POS-021 | amount decimal → 422 | Partição de equivalência | Alta | Funcional | API |
| POS-022 | amount negativo → 422 | Partição de equivalência | Alta | Funcional | API |
| POS-023 | amount ausente → 422 | Partição de equivalência | Alta | Funcional | API |
| POS-024 | Forma de pagamento desconhecida → 422 | Partição de equivalência | Média | Funcional | API |
| POS-030 a POS-036 | Combinações de method × installments | Tabela de decisão | Média | Funcional | API |

## Idempotência (cobrança duplicada)

| ID | Título | Técnica | Prioridade | Tipo | Automação |
|---|---|---|---|---|---|
| POS-040 | Mesma key repetida → 1 transação, 200 na repetição | Idempotência | Alta | Funcional | API |
| POS-041 | Mesma key com body diferente → 409 | Idempotência | Alta | Funcional | API |
| POS-042 | 5 requisições simultâneas com a mesma key → 1 transação | Idempotência / concorrência | Alta | Funcional | API |
| POS-052 | Retry de venda pending não chama o autorizador de novo | Idempotência | Alta | Integração | API |
| POS-087 | **Resposta perdida**: a API aprova, o POS não recebe a resposta, o retry não duplica | Idempotência / falha de rede | Alta | Integração | UI |
| POS-103 | Idempotência no smoke | Idempotência | Alta | Funcional | Robot |

## Integração com o autorizador

| ID | Título | Técnica | Prioridade | Tipo | Automação |
|---|---|---|---|---|---|
| POS-050 | Recusa da bandeira (valor terminado em 99) → declined | Mock / integração | Alta | Integração | API |
| POS-051 | Timeout da bandeira (valor terminado em 98) → pending, 202 | Mock / injeção de falha | Alta | Integração | API |

## Cancelamento (transição de estado)

| ID | Título | Técnica | Prioridade | Tipo | Automação |
|---|---|---|---|---|---|
| POS-070 | approved → cancelled | Transição de estado | Alta | Funcional | API |
| POS-071 | cancelled → cancelar de novo → 409 | Transição de estado | Alta | Funcional | API |
| POS-072 | declined → cancelar → 422 | Transição de estado | Média | Funcional | API |
| POS-073 | pending → cancelar → 422 | Transição de estado | Alta | Funcional | API |
| POS-074 | Cancelar transação inexistente → 404 | Partição de equivalência | Baixa | Funcional | API |
| POS-104 | Cancelamento no smoke | Transição de estado | Alta | Funcional | Robot |

## Observabilidade

| ID | Título | Técnica | Prioridade | Tipo | Automação |
|---|---|---|---|---|---|
| POS-060 | `X-Correlation-Id` enviado volta na resposta | Observabilidade | Média | Funcional | API |
| POS-061 | `X-Correlation-Id` gerado quando ausente | Observabilidade | Baixa | Funcional | API |

## Tela do POS (mobile)

| ID | Título | Técnica | Prioridade | Tipo | Automação |
|---|---|---|---|---|---|
| POS-080 | Venda aprovada no débito com comprovante | Caminho feliz | Alta | Funcional | UI |
| POS-081 | Venda aprovada no pix com comprovante | Caminho feliz | Alta | Funcional | UI |
| POS-082 | Venda aprovada no crédito 3x com comprovante | Caminho feliz | Alta | Funcional | UI |
| POS-083 | Seletor de parcelas só aparece no crédito | Tabela de decisão | Média | Funcional | UI |
| POS-084 | Venda recusada exibe RECUSADA | Mock / integração | Alta | Integração | UI |
| POS-085 | Venda pending orienta a não cobrar de novo | Mock / injeção de falha | Alta | Integração | UI |
| POS-086 | Sem internet: erro de rede, volta online, retry aprova | Falha de rede | Alta | Integração | UI |

## Banco de dados (SQL Server)

| ID | Título | Técnica | Prioridade | Tipo | Automação |
|---|---|---|---|---|---|
| POS-090 | Venda gravada com o mesmo status, `COUNT(*)` por key = 1 | Validação de dados | Alta | Integração | API + SQL |
| POS-091 | Cancelamento grava `cancelled` e `UpdatedAt > CreatedAt` | Validação de dados | Média | Integração | API + SQL |
| POS-092 | Índice único barra insert duplicado direto no banco | Defesa em profundidade | Alta | Integração | API + SQL |

## Contrato, smoke e performance

| ID | Título | Técnica | Prioridade | Tipo | Automação |
|---|---|---|---|---|---|
| POS-100 a POS-102 | Health, venda débito, valor inválido | Smoke | Alta | Funcional | Robot |
| POS-110 | Contrato: criar venda no débito aprovada | Consumer-driven contract | Alta | Contrato | Contrato |
| POS-111 | Contrato: consultar transação existente | Consumer-driven contract | Alta | Contrato | Contrato |
| POS-112 | Contrato: consultar transação inexistente → 404 | Consumer-driven contract | Média | Contrato | Contrato |
| POS-113 | Contrato: cancelar transação aprovada | Consumer-driven contract | Alta | Contrato | Contrato |
| POS-120 | Carga: 20 usuários, p95 ≤ 500 ms e falhas ≤ 1% | Teste de carga | Alta | Performance | Locust |

## Casos manuais de hardware POS

Estes casos dependem do **terminal físico** (bateria, impressora, rádio, leitora). O projeto simula só o backend e uma tela web, então automatizá-los aqui seria um teatro de teste. Eles rodam em bancada, com o aparelho real, a cada release de firmware ou app do POS. A evolução natural é Appium em POS Android real (ver *Próximos passos* no README).

| ID | Título | Técnica | Prioridade | Tipo | Automação | Justificativa / o que observar |
|---|---|---|---|---|---|---|
| POS-200 | Bateria baixa (≤ 5%) durante a venda | Teste exploratório / falha de hardware | Alta | Funcional | Manual | Depende do hardware real. Verificar aviso antes de iniciar a venda e que, se o aparelho desligar, ao religar a venda apareça como pending/aprovada e não seja refeita. |
| POS-201 | Impressora sem papel ao emitir o comprovante | Falha de hardware | Média | Funcional | Manual | A venda já foi aprovada: o POS **não pode** refazer a cobrança para reimprimir. Verificar a opção "reimprimir última" e o comprovante digital. |
| POS-202 | Troca de chip/operadora (4G ↔ Wi-Fi) no meio da venda | Falha de rede | Alta | Integração | Manual | A troca real de rádio/APN não se simula de forma fiel em navegador. Na tela web, POS-086/POS-087 cobrem a lógica. Aqui valida-se o comportamento real do modem. |
| POS-203 | Aparelho reinicia no meio da transação | Falha de hardware / recuperação | Alta | Integração | Manual | Validar que, ao religar, o POS consulta o status pela Idempotency-Key persistida localmente e não gera nova cobrança. |
| POS-204 | Chip (EMV) vs aproximação (NFC) | Partição de equivalência (meio de captura) | Alta | Funcional | Manual | Exige leitora e cartões de teste das bandeiras. Validar mesmo valor e status em ambos os meios e o limite de valor sem senha no NFC. |
| POS-205 | Tarja magnética danificada | Falha de hardware | Média | Funcional | Manual | Exige cartão físico danificado. Validar a mensagem de fallback para chip/NFC e que nenhuma transação "fantasma" é registrada. |
