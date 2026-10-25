import cookie from '@fastify/cookie';
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
  const app = Fastify({ logger: op.logger ?? false, bodyLimit: 2 * 1024 * 1024 });
  const ctx: Contexto = {
    db: op.db,
    agora: op.agora ?? (() => new Date()),
    autoridades: op.autoridades ?? carregarAutoridades(config.icpBrasilCaDir),
    geo: await carregarGeo(op.db),
    faixas: await carregarFaixas(op.db),
  };
  await app.register(cookie);
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
