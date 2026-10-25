import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { carregarUsuario } from './auth.ts';
import { config } from './config.ts';
import { carregarFaixas, carregarGeo, type Contexto } from './contexto.ts';
import type { Db } from './db.ts';
import { criarEnviador, type EnviarEmail } from './email.ts';
import { carregarAutoridades } from './nfe/assinatura.ts';
import { rotasAdmin } from './rotas/admin.ts';
import { rotasConta } from './rotas/conta.ts';
import { rotasNfe } from './rotas/nfe.ts';
import { rotasPainel } from './rotas/painel.ts';

export interface OpcoesApp {
  db: Db;
  agora?: () => Date;
  autoridades?: import('node:crypto').X509Certificate[];
  cargaInicial?: { ate: string; semanas: number };
  enviarEmail?: EnviarEmail;
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
    cargaInicial: op.cargaInicial ?? { ate: config.cargaInicialAte, semanas: config.cargaInicialSemanas },
    enviarEmail: op.enviarEmail ?? criarEnviador(msg => app.log.info(msg)),
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
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    await carregarUsuario(op.db, req);
    // Sem aceite da versão vigente dos termos, só as rotas da própria conta funcionam
    const livre = ['/api/eu', '/api/termos', '/api/sair', '/api/config-publica'].some(r => req.url.split('?')[0] === r);
    if (req.usuario && req.usuario.termosVersao !== config.termosVersao && !livre) {
      return reply.code(403).send({ erro: 'Aceite os termos de uso para continuar.', motivo: 'termos' });
    }
  });

  // Termos e política de privacidade, com os dados do operador vindos da configuração
  const pagina = (arquivo: string, titulo: string) => {
    const ler = (n: string) => readFileSync(fileURLToPath(new URL(`./termos/${n}`, import.meta.url)), 'utf8');
    const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const valores: Record<string, string> = {
      TITULO: titulo, VERSAO: config.termosVersao, OPERADOR_NOME: config.operador.nome,
      OPERADOR_CNPJ: config.operador.cnpj, OPERADOR_EMAIL: config.operador.email, OPERADOR_FORO: config.operador.foro,
    };
    return (ler('cabecalho.html') + ler(arquivo) + ler('rodape.html')).replace(/\{\{(\w+)\}\}/g, (_, k: string) => esc(valores[k] ?? ''));
  };
  app.get('/termos', async (_req, reply) => reply.type('text/html; charset=utf-8').send(pagina('termos.html', 'Termos de uso')));
  app.get('/privacidade', async (_req, reply) => reply.type('text/html; charset=utf-8').send(pagina('privacidade.html', 'Política de privacidade')));

  rotasConta(app, ctx);
  rotasNfe(app, ctx);
  rotasPainel(app, ctx);
  rotasAdmin(app, ctx);

  await app.register(fastifyStatic, { root: fileURLToPath(new URL('../public/', import.meta.url)) });
  return app;
}
