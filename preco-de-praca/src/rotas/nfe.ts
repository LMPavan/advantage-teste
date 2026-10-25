import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { situacaoSemana } from '../acesso.ts';
import { exigirLogin } from '../auth.ts';
import { config } from '../config.ts';
import { areasDoMunicipio, type Contexto } from '../contexto.ts';
import { PRODUTO_IDS, type ProdutoId } from '../dominio/produtos.ts';
import { inicioCargaInicial, prazoEncerrado, semanaDoInstante, somarDias } from '../dominio/semanas.ts';
import { formatarCnpj } from '../nfe/documentos.ts';
import { assinarNfe, gerarNfeXml } from '../nfe/exemplo.ts';
import { ErroLeitura, lerNfe } from '../nfe/parser.ts';
import { validarNfe } from '../nfe/validacao.ts';

interface Posto { id: number; cnpj: string; razao_social: string; municipio: string | null }

/** Posto do usuário: o informado em ?posto= ou o primeiro cadastrado. */
async function postoDoUsuario(ctx: Contexto, req: FastifyRequest, reply: FastifyReply): Promise<Posto | null> {
  const u = exigirLogin(req, reply); if (!u) return null;
  const pedido = Number((req.query as { posto?: string }).posto) || null;
  const { rows } = await ctx.db.query<Posto>(
    'SELECT id, cnpj, razao_social, municipio FROM postos WHERE usuario_id = $1 AND ($2::int IS NULL OR id = $2) ORDER BY id LIMIT 1', [u.id, pedido]);
  if (!rows[0]) { reply.code(404).send({ erro: 'Posto não encontrado na sua conta.' }); return null; }
  return rows[0];
}

/** Mediana publicada mais recente para o produto, da área mais estreita que estiver aberta. */
async function medianasReferencia(ctx: Contexto, municipio: string): Promise<Map<ProdutoId, number>> {
  const a = areasDoMunicipio(ctx.geo, municipio);
  if (!a) return new Map();
  const { rows } = await ctx.db.query<{ produto_id: ProdutoId; mediana: number }>(`
    SELECT DISTINCT ON (produto_id) produto_id, mediana FROM estatisticas
     WHERE aberta AND distribuidora_id = 0
       AND semana = (SELECT max(semana) FROM semanas_fechadas)
       AND ((nivel = 'micro' AND area = $1) OR (nivel = 'meso' AND area = $2) OR (nivel = 'uf' AND area = $3) OR nivel = 'brasil')
     ORDER BY produto_id, array_position(ARRAY['micro','meso','uf','brasil'], nivel)`, [a.micro, a.meso, a.uf]);
  return new Map(rows.map(r => [r.produto_id, r.mediana]));
}

