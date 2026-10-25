import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { situacaoPostos } from '../acesso.ts';
import { COOKIE, conferirSenha, criarSessao, exigirLogin, gerarHash } from '../auth.ts';
import { config } from '../config.ts';
import { areasDoMunicipio, nomeArea, type Contexto } from '../contexto.ts';
import { dataLocal, somarDias } from '../dominio/semanas.ts';
import { cnpjValido, somenteDigitos } from '../nfe/documentos.ts';

const Cadastro = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  cnpj: z.string().transform(somenteDigitos).refine(cnpjValido, 'CNPJ inválido.'),
  razaoSocial: z.string().trim().min(2, 'Informe a razão social do posto.'),
});

const Entrada = z.object({ email: z.string().trim().toLowerCase(), senha: z.string() });

export function rotasConta(app: FastifyInstance, ctx: Contexto): void {
  const { db } = ctx;
  const gravarCookie = (reply: import('fastify').FastifyReply, token: string, expira: Date) =>
    reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: expira });

  app.post('/api/cadastro', async (req, reply) => {
    const r = Cadastro.safeParse(req.body);
    if (!r.success) return reply.code(400).send({ erro: r.error.issues[0]!.message });
    const d = r.data;
    const cliente = await db.connect();
    try {
      await cliente.query('BEGIN');
      const u = await cliente.query<{ id: number }>('INSERT INTO usuarios (email, nome, senha_hash) VALUES ($1, $2, $3) RETURNING id',
        [d.email, d.nome, await gerarHash(d.senha)]);
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

  app.post('/api/entrar', async (req, reply) => {
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
    };
  });
}
