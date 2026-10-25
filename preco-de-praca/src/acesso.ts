import type { Db } from './db.ts';
import { PRODUTOS, type ProdutoId } from './dominio/produtos.ts';
import { dataLocal, prazoEnvio, semanaDoInstante } from './dominio/semanas.ts';

export type SituacaoProduto = 'enviado' | 'em_revisao' | 'sem_compra' | 'pendente';

export interface SituacaoSemana {
  semana: string;
  prazo: string;
  produtos: Record<ProdutoId, SituacaoProduto>;
  completa: boolean;
}

export async function situacaoSemana(db: Db, postoId: number, semana: string): Promise<SituacaoSemana> {
  const { rows } = await db.query<{ produto_id: ProdutoId; situacao: SituacaoProduto }>(`
    SELECT i.produto_id, CASE WHEN bool_or(n.status = 'aceita') THEN 'enviado' ELSE 'em_revisao' END AS situacao
      FROM nfes n JOIN nfe_itens i ON i.nfe_id = n.id
     WHERE n.posto_id = $1 AND n.semana = $2 AND n.status IN ('aceita','em_revisao')
     GROUP BY i.produto_id
    UNION ALL
    SELECT produto_id, 'sem_compra' FROM sem_compra WHERE posto_id = $1 AND semana = $2`, [postoId, semana]);
  const produtos = Object.fromEntries(PRODUTOS.map(p => [p.id, 'pendente'])) as Record<ProdutoId, SituacaoProduto>;
  for (const r of rows) if (produtos[r.produto_id] === 'pendente' || r.situacao === 'enviado') produtos[r.produto_id] = r.situacao;
  return { semana, prazo: prazoEnvio(semana).toISOString(), produtos, completa: Object.values(produtos).every(s => s !== 'pendente') };
}

export interface SituacaoPosto {
  postoId: number;
  cnpj: string;
  razaoSocial: string;
  municipio: string | null;
  assinaturaOk: boolean;
  assinatura: string;
  testeAte: string | null;
  semanaAberta: SituacaoSemana;
  semanaPublicada: SituacaoSemana | null;
  liberado: boolean;
  motivo: string | null;
}

export async function ultimaSemanaPublicada(db: Db): Promise<string | null> {
  const { rows } = await db.query<{ semana: string }>('SELECT max(semana) AS semana FROM semanas_fechadas');
  return rows[0]?.semana ?? null;
}

/**
 * O painel fica liberado para quem enviou a semana publicada mais recente,
 * ou para quem já completou a semana em aberto (assim um posto novo não espera uma semana inteira).
 */
export async function situacaoPostos(db: Db, usuarioId: number, agora: Date): Promise<SituacaoPosto[]> {
  const { rows } = await db.query<{ id: number; cnpj: string; razao_social: string; municipio: string | null; assinatura: string; teste_ate: string | null }>(
    'SELECT id, cnpj, razao_social, municipio, assinatura, teste_ate FROM postos WHERE usuario_id = $1 ORDER BY id', [usuarioId]);
  const publicada = await ultimaSemanaPublicada(db);
  const aberta = semanaDoInstante(agora);
  const hoje = dataLocal(agora);
  const out: SituacaoPosto[] = [];
  for (const p of rows) {
    const semanaAberta = await situacaoSemana(db, p.id, aberta);
    const semanaPublicada = publicada ? await situacaoSemana(db, p.id, publicada) : null;
    const assinaturaOk = p.assinatura === 'ativa' || (p.assinatura === 'teste' && !!p.teste_ate && p.teste_ate >= hoje);
    let motivo: string | null = null;
    if (!assinaturaOk) motivo = 'assinatura';
    else if (semanaPublicada && !semanaPublicada.completa && !semanaAberta.completa) motivo = 'nf_pendente';
    out.push({
      postoId: p.id, cnpj: p.cnpj, razaoSocial: p.razao_social, municipio: p.municipio,
      assinatura: p.assinatura, testeAte: p.teste_ate, assinaturaOk, semanaAberta, semanaPublicada,
      liberado: motivo === null, motivo,
    });
  }
  return out;
}