export function rotasNfe(app: FastifyInstance, ctx: Contexto): void {
  const { db } = ctx;

  app.post('/api/nfes', async (req, reply) => {
    const u = exigirLogin(req, reply); if (!u) return;
    const xml = typeof req.body === 'string' ? req.body : '';
    let destino: string, cnpjDestino: string;
    try {
      const lida = lerNfe(xml);
      destino = lida.destinatario.municipio;
      cnpjDestino = lida.destinatario.cnpj;
    } catch (e) {
      if (e instanceof ErroLeitura) return reply.code(400).send({ erro: e.message });
      throw e;
    }
    // A nota vai para o posto da conta com o CNPJ do destinatário; sem nenhum, a validação recusa pelo CNPJ
    const { rows: meus } = await db.query<Posto>(
      'SELECT id, cnpj, razao_social, municipio FROM postos WHERE usuario_id = $1 ORDER BY (cnpj = $2) DESC, id LIMIT 1', [u.id, cnpjDestino]);
    const posto = meus[0];
    if (!posto) return reply.code(404).send({ erro: 'Cadastre um posto antes de enviar notas.' });
    const refs = await medianasReferencia(ctx, posto.municipio ?? destino);
    const fechadas = await db.query<{ semana: string }>('SELECT semana FROM semanas_fechadas');
    const agora = ctx.agora();
    let r;
    try {
      r = validarNfe(xml, {
        cnpjPosto: posto.cnpj,
        municipioPosto: posto.municipio,
        agora,
        semanasFechadas: new Set(fechadas.rows.map(f => f.semana)),
        cargaInicialDesde: inicioCargaInicial(agora, ctx.cargaInicial.ate, ctx.cargaInicial.semanas),
        municipioExiste: c => ctx.geo.municipios.has(c),
        faixaProduto: p => ctx.faixas.get(p)!,
        medianaReferencia: p => refs.get(p) ?? null,
        autoridades: ctx.autoridades,
      });
    } catch (e) {
      if (e instanceof ErroLeitura) return reply.code(400).send({ erro: e.message });
      throw e;
    }
    const { nfe } = r;

    const dup = await db.query("SELECT 1 FROM nfes WHERE chave = $1 AND status <> 'recusada'", [nfe.chave]);
    if (dup.rowCount) return reply.code(409).send({ erro: 'Esta nota já foi enviada.' });

    const cliente = await db.connect();
    let nfeId: number;
    try {
      await cliente.query('BEGIN');
      let distribuidoraId: number | null = null;
      if (r.status !== 'recusada') {
        const d = await cliente.query<{ id: number }>(`
          INSERT INTO distribuidoras (cnpj_raiz, nome) VALUES ($1, $2)
          ON CONFLICT (cnpj_raiz) DO UPDATE SET cnpj_raiz = EXCLUDED.cnpj_raiz RETURNING id`, [nfe.emitente.cnpj.slice(0, 8), nfe.emitente.nome]);
        distribuidoraId = d.rows[0]!.id;
      }
      const ins = await cliente.query<{ id: number }>(`
        INSERT INTO nfes (chave, posto_id, distribuidora_id, emitente_cnpj, emitente_nome, emitida_em, semana, municipio, mod_frete,
                          status, motivos, assinatura, cadeia_icp, xml)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [nfe.chave, posto.id, distribuidoraId, nfe.emitente.cnpj, nfe.emitente.nome,
          isNaN(nfe.emitidaEm.getTime()) ? ctx.agora() : nfe.emitidaEm, r.semana || semanaDoInstante(ctx.agora()),
          nfe.destinatario.municipio || null, nfe.modFrete || null, r.status,
          JSON.stringify(r.verificacoes.filter(v => v.gravidade !== 'ok')), r.assinatura.status, r.assinatura.cadeiaIcp, xml]);
      nfeId = ins.rows[0]!.id;
      if (r.status !== 'recusada') {
        for (const i of r.itens) {
          await cliente.query('INSERT INTO nfe_itens (nfe_id, produto_id, descricao, cfop, litros, preco_litro) VALUES ($1,$2,$3,$4,$5,$6)',
            [nfeId, i.produto, i.descricao, i.cfop, i.litros, i.precoLitro]);
        }
        // A primeira nota define a localização do posto
        if (!posto.municipio) await cliente.query('UPDATE postos SET municipio = $1 WHERE id = $2', [nfe.destinatario.municipio, posto.id]);
      }
      await cliente.query('COMMIT');
    } catch (e) {
      await cliente.query('ROLLBACK');
      if ((e as { code?: string }).code === '23505') return reply.code(409).send({ erro: 'Esta nota já foi enviada.' });
      throw e;
    } finally {
      cliente.release();
    }

    return reply.code(r.status === 'recusada' ? 422 : 201).send({
      id: nfeId,
      postoId: posto.id,
      status: r.status,
      semana: r.semana,
      verificacoes: r.verificacoes,
      nota: {
        numero: nfe.numero, chave: nfe.chave, emitidaEm: nfe.emitidaEm, modFrete: nfe.modFrete,
        emitente: { ...nfe.emitente, cnpj: formatarCnpj(nfe.emitente.cnpj) },
        destinatario: { ...nfe.destinatario, cnpj: formatarCnpj(nfe.destinatario.cnpj) },
      },
      itens: nfe.itens.map(i => ({ descricao: i.descricao, codigoAnp: i.codigoAnp, cfop: i.cfop, produto: i.produto, litros: i.litros, precoLitro: i.precoLitro })),
    });
  });

  app.get('/api/nfes', async (req, reply) => {
    const u = exigirLogin(req, reply); if (!u) return;
    const { rows } = await db.query(`
      SELECT n.id, n.chave, n.posto_id, n.emitente_nome, n.emitida_em, n.semana, n.status, n.motivos, n.enviada_em,
             coalesce(json_agg(json_build_object('produto', i.produto_id, 'litros', i.litros, 'precoLitro', i.preco_litro)) FILTER (WHERE i.id IS NOT NULL), '[]') AS itens
        FROM nfes n LEFT JOIN nfe_itens i ON i.nfe_id = n.id
       WHERE n.posto_id IN (SELECT id FROM postos WHERE usuario_id = $1) GROUP BY n.id ORDER BY n.enviada_em DESC LIMIT 50`, [u.id]);
    return { nfes: rows };
  });

  const SemCompra = z.object({ produto: z.enum(PRODUTO_IDS as [ProdutoId, ...ProdutoId[]]), marcado: z.boolean() });
  app.post('/api/sem-compra', async (req, reply) => {
    const posto = await postoDoUsuario(ctx, req, reply); if (!posto) return;
    const r = SemCompra.safeParse(req.body);
    if (!r.success) return reply.code(400).send({ erro: 'Produto inválido.' });
    const semana = semanaDoInstante(ctx.agora());
    if (!r.data.marcado) {
      await db.query('DELETE FROM sem_compra WHERE posto_id = $1 AND semana = $2 AND produto_id = $3', [posto.id, semana, r.data.produto]);
      return situacaoSemana(db, posto.id, semana);
    }
    const anteriores = Array.from({ length: config.semCompraMaxSeguidas }, (_, i) => somarDias(semana, -7 * (i + 1)));
    const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM sem_compra WHERE posto_id = $1 AND produto_id = $2 AND semana = ANY($3::date[])',
      [posto.id, r.data.produto, anteriores]);
    if (rows[0]!.n >= config.semCompraMaxSeguidas) {
      return reply.code(422).send({ erro: `"Não comprei" já foi usado nas últimas ${config.semCompraMaxSeguidas} semanas para este produto. Envie uma NF.` });
    }
    await db.query('INSERT INTO sem_compra (posto_id, semana, produto_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [posto.id, semana, r.data.produto]);
    return situacaoSemana(db, posto.id, semana);
  });

  // NF-e de exemplo assinada com certificado de teste, só no modo de demonstração
  if (config.demo) {
    const dir = fileURLToPath(new URL('../../data/demo/', import.meta.url));
    const chave = readFileSync(dir + 'distribuidora-teste.key', 'utf8');
    const cert = readFileSync(dir + 'distribuidora-teste.crt', 'utf8');
    app.get('/api/demo/nfe-exemplo', async (req, reply) => {
      const posto = await postoDoUsuario(ctx, req, reply); if (!posto) return;
      const n = (req.query as { n?: string }).n === '2' ? 2 : 1;
      const municipio = posto.municipio ?? '3509502';
      const refs = await medianasReferencia(ctx, municipio);
      const mun = ctx.geo.municipios.get(municipio)!;
      const uf = ctx.geo.mesos.get(ctx.geo.micros.get(mun.micro)!.meso)!.uf;
      const agora = ctx.agora();
      const semana = semanaDoInstante(agora);
      const quando = new Date(Math.min(agora.getTime() - 3600e3, new Date(somarDias(semana, n) + 'T09:14:00-03:00').getTime()));
      if (prazoEncerrado(semana, quando)) return reply.code(500).send({ erro: 'Relógio inconsistente.' });
      const padrao: Record<ProdutoId, number> = { gc: 5.74, et: 3.96, s10: 5.93, s500: 5.77 };
      const preco = (p: ProdutoId) => Math.round(((refs.get(p) ?? padrao[p]) + (Math.random() - 0.5) * 0.06) * 10000) / 10000;
      const itens = (n === 1 ? (['gc', 'et'] as const) : (['s10', 's500'] as const)).map((p, i) => ({ produto: p, litros: i ? 5000 : 10000, precoLitro: preco(p) }));
      const xml = gerarNfeXml({
        numero: 100000 + Math.floor(Math.random() * 899999),
        emitidaEm: quando.toISOString().replace(/\.\d{3}Z$/, '+00:00'),
        emitente: { cnpj: '99000001000101', nome: 'DISTRIBUIDORA DEMONSTRACAO LTDA', municipio: '3536505', uf: 'SP' },
        destinatario: { cnpj: posto.cnpj, nome: posto.razao_social.toUpperCase(), municipio, municipioNome: mun.nome.toUpperCase(), uf },
        itens,
      });
      reply.type('application/xml').header('content-disposition', `attachment; filename="nfe-exemplo-${n}.xml"`);
      return assinarNfe(xml, chave, cert);
    });
  }
}
