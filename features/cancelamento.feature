# language: pt
@cancelamento
Funcionalidade: Cancelamento de venda
  Como lojista
  Quero cancelar vendas aprovadas
  Para estornar o cliente quando a venda foi feita por engano

  @POS-070 @smoke @automatizado-api
  Cenário: Cancelar venda aprovada
    Dado que existe uma venda com status "approved"
    Quando eu solicito o cancelamento
    Então a API deve responder com o código 200
    E a transação deve ficar com status "cancelled"

  @POS-071 @automatizado-api
  Cenário: Cancelar venda já cancelada
    Dado que existe uma venda com status "cancelled"
    Quando eu solicito o cancelamento
    Então a API deve responder com o código 409

  @POS-072 @POS-073 @automatizado-api
  Esquema do Cenário: Não permitir cancelar venda que não foi aprovada
    Dado que existe uma venda com status "<status>"
    Quando eu solicito o cancelamento
    Então a API deve responder com o código 422

    Exemplos:
      | status   |
      | declined |
      | pending  |

  @POS-091 @db @automatizado-api
  Cenário: Cancelamento persistido no banco
    Dado que existe uma venda com status "approved"
    Quando eu solicito o cancelamento
    Então no SQL Server o registro deve ter Status "cancelled"
    E UpdatedAt deve ser maior que CreatedAt
