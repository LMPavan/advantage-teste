import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import { carregarUsuario } from './auth.ts';
import { config } from './config.ts';
import { carregarFaixas, carregarGeo, type Contexto } from './contexto.ts';
import type { Db } from './db.ts';
import { carregarAutoridades } from './nfe/assinatura.ts';
import { rotasAdmin } from './rotas/admin.ts';
import { rotasConta } from './rotas/conta.ts';
import { rotasNfe } from './rotas/nfe.ts';
import { rotasPainel } from './rotas/painel.ts';

export interface OpcoesApp {
  db: Db;
  agora?: () => Date;
  autoridades?: import('node:crypto').X509Certificate[];
  logger?: boolean;
}

export async function criarApp(op: OpcoesApp) {
  if (config.demo && config.producao) throw new Error('DEMO=1 não pode ser usado com NODE_ENV=production: a NF-e de exemplo usa um certificado de teste.');
  // trustProxy: em produção o app roda atrás do proxy HTTPS da hospedagem
  const app = Fastify({ logger: op.logger ?? false, bodyLimit: 2 * 1024 * 1024, trustProxy: config.producao });
  const ctx: Contexto = {
    db: op.db,
    agora: op.agora ?? (() => new Date()),
    autoridades: op.autoridades ?? carregarAutoridades(config.icpBrasilCaDir),
    geo: await carregarGeo(op.db),
    faixas: await carregarFaixas(op.db),
  };
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  // Limite geral por IP; login e cadastro têm limite próprio, mais baixo
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  app.get('/saude', async () => {
    await op.db.query('SELECT 1');
    return { ok: true };
  });
  app.addContentTypeParser(['application/xml', 'text/xml'], { parseAs: 'string' }, (_req, body, done) => done(null, body));
  app.decorateRequest('usuario', null);
  app.addHook('preHandler', async req => { if (req.url.startsWith('/api/')) await carregarUsuario(op.db, req); });

  rotasConta(app, ctx);
  rotasNfe(app, ctx);
  rotasPainel(app, ctx);
  rotasAdmin(app, ctx);

  await app.register(fastifyStatic, { root: fileURLToPath(new URL('../public/', import.meta.url)) });
  return app;
}
