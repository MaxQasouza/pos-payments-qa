# language: pt
@venda
Funcionalidade: Venda na maquininha (POS)
  Como lojista
  Quero registrar vendas no débito, crédito e pix
  Para receber do cliente com segurança e sem cobrança duplicada

  Contexto:
    Dado que a maquininha está online e conectada à Payments API

  @POS-001 @smoke @automatizado-api
  Cenário: Venda aprovada no débito
    Quando eu registro uma venda de R$ 15,00 no débito
    Então a transação deve ser criada com status "approved"
    E deve conter um código de autorização de 6 dígitos

  @POS-003 @automatizado-api
  Cenário: Venda aprovada no crédito parcelado
    Quando eu registro uma venda de R$ 15,00 no crédito em 3 parcelas
    Então a transação deve ser criada com status "approved"
    E o número de parcelas deve ser 3

  @POS-010 @POS-011 @POS-012 @POS-013 @automatizado-api
  Esquema do Cenário: Valor limite do amount
    Quando eu registro uma venda de <amount> centavos no débito
    Então a API deve responder com o código <codigo>

    Exemplos:
      | amount   | codigo |
      | 0        | 422    |
      | 1        | 201    |
      | 10000000 | 201    |
      | 10000001 | 422    |

  @POS-030 @POS-034 @POS-036 @automatizado-api
  Esquema do Cenário: Tabela de decisão de forma de pagamento x parcelas
    Quando eu registro uma venda no "<method>" com <parcelas> parcela(s)
    Então a API deve responder com o código <codigo>

    Exemplos:
      | method | parcelas | codigo |
      | credit | 1        | 201    |
      | credit | 12       | 201    |
      | credit | 13       | 422    |
      | debit  | 2        | 422    |
      | pix    | 3        | 422    |

  @POS-050 @automatizado-api
  Cenário: Venda recusada pela bandeira
    Quando eu registro uma venda de R$ 10,99 no débito
    Então a transação deve ser criada com status "declined"

  @POS-051 @POS-085 @automatizado-api @automatizado-ui
  Cenário: Bandeira não responde a tempo
    Quando eu registro uma venda de R$ 10,98 e o autorizador demora mais que o timeout
    Então a API deve responder 202 com status "pending"
    E a maquininha deve exibir "Venda em processamento. Não cobre o cliente novamente."

  @POS-040 @idempotencia @automatizado-api
  Cenário: Mesma venda enviada duas vezes
    Dado que eu registrei uma venda com a Idempotency-Key "abc-123"
    Quando eu reenvio a mesma venda com a Idempotency-Key "abc-123"
    Então a API deve devolver a mesma transação com código 200
    E deve existir apenas 1 transação para a key "abc-123"

  @POS-041 @idempotencia @automatizado-api
  Cenário: Mesma key com dados diferentes
    Dado que eu registrei uma venda de R$ 15,00 com a Idempotency-Key "abc-456"
    Quando eu envio uma venda de R$ 25,00 com a Idempotency-Key "abc-456"
    Então a API deve responder com o código 409

  @POS-087 @idempotencia @automatizado-ui
  Cenário: Resposta perdida depois da aprovação
    Dado que a bandeira aprovou a venda
    Mas a maquininha perdeu a conexão antes de receber a resposta
    Quando o operador toca em "Tentar novamente"
    Então o comprovante deve mostrar "APROVADA"
    E deve existir exatamente 1 transação para a Idempotency-Key da venda

  @POS-202 @manual @hardware
  Cenário: Troca de operadora durante a venda
    Dado que a maquininha está conectada pelo chip da operadora A
    Quando a conexão muda para a operadora B no meio da autorização
    Então a venda deve terminar aprovada, recusada ou pending
    E nunca deve existir mais de uma cobrança para a mesma venda
