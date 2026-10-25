import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { situacaoPostos } from '../acesso.ts';
import { exigirLogin } from '../auth.ts';
import { areasDoMunicipio, nomeArea, REGIOES, type Contexto } from '../contexto.ts';
import { PRODUTO_IDS, type ProdutoId } from '../dominio/produtos.ts';
import { semanaDoInstante, somarDias } from '../dominio/semanas.ts';
import { NIVEIS, type Nivel } from '../estatistica/sigilo.ts';

const Produto = z.enum(PRODUTO_IDS as [ProdutoId, ...ProdutoId[]]);
const NivelZ = z.enum(NIVEIS as [Nivel, ...Nivel[]]);
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Consulta = z.object({ semana: Data, produto: Produto, nivel: NivelZ, area: z.string().min(1).max(10) });
const ConsultaTabela = Consulta.extend({ agrupar: NivelZ });

interface Linha {
  semana: string; produto_id: ProdutoId; nivel: Nivel; area: string; distribuidora_id: number; postos: number; aberta: boolean;
  minimo: number | null; media: number | null; mediana: number | null; moda: number | null; moda_postos: number | null; maximo: number | null;
}

/**
 * Em célula aberta a quantidade de postos sai em faixa: com o número exato, média × postos daria a soma
 * dos preços e permitiria subtrair áreas. Em célula fechada não há preço, então o número exato ajuda a mostrar quanto falta.
 */
export function faixaPostos(n: number): string {
  if (n < 5) return String(n);
  for (const [de, ate] of [[5, 9], [10, 19], [20, 49], [50, 99]] as const) if (n <= ate) return `${de} a ${ate}`;
  return '100 ou mais';
}

const celula = (l: Linha | undefined) => l ? {
  postos: l.aberta ? faixaPostos(l.postos) : String(l.postos), aberta: l.aberta, minimo: l.minimo, media: l.media, mediana: l.mediana, moda: l.moda, modaPostos: l.moda_postos, maximo: l.maximo,
} : null;

const COLUNA_ESCOPO: Record<Nivel, string | null> = { brasil: null, regiao: 'regiao', uf: 'uf', meso: 'meso', micro: null };

