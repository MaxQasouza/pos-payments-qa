/**
 * Mock do autorizador externo (bandeira/adquirente).
 *
 * Regras determinísticas, controladas pelos centavos do valor:
 *  - termina em 99 → recusa (CARTAO_RECUSADO)
 *  - termina em 98 → responde só depois de 3000 ms (simula lentidão da bandeira)
 *  - demais        → aprova com código de autorização de 6 dígitos
 */
import express from 'express';

export const DECLINED_CENTS = 99;
export const SLOW_CENTS = 98;
export const SLOW_DELAY_MS = 3000;

export function createAuthorizerMock() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'authorizer-mock' });
  });

  app.post('/authorize', async (req, res) => {
    const amount = Number(req.body?.amount);
    const cents = amount % 100;

    if (cents === DECLINED_CENTS) {
      res.json({ approved: false, reason: 'CARTAO_RECUSADO' });
      return;
    }

    if (cents === SLOW_CENTS) {
      await new Promise((resolve) => setTimeout(resolve, SLOW_DELAY_MS));
    }

    const authorizationCode = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    res.json({ approved: true, authorizationCode });
  });

  return app;
}

// Só sobe o servidor quando executado diretamente (permite importar nos testes de contrato).
if (require.main === module) {
  const port = Number(process.env.AUTHORIZER_PORT ?? 4010);
  createAuthorizerMock().listen(port, () => {
    console.log(`[authorizer-mock] ouvindo na porta ${port}`);
  });
}
