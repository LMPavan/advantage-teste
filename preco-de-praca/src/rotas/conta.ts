import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { situacaoPostos } from '../acesso.ts';
import { COOKIE, conferirSenha, criarSessao, exigirLogin, gerarHash, gerarTokenApi, hashToken } from '../auth.ts';
import { config } from '../config.ts';
import { areasDoMunicipio, nomeArea, type Contexto } from '../contexto.ts';
import { dataLocal, inicioCargaInicial, somarDias } from '../dominio/semanas.ts';
import { cnpjValido, somenteDigitos } from '../nfe/documentos.ts';

const Cadastro = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  cnpj: z.string().transform(somenteDigitos).refine(cnpjValido, 'CNPJ inválido.'),
  razaoSocial: z.string().trim().min(2, 'Informe a razão social do posto.'),
  convite: z.string().trim().optional(),
  aceiteTermos: z.literal(true, { message: 'Aceite os termos de uso e a política de privacidade para continuar.' }),
});

const NovoPosto = z.object({
  cnpj: z.string().transform(somenteDigitos).refine(cnpjValido, 'CNPJ inválido.'),
  razaoSocial: z.string().trim().min(2, 'Informe a razão social do posto.'),
});

const Entrada = z.object({ email: z.string().trim().toLowerCase(), senha: z.string() });