export function rotasPainel(app: FastifyInstance, ctx: Contexto): void {
  const { db } = ctx;

  /** Só quem está em dia com a NF da semana (e com a assinatura) vê os preços. */
  async function exigirLiberado(req: FastifyRequest, reply: FastifyReply) {
    const u = exigirLogin(req, reply); if (!u) return null;
    const postos = await situacaoPostos(db, u.id, ctx.agora());
    const pendente = postos.find(p => !p.liberado);
    if (!postos.length || pendente) {
      reply.code(403).send({ erro: pendente?.motivo === 'assinatura' ? 'Sua assinatura não está ativa.' : 'Envie a NF da semana para ver os preços.', motivo: pendente?.motivo ?? 'sem_posto' });
      return null;
    }
    return { usuario: u, postos };
  }

  app.get('/api/geo', async (req, reply) => {
    if (!exigirLogin(req, reply)) return;
    const ufs = new Map<string, string>();
    for (const m of ctx.geo.mesos.values()) ufs.set(m.uf, m.regiao);
    return {
      regioes: Object.entries(REGIOES).map(([codigo, nome]) => ({ codigo, nome })),
      ufs: [...ufs].map(([sigla, regiao]) => ({ sigla, regiao })).sort((a, b) => a.sigla.localeCompare(b.sigla)),
      mesos: [...ctx.geo.mesos].map(([codigo, m]) => ({ codigo, nome: m.nome, uf: m.uf })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      micros: [...ctx.geo.micros].map(([codigo, m]) => ({ codigo, nome: m.nome, meso: m.meso })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    };
  });

  app.get('/api/semanas', async (req, reply) => {
    if (!exigirLogin(req, reply)) return;
    const { rows } = await db.query<{ semana: string; postos: number }>('SELECT semana, postos FROM semanas_fechadas ORDER BY semana DESC LIMIT 52');
    return { publicadas: rows, aberta: semanaDoInstante(ctx.agora()) };
  });

  app.get('/api/painel', async (req, reply) => {
    const ok = await exigirLiberado(req, reply); if (!ok) return;
    const r = Consulta.safeParse(req.query);
    if (!r.success) return reply.code(400).send({ erro: 'Parâmetros inválidos.' });
    const { semana, produto, nivel, area } = r.data;
    const anterior = somarDias(semana, -7);

    const [kpis, tendencia, dists] = await Promise.all([
      db.query<Linha>(`SELECT * FROM estatisticas WHERE semana = ANY($1::date[]) AND nivel = $2 AND area = $3 AND distribuidora_id = 0`, [[semana, anterior], nivel, area]),
      db.query<Linha>(`SELECT * FROM estatisticas WHERE semana <= $1 AND semana > $1::date - 84 AND produto_id = $2 AND nivel = $3 AND area = $4 AND distribuidora_id = 0 ORDER BY semana`, [semana, produto, nivel, area]),
      db.query<Linha & { nome: string }>(`SELECT e.*, d.nome FROM estatisticas e JOIN distribuidoras d ON d.id = e.distribuidora_id
        WHERE e.semana = $1 AND e.produto_id = $2 AND e.nivel = $3 AND e.area = $4 AND e.distribuidora_id <> 0`, [semana, produto, nivel, area]),
    ]);

    // Posição do próprio posto em relação à área mais estreita aberta em volta dele
    const posto = ok.postos[0]!;
    let minha = null;
    if (posto.municipio) {
      const a = areasDoMunicipio(ctx.geo, posto.municipio)!;
      const [proprio, refs] = await Promise.all([
        db.query<{ valor: number | null }>(`SELECT sum(i.litros * i.preco_litro) / nullif(sum(i.litros), 0) AS valor FROM nfes n JOIN nfe_itens i ON i.nfe_id = n.id
          WHERE n.posto_id = $1 AND n.semana = $2 AND i.produto_id = $3 AND n.status = 'aceita'`, [posto.postoId, semana, produto]),
        db.query<Linha>(`SELECT * FROM estatisticas WHERE semana = $1 AND produto_id = $2 AND distribuidora_id = 0 AND aberta
          AND ((nivel = 'micro' AND area = $3) OR (nivel = 'meso' AND area = $4) OR (nivel = 'uf' AND area = $5))
          ORDER BY array_position(ARRAY['micro','meso','uf'], nivel) LIMIT 1`, [semana, produto, a.micro, a.meso, a.uf]),
      ]);
      const ref = refs.rows[0];
      minha = {
        valor: proprio.rows[0]?.valor ?? null,
        referencia: ref ? { nivel: ref.nivel, area: ref.area, nome: nomeArea(ctx.geo, ref.nivel, ref.area), celula: celula(ref) } : null,
      };
    }

    const abertas = dists.rows.filter(d => d.aberta).sort((a, b) => a.mediana! - b.mediana!);
    return {
      semana, anterior, produto,
      area: { nivel, codigo: area, nome: nomeArea(ctx.geo, nivel, area) },
      kpis: PRODUTO_IDS.map(p => ({
        produto: p,
        atual: celula(kpis.rows.find(l => l.produto_id === p && l.semana === semana)),
        anterior: celula(kpis.rows.find(l => l.produto_id === p && l.semana === anterior)),
      })),
      tendencia: tendencia.rows.map(l => ({ semana: l.semana, celula: celula(l) })),
      distribuidoras: abertas.map(d => ({ id: d.distribuidora_id, nome: d.nome, celula: celula(d) })),
      distribuidorasProtegidas: dists.rows.length - abertas.length,
      minha,
    };
  });

  app.get('/api/tabela', async (req, reply) => {
    const ok = await exigirLiberado(req, reply); if (!ok) return;
    const r = ConsultaTabela.safeParse(req.query);
    if (!r.success) return reply.code(400).send({ erro: 'Parâmetros inválidos.' });
    const { semana, produto, nivel, area, agrupar } = r.data;
    if (NIVEIS.indexOf(agrupar) <= NIVEIS.indexOf(nivel)) return reply.code(400).send({ erro: 'Agrupe por um nível abaixo do filtro.' });
    const col = COLUNA_ESCOPO[nivel];
    const filtro = col ? `AND ${col} = $4` : '';
    const params: unknown[] = [[semana, somarDias(semana, -7)], produto, agrupar];
    if (col) params.push(area);
    const { rows } = await db.query<Linha>(`SELECT * FROM estatisticas WHERE semana = ANY($1::date[]) AND produto_id = $2 AND nivel = $3 AND distribuidora_id = 0 ${filtro}`, params);
    const atuais = rows.filter(l => l.semana === semana);
    return {
      semana, produto, agrupar,
      linhas: atuais.map(l => {
        const ant = rows.find(x => x.semana !== semana && x.area === l.area);
        return { area: l.area, nome: nomeArea(ctx.geo, agrupar, l.area), celula: celula(l), medianaAnterior: ant?.aberta ? ant.mediana : null };
      }),
    };
  });
}
