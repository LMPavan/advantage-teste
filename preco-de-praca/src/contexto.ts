import type { X509Certificate } from 'node:crypto';
import type { Db } from './db.ts';
import type { ProdutoId } from './dominio/produtos.ts';
import type { EnviarEmail } from './email.ts';

export interface Geo {
  municipios: Map<string, { nome: string; micro: string }>;
  micros: Map<string, { nome: string; meso: string }>;
  mesos: Map<string, { nome: string; uf: string; regiao: string }>;
}

export interface Contexto {
  db: Db;
  agora: () => Date;
  autoridades: X509Certificate[];
  geo: Geo;
  faixas: Map<ProdutoId, { min: number; max: number }>;
  /** Janela de carga inicial: último dia (YYYY-MM-DD) e quantas semanas para trás aceita */
  cargaInicial: { ate: string; semanas: number };
  enviarEmail: EnviarEmail;
}

export const REGIOES: Record<string, string> = { N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul' };

export async function carregarGeo(db: Db): Promise<Geo> {
  const [mun, mic, mes] = await Promise.all([
    db.query<{ codigo: string; nome: string; micro: string }>('SELECT codigo, nome, micro FROM municipios'),
    db.query<{ codigo: string; nome: string; meso: string }>('SELECT codigo, nome, meso FROM microrregioes'),
    db.query<{ codigo: string; nome: string; uf: string; regiao: string }>('SELECT codigo, nome, uf, regiao FROM mesorregioes'),
  ]);
  return {
    municipios: new Map(mun.rows.map(r => [r.codigo, { nome: r.nome, micro: r.micro }])),
    micros: new Map(mic.rows.map(r => [r.codigo, { nome: r.nome, meso: r.meso }])),
    mesos: new Map(mes.rows.map(r => [r.codigo, { nome: r.nome, uf: r.uf, regiao: r.regiao }])),
  };
}

export async function carregarFaixas(db: Db): Promise<Map<ProdutoId, { min: number; max: number }>> {
  const { rows } = await db.query<{ id: ProdutoId; preco_min: number; preco_max: number }>('SELECT id, preco_min, preco_max FROM produtos');
  return new Map(rows.map(r => [r.id, { min: r.preco_min, max: r.preco_max }]));
}

/** Áreas de um município, da micro até o Brasil. */
export function areasDoMunicipio(geo: Geo, municipio: string): { micro: string; meso: string; uf: string; regiao: string } | null {
  const mun = geo.municipios.get(municipio);
  if (!mun) return null;
  const micro = geo.micros.get(mun.micro)!;
  const meso = geo.mesos.get(micro.meso)!;
  return { micro: mun.micro, meso: micro.meso, uf: meso.uf, regiao: meso.regiao };
}

export function nomeArea(geo: Geo, nivel: string, area: string): string {
  switch (nivel) {
    case 'brasil': return 'Brasil';
    case 'regiao': return REGIOES[area] ?? area;
    case 'uf': return area;
    case 'meso': { const m = geo.mesos.get(area); return m ? `${m.nome} (${m.uf})` : area; }
    case 'micro': { const m = geo.micros.get(area); const uf = m ? geo.mesos.get(m.meso)?.uf : ''; return m ? `${m.nome} (${uf})` : area; }
    default: return area;
  }
}
