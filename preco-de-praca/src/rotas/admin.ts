import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { exigirLogin } from '../auth.ts';
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
}
