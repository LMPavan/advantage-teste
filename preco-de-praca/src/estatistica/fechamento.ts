import { config } from '../config.ts';
import type { Db } from '../db.ts';
import { prazoEncerrado } from '../dominio/semanas.ts';
import { calcularCelulas, type Contribuicao } from './sigilo.ts';

/**
 * Fecha a semana: calcula e publica as estatísticas uma única vez, depois do prazo de envio.
 * Publicar só semanas fechadas evita que alguém descubra o preço de um posto comparando o painel
 * antes e depois de um novo envio. Notas aprovadas na revisão depois do fechamento não alteram a semana publicada.
 */
export async function fecharSemana(db: Db, semana: string, k = config.kMinimo): Promise<{ postos: number; celulas: number; abertas: number }> {
  const { rows } = await db.query<{
    participante: number; produto_id: Contribuicao['produto']; distribuidora_id: number; litros: number; preco_litro: number;
    regiao: string; uf: string; meso: string; micro: string;
  }>(`
    SELECT substring(p.cnpj, 1, 8)::int AS participante, i.produto_id, coalesce(n.distribuidora_id, 0) AS distribuidora_id, i.litros, i.preco_litro,
           me.regiao, me.uf, me.codigo AS meso, mi.codigo AS micro
      FROM nfes n
      JOIN nfe_itens i ON i.nfe_id = n.id
      JOIN postos p ON p.id = n.posto_id
      JOIN municipios mu ON mu.codigo = p.municipio
      JOIN microrregioes mi ON mi.codigo = mu.micro
      JOIN mesorregioes me ON me.codigo = mi.meso
     WHERE n.semana = $1 AND n.status = 'aceita'`, [semana]);

  const contribuicoes: Contribuicao[] = rows.map(r => ({
    participanteId: r.participante, produto: r.produto_id, distribuidoraId: r.distribuidora_id, litros: r.litros, precoLitro: r.preco_litro,
    regiao: r.regiao, uf: r.uf, meso: r.meso, micro: r.micro,
  }));
  const celulas = calcularCelulas(contribuicoes, k);
  const postos = new Set(contribuicoes.map(c => c.participanteId)).size;

  const cliente = await db.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('INSERT INTO semanas_fechadas (semana, postos) VALUES ($1, $2)', [semana, postos]);
    for (let i = 0; i < celulas.length; i += 500) {
      const lote = celulas.slice(i, i + 500);
      const params: unknown[] = [];
      const valores = lote.map(c => {
        const r = c.resumo;
        const linha = [semana, c.produto, c.nivel, c.area, c.distribuidoraId, c.regiao, c.uf, c.meso, c.valores.size, c.aberta,
          r?.media ?? null, r?.mediana ?? null, r?.moda ?? null, r?.modaPostos ?? null];
        return '(' + linha.map(v => { params.push(v); return '$' + params.length; }).join(',') + ')';
      });
      await cliente.query(`INSERT INTO estatisticas (semana, produto_id, nivel, area, distribuidora_id, regiao, uf, meso, postos, aberta,
        media, mediana, moda, moda_postos) VALUES ${valores.join(',')}`, params);
    }
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
  return { postos, celulas: celulas.length, abertas: celulas.filter(c => c.aberta).length };
}

/** Fecha todas as semanas com notas cujo prazo já terminou. */
export async function fecharSemanasPendentes(db: Db, agora = new Date()): Promise<string[]> {
  const { rows } = await db.query<{ semana: string }>(`
    SELECT DISTINCT n.semana FROM nfes n
     WHERE NOT EXISTS (SELECT 1 FROM semanas_fechadas f WHERE f.semana = n.semana)
     ORDER BY n.semana`);
  const fechadas: string[] = [];
  for (const { semana } of rows) {
    if (!prazoEncerrado(semana, agora)) continue;
    await fecharSemana(db, semana);
    fechadas.push(semana);
  }
  return fechadas;
}
