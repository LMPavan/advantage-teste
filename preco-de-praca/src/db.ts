import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';

// numeric chega como string; para este app os valores cabem em double sem problema
pg.types.setTypeParser(1700, v => parseFloat(v));
// date chega como 'YYYY-MM-DD', sem conversão de fuso
pg.types.setTypeParser(1082, v => v);

export type Db = pg.Pool;

export function criarPool(url = config.databaseUrl): Db {
  return new pg.Pool({ connectionString: url, max: 10 });
}

const raiz = fileURLToPath(new URL('..', import.meta.url));

const REGIAO_POR_UF_CODIGO: Record<string, string> = { '1': 'N', '2': 'NE', '3': 'SE', '4': 'S', '5': 'CO' };

export async function migrar(db: Db): Promise<void> {
  await db.query('CREATE TABLE IF NOT EXISTS migracoes (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())');
  const dir = raiz + 'db/migrations/';
  for (const arquivo of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const { rowCount } = await db.query('SELECT 1 FROM migracoes WHERE nome = $1', [arquivo]);
    if (rowCount) continue;
    const cliente = await db.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(readFileSync(dir + arquivo, 'utf8'));
      await cliente.query('INSERT INTO migracoes (nome) VALUES ($1)', [arquivo]);
      await cliente.query('COMMIT');
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally {
      cliente.release();
    }
  }
  await carregarGeografia(db);
}

async function carregarGeografia(db: Db): Promise<void> {
  const { rows } = await db.query('SELECT count(*)::int AS n FROM municipios');
  if (rows[0].n > 0) return;
  const dados = JSON.parse(readFileSync(raiz + 'data/municipios-ibge.json', 'utf8')) as { linhas: string[][] };
  const mesos = new Map<string, string[]>(), micros = new Map<string, string[]>();
  for (const [, , uf, meso, mesoNome, micro, microNome] of dados.linhas as [string, string, string, string, string, string, string][]) {
    mesos.set(meso, [meso, mesoNome, uf, REGIAO_POR_UF_CODIGO[meso[0]!]!]);
    micros.set(micro, [micro, microNome, meso]);
  }
  const cliente = await db.connect();
  try {
    await cliente.query('BEGIN');
    await inserirEmLote(cliente, 'mesorregioes', ['codigo', 'nome', 'uf', 'regiao'], [...mesos.values()]);
    await inserirEmLote(cliente, 'microrregioes', ['codigo', 'nome', 'meso'], [...micros.values()]);
    await inserirEmLote(cliente, 'municipios', ['codigo', 'nome', 'micro'], dados.linhas.map(l => [l[0]!, l[1]!, l[5]!]));
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

async function inserirEmLote(cliente: pg.PoolClient, tabela: string, colunas: string[], linhas: string[][]): Promise<void> {
  for (let i = 0; i < linhas.length; i += 1000) {
    const lote = linhas.slice(i, i + 1000);
    const params: string[] = [];
    const valores = lote.map(l => '(' + l.map(v => { params.push(v); return '$' + params.length; }).join(',') + ')');
    await cliente.query(`INSERT INTO ${tabela} (${colunas.join(',')}) VALUES ${valores.join(',')}`, params);
  }
}
