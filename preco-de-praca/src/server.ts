import { criarApp } from './app.ts';
import { gerarHash } from './auth.ts';
import { config } from './config.ts';
import { criarPool, migrar } from './db.ts';
import { fecharSemanasPendentes } from './estatistica/fechamento.ts';

const db = criarPool();
await migrar(db);
const app = await criarApp({ db, logger: true });

// Primeiro administrador, para quem publica sem acesso a terminal no servidor
if (process.env.ADMIN_EMAIL && process.env.ADMIN_SENHA_INICIAL) {
  if (process.env.ADMIN_SENHA_INICIAL.length < 10) throw new Error('ADMIN_SENHA_INICIAL precisa ter pelo menos 10 caracteres.');
  const { rowCount } = await db.query(`INSERT INTO usuarios (email, nome, senha_hash, admin) VALUES (lower($1), 'Administração', $2, true)
    ON CONFLICT (email) DO NOTHING`, [process.env.ADMIN_EMAIL, await gerarHash(process.env.ADMIN_SENHA_INICIAL)]);
  if (rowCount) app.log.info(`administrador ${process.env.ADMIN_EMAIL} criado`);
}
if (!config.icpBrasilCaDir) app.log.warn('certificados da ICP-Brasil ausentes: a cadeia das assinaturas não será verificada (npm run icp)');

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
