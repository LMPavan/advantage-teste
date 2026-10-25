import { criarApp } from './app.ts';
import { gerarHash } from './auth.ts';
import { config } from './config.ts';
import { criarPool, migrar } from './db.ts';
import { criarEnviador } from './email.ts';
import { fecharSemanasPendentes } from './estatistica/fechamento.ts';
import { enviarLembretes } from './lembretes.ts';

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
    const fechadas = await fecharSemanasPendentes(db, new Date(), config.cargaInicialAte);
    if (fechadas.length) app.log.info({ fechadas }, 'semanas publicadas');
  } catch (e) {
    app.log.error(e, 'falha ao fechar semanas');
  }
}
// Lembretes por e-mail; cada um é registrado antes do envio e não se repete
const enviarEmail = criarEnviador(msg => app.log.info(msg));
async function lembrar() {
  try {
    const n = await enviarLembretes(db, enviarEmail);
    if (n) app.log.info(`${n} lembretes enviados`);
  } catch (e) {
    app.log.error(e, 'falha ao enviar lembretes');
  }
}
async function rotinaHoraria() {
  await fechar();
  await lembrar();
}
await rotinaHoraria();
setInterval(rotinaHoraria, 3600e3).unref();
if (!config.smtpUrl) app.log.warn('SMTP_URL ausente: lembretes e recuperação de senha não serão enviados por e-mail');

await app.listen({ port: config.porta, host: '0.0.0.0' });
