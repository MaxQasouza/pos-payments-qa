import { createApp } from './app';
import { log } from './logger';
import { createRepository } from './repositories';

async function main() {
  const repo = await createRepository();
  const port = Number(process.env.PORT ?? 3000);
  createApp(repo).listen(port, () => {
    log('info', {
      message: `API ouvindo na porta ${port}`,
      dbMode: repo.mode,
      testRoutes: process.env.ENABLE_TEST_ROUTES === '1',
      bugMode: process.env.BUG_MODE === '1',
    });
  });
}

main().catch((error) => {
  log('error', { message: 'falha ao iniciar a API', error: String(error) });
  process.exit(1);
});
