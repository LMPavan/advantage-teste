import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { situacaoPostos } from '../acesso.ts';
import { exigirLogin, gerarHash } from '../auth.ts';
import { config } from '../config.ts';
import { nomeArea, areasDoMunicipio } from '../contexto.ts';
import { inicioCargaInicial } from '../dominio/semanas.ts';
import type { Contexto } from '../contexto.ts';

export function rotasAdmin(app: FastifyInstance, ctx: Contexto): void {
  const { db } = ctx;
  const exigirAdmin = (req: FastifyRequest, reply: FastifyReply) => {
    const u = exigirLogin(req, reply); if (!u) return null;
    if (!u.admin) { reply.code(403).send({ erro: 'Acesso restrito à administração.' }); return null; }
    return u;
  };

  // Notas que aguardam revisão manual (preço fora da curva, assinatura ausente, CFOP incomum)
  app.get('/api/admin/revisao', async (req, reply) => {
    if (!exigirAdmin(req, reply)) return;
    const { rows } = await db.query(`
      SELECT n.id, n.chave, n.semana, n.emitente_nome, n.emitida_em, n.motivos, p.razao_social, p.cnpj,
             (SELECT json_agg(json_build_object('produto', produto_id, 'litros', litros, 'precoLitro', preco_litro)) FROM nfe_itens WHERE nfe_id = n.id) AS itens
        FROM nfes n JOIN postos p ON p.id = n.posto_id WHERE n.status = 'em_revisao' ORDER BY n.enviada_em`);
    return { nfes: rows };
  });

  const Decisao = z.object({ status: z.enum(['aceita', 'recusada']), observacao: z.string().max(500).optional() });
  app.post('/api/admin/nfes/:id', async (req, reply) => {
    const u = exigirAdmin(req, reply); if (!u) return;
    const r = Decisao.safeParse(req.body);
    if (!r.success) return reply.code(400).send({ erro: 'Decisão inválida.' });
    const { rowCount } = await db.query(`UPDATE nfes SET status = $1,
        motivos = motivos || jsonb_build_array(jsonb_build_object('gravidade', 'info', 'texto', $2::text))
      WHERE id = $3 AND status = 'em_revisao'`,
      [r.data.status, `Revisão manual por ${u.email}: ${r.data.status}${r.data.observacao ? ' (' + r.data.observacao + ')' : ''}`, Number((req.params as { id: string }).id)]);
    if (!rowCount) return reply.code(404).send({ erro: 'Nota não está em revisão.' });
    return { ok: true };
  });

  app.get('/api/admin/distribuidoras', async (req, reply) => {
    if (!exigirAdmin(req, reply)) return;
    const { rows } = await db.query('SELECT id, cnpj_raiz, nome, revisada FROM distribuidoras ORDER BY revisada, nome');
    return { distribuidoras: rows };
  });

  const Dist = z.object({ nome: z.string().trim().min(2) });
  app.post('/api/admin/distribuidoras/:id', async (req, reply) => {
    if (!exigirAdmin(req, reply)) return;
    const r = Dist.safeParse(req.body);
    if (!r.success) return reply.code(400).send({ erro: 'Nome inválido.' });
    await db.query('UPDATE distribuidoras SET nome = $1, revisada = true WHERE id = $2', [r.data.nome, Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  // Participantes do piloto e a situação de cada posto na semana
  app.get('/api/admin/postos', async (req, reply) => {
    if (!exigirAdmin(req, reply)) return;
    const { rows: usuarios } = await db.query<{ id: number; email: string; nome: string; admin: boolean; termos_aceitos_em: string | null; termos_versao: string | null }>(
      'SELECT id, email, nome, admin, termos_aceitos_em, termos_versao FROM usuarios ORDER BY id');
    const situacoes = await Promise.all(usuarios.map(u => situacaoPostos(db, u.id, ctx.agora())));
    const out = usuarios.flatMap((u, i) => situacoes[i]!.map(p => {
      const a = p.municipio ? areasDoMunicipio(ctx.geo, p.municipio) : null;
      return { usuario: { id: u.id, email: u.email, nome: u.nome, termosAceitosEm: u.termos_versao === config.termosVersao ? u.termos_aceitos_em : null }, ...p, micro: a ? nomeArea(ctx.geo, 'micro', a.micro) : null };
    }));
    const semanas = await db.query('SELECT semana, postos, fechada_em FROM semanas_fechadas ORDER BY semana DESC LIMIT 8');
    const desde = inicioCargaInicial(ctx.agora(), ctx.cargaInicial.ate, ctx.cargaInicial.semanas);
    return { postos: out, semanas: semanas.rows, cargaInicial: desde ? { desde, ate: ctx.cargaInicial.ate } : null };
  });

  // Sem e-mail no piloto: a administração gera uma senha provisória e passa ao cliente
  app.post('/api/admin/usuarios/:id/senha', async (req, reply) => {
    if (!exigirAdmin(req, reply)) return;
    const senha = randomBytes(6).toString('base64url');
    const id = Number((req.params as { id: string }).id);
    const { rowCount } = await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [await gerarHash(senha), id]);
    if (!rowCount) return reply.code(404).send({ erro: 'Usuário não encontrado.' });
    await db.query('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
    return { senha };
  });

  const Assinatura = z.object({ assinatura: z.enum(['teste', 'ativa', 'inadimplente', 'cancelada']), testeAte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() });
  app.post('/api/admin/postos/:id/assinatura', async (req, reply) => {
    if (!exigirAdmin(req, reply)) return;
    const r = Assinatura.safeParse(req.body);
    if (!r.success) return reply.code(400).send({ erro: 'Situação inválida.' });
    await db.query('UPDATE postos SET assinatura = $1, teste_ate = coalesce($2::date, teste_ate) WHERE id = $3',
      [r.data.assinatura, r.data.testeAte ?? null, Number((req.params as { id: string }).id)]);
    return { ok: true };
  });
}
