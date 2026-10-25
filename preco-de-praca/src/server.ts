import { criarApp } from './app.ts';
import { config } from './config.ts';
import { criarPool, migrar } from './db.ts';
import { fecharSemanasPendentes } from './estatistica/fechamento.ts';

const db = criarPool();
await migrar(db);
const app = await criarApp({ db, logger: true });

// Fecha as semanas cujo prazo terminou. Roda ao subir e a cada hora; é idempotente.
async function fechar() {
  try {
    const fechadas = await fecharSemanasPendentes(db);
    if (fechadas.length) app.log.info({ fechadas }, 'semanas publicadas');
  } catch (e) {
    app.log.error(e, 'falha ao fechar semanas');
  }
}
await fechar();
setInterval(fechar, 3600e3).unref();

await app.listen({ port: config.porta, host: '0.0.0.0' });