export function rotasConta(app: FastifyInstance, ctx: Contexto): void {
  const { db } = ctx;
  const gravarCookie = (reply: import('fastify').FastifyReply, token: string, expira: Date) =>
    reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.producao, expires: expira });

  const limiteAcesso = { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } };

  app.post('/api/cadastro', limiteAcesso, async (req, reply) => {
    const r = Cadastro.safeParse(req.body);
    if (!r.success) return reply.code(400).send({ erro: r.error.issues[0]!.message });
    const d = r.data;
    // No piloto, só entra quem recebeu o código de convite
    if (config.codigoConvite && d.convite !== config.codigoConvite) return reply.code(403).send({ erro: 'Código de convite inválido.' });
    const cliente = await db.connect();
    try {
      await cliente.query('BEGIN');
      const u = await cliente.query<{ id: number }>(`INSERT INTO usuarios (email, nome, senha_hash, termos_versao, termos_aceitos_em, termos_ip)
        VALUES ($1, $2, $3, $4, now(), $5) RETURNING id`, [d.email, d.nome, await gerarHash(d.senha), config.termosVersao, req.ip]);
      const usuarioId = u.rows[0]!.id;
      await cliente.query('INSERT INTO postos (usuario_id, cnpj, razao_social, teste_ate) VALUES ($1, $2, $3, $4)',
        [usuarioId, d.cnpj, d.razaoSocial, somarDias(dataLocal(ctx.agora()), config.diasTeste)]);
      await cliente.query('COMMIT');
      const s = await criarSessao(db, usuarioId);
      gravarCookie(reply, s.token, s.expira);
      return reply.code(201).send({ ok: true });
    } catch (e) {
      await cliente.query('ROLLBACK');
      if ((e as { code?: string }).code === '23505') {
        const campo = String((e as { constraint?: string }).constraint).includes('email') ? 'Este e-mail' : 'Este CNPJ';
        return reply.code(409).send({ erro: `${campo} já está cadastrado.` });
      }
      throw e;
    } finally {
      cliente.release();
    }
  });

  app.post('/api/entrar', limiteAcesso, async (req, reply) => {
    const r = Entrada.safeParse(req.body);
    if (!r.success) return reply.code(400).send({ erro: 'Informe e-mail e senha.' });
    const { rows } = await db.query<{ id: number; senha_hash: string }>('SELECT id, senha_hash FROM usuarios WHERE email = $1', [r.data.email]);
    const u = rows[0];
    if (!u || !(await conferirSenha(r.data.senha, u.senha_hash))) return reply.code(401).send({ erro: 'E-mail ou senha incorretos.' });
    const s = await criarSessao(db, u.id);
    gravarCookie(reply, s.token, s.expira);
    return { ok: true };
  });

  app.post('/api/sair', async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) await db.query('DELETE FROM sessoes WHERE token = $1', [token]);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/eu', async (req, reply) => {
    const u = exigirLogin(req, reply); if (!u) return;
    const postos = await situacaoPostos(db, u.id, ctx.agora());
    return {
      usuario: u,
      postos: postos.map(p => {
        const areas = p.municipio ? areasDoMunicipio(ctx.geo, p.municipio) : null;
        return { ...p, areas, microNome: areas ? nomeArea(ctx.geo, 'micro', areas.micro) : null };
      }),
      liberado: postos.length > 0 && postos.every(p => p.liberado),
      demo: config.demo,
      termosPendentes: u.termosVersao !== config.termosVersao,
      cargaInicial: cargaInicial(),
      lembretes: (await db.query<{ lembretes: boolean }>('SELECT lembretes FROM usuarios WHERE id = $1', [u.id])).rows[0]?.lembretes ?? true,
    };
  });

  const cargaInicial = () => {
    const desde = inicioCargaInicial(ctx.agora(), ctx.cargaInicial.ate, ctx.cargaInicial.semanas);
    return desde ? { desde, ate: ctx.cargaInicial.ate } : null;
  };

  app.post('/api/termos', async (req, reply) => {
    const u = exigirLogin(req, reply); if (!u) return;
    if ((req.body as { aceito?: unknown } | null)?.aceito !== true) return reply.code(400).send({ erro: 'Marque o aceite para continuar.' });
    await db.query('UPDATE usuarios SET termos_versao = $1, termos_aceitos_em = now(), termos_ip = $2 WHERE id = $3', [config.termosVersao, req.ip, u.id]);
    return { ok: true };
  });

  app.post('/api/preferencias', async (req, reply) => {
    const u = exigirLogin(req, reply); if (!u) return;
    const lembretes = (req.body as { lembretes?: unknown } | null)?.lembretes;
    if (typeof lembretes !== 'boolean') return reply.code(400).send({ erro: 'Preferência inválida.' });
    await db.query('UPDATE usuarios SET lembretes = $1 WHERE id = $2', [lembretes, u.id]);
    return { ok: true };
  });

  // Recuperação de senha: a resposta é sempre a mesma, para não revelar quais e-mails têm conta
  app.post('/api/senha/esqueci', limiteAcesso, async (req, reply) => {
    const email = String((req.body as { email?: unknown } | null)?.email ?? '').trim().toLowerCase();
    const { rows } = await db.query<{ id: number; nome: string }>('SELECT id, nome FROM usuarios WHERE email = $1', [email]);
    const u = rows[0];
    if (u) {
      const codigo = randomBytes(32).toString('base64url');
      await db.query("INSERT INTO redefinicoes_senha (hash, usuario_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(codigo), u.id]);
      try {
        await ctx.enviarEmail({
          para: email,
          assunto: 'Redefinir sua senha do Preço de Praça',
          texto: `Olá, ${u.nome}.\n\nPara criar uma senha nova, abra o link abaixo. Ele vale por 1 hora e só pode ser usado uma vez.\n\n${config.appUrl}/?redefinir=${codigo}\n\nSe você não pediu, ignore este e-mail: sua senha continua a mesma.`,
        });
      } catch (e) {
        req.log.error(e, 'falha ao enviar e-mail de redefinição');
      }
    }
    return reply.send({ ok: true });
  });

  const Redefinir = z.object({ codigo: z.string().min(10), senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.') });
  app.post('/api/senha/redefinir', limiteAcesso, async (req, reply) => {
    const r = Redefinir.safeParse(req.body);
    if (!r.success) return reply.code(400).send({ erro: r.error.issues[0]!.message });
    const { rows } = await db.query<{ usuario_id: number }>(`UPDATE redefinicoes_senha SET usada_em = now()
      WHERE hash = $1 AND usada_em IS NULL AND expira_em > now() RETURNING usuario_id`, [hashToken(r.data.codigo)]);
    const id = rows[0]?.usuario_id;
    if (!id) return reply.code(400).send({ erro: 'Este link expirou ou já foi usado. Peça um novo.' });
    await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [await gerarHash(r.data.senha), id]);
    await db.query('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
    const s = await criarSessao(db, id);
    gravarCookie(reply, s.token, s.expira);
    return { ok: true };
  });

  app.get('/api/config-publica', async () => ({ convite: !!config.codigoConvite, cargaInicial: cargaInicial() }));

  // Rede com vários postos: cada CNPJ é um posto, todos na mesma conta
  app.post('/api/postos', async (req, reply) => {
    const u = exigirLogin(req, reply); if (!u) return;
    const r = NovoPosto.safeParse(req.body);
    if (!r.success) return reply.code(400).send({ erro: r.error.issues[0]!.message });
    try {
      const { rows } = await db.query<{ id: number }>(`INSERT INTO postos (usuario_id, cnpj, razao_social, assinatura, teste_ate)
        SELECT $1, $2, $3, coalesce((SELECT assinatura FROM postos WHERE usuario_id = $1 ORDER BY id LIMIT 1), 'teste'),
               coalesce((SELECT teste_ate FROM postos WHERE usuario_id = $1 ORDER BY id LIMIT 1), $4::date)
        RETURNING id`, [u.id, r.data.cnpj, r.data.razaoSocial, somarDias(dataLocal(ctx.agora()), config.diasTeste)]);
      return reply.code(201).send({ id: rows[0]!.id });
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return reply.code(409).send({ erro: 'Este CNPJ já está cadastrado.' });
      throw e;
    }
  });

  app.get('/api/tokens', async (req, reply) => {
    const u = exigirLogin(req, reply); if (!u) return;
    const { rows } = await db.query('SELECT id, nome, prefixo, criado_em, usado_em FROM tokens_api WHERE usuario_id = $1 AND revogado_em IS NULL ORDER BY id', [u.id]);
    return { tokens: rows };
  });

  app.post('/api/tokens', async (req, reply) => {
    const u = exigirLogin(req, reply); if (!u) return;
    const nome = String((req.body as { nome?: unknown } | null)?.nome ?? '').trim().slice(0, 60) || 'Integração';
    const t = gerarTokenApi();
    const { rows } = await db.query<{ id: number }>('INSERT INTO tokens_api (usuario_id, nome, hash, prefixo) VALUES ($1, $2, $3, $4) RETURNING id', [u.id, nome, t.hash, t.prefixo]);
    // O token só aparece nesta resposta
    return reply.code(201).send({ id: rows[0]!.id, nome, token: t.token });
  });

  app.delete('/api/tokens/:id', async (req, reply) => {
    const u = exigirLogin(req, reply); if (!u) return;
    await db.query('UPDATE tokens_api SET revogado_em = now() WHERE id = $1 AND usuario_id = $2', [Number((req.params as { id: string }).id), u.id]);
    return { ok: true };
  });
}
