import type { ProdutoId } from '../dominio/produtos.ts';
import { mediaPonderada, resumir, type Resumo } from './estatisticas.ts';

export type Nivel = 'brasil' | 'regiao' | 'uf' | 'meso' | 'micro';
export const NIVEIS: Nivel[] = ['brasil', 'regiao', 'uf', 'meso', 'micro'];

/**
 * Níveis em que o comparativo por distribuidora é publicado. Abaixo da UF só saem totais:
 * cruzar distribuidora com micro e mesorregião abriria muitas combinações para isolar um posto por subtração.
 */
export const NIVEIS_DISTRIBUIDORA: Nivel[] = ['brasil', 'regiao', 'uf'];

export interface Contribuicao {
  postoId: number;
  produto: ProdutoId;
  distribuidoraId: number;
  litros: number;
  precoLitro: number;
  regiao: string;
  uf: string;
  meso: string;
  micro: string;
}

export interface Celula {
  produto: ProdutoId;
  nivel: Nivel;
  area: string;
  distribuidoraId: number; // 0 = todas
  regiao: string | null;
  uf: string | null;
  meso: string | null;
  /** valor de cada posto na célula (média ponderada por volume na semana) */
  valores: Map<number, number>;
  aberta: boolean;
  motivo: 'poucos_postos' | 'protecao_subtracao' | null;
  resumo: Resumo | null;
}

const chave = (nivel: Nivel, area: string, dist: number) => `${nivel}:${area}:${dist}`;
const chaveDe = (c: Celula) => chave(c.nivel, c.area, c.distribuidoraId);

function caminho(c: Contribuicao): [Nivel, string, string | null, string | null, string | null][] {
  return [
    ['brasil', 'BR', null, null, null],
    ['regiao', c.regiao, c.regiao, null, null],
    ['uf', c.uf, c.regiao, c.uf, null],
    ['meso', c.meso, c.regiao, c.uf, c.meso],
    ['micro', c.micro, c.regiao, c.uf, c.meso],
  ];
}

/**
 * Calcula as células publicáveis de uma semana.
 *
 * 1. Mínimo de postos: uma célula só abre com pelo menos `k` postos distintos.
 * 2. Proteção contra subtração: quem vê uma área e as subáreas abertas dentro dela consegue calcular o que sobra.
 *    Se esse resto tem entre 1 e k-1 postos, fechamos mais uma célula até o resto ficar vazio ou com k ou mais.
 *    A verificação cobre a hierarquia dos totais, a de cada distribuidora e a "área menos distribuidoras".
 */
export function calcularCelulas(contribuicoes: Contribuicao[], k: number): Celula[] {
  const porProduto = new Map<ProdutoId, Contribuicao[]>();
  for (const c of contribuicoes) {
    if (!porProduto.has(c.produto)) porProduto.set(c.produto, []);
    porProduto.get(c.produto)!.push(c);
  }
  const saida: Celula[] = [];
  for (const [produto, lista] of porProduto) {
    const itens = new Map<string, Map<number, { litros: number; precoLitro: number }[]>>();
    const meta = new Map<string, Omit<Celula, 'valores' | 'aberta' | 'motivo' | 'resumo'>>();
    for (const c of lista) {
      for (const [nivel, area, regiao, uf, meso] of caminho(c)) {
        const dists = NIVEIS_DISTRIBUIDORA.includes(nivel) ? [0, c.distribuidoraId] : [0];
        for (const dist of dists) {
          const ch = chave(nivel, area, dist);
          if (!itens.has(ch)) { itens.set(ch, new Map()); meta.set(ch, { produto, nivel, area, distribuidoraId: dist, regiao, uf, meso }); }
          const porPosto = itens.get(ch)!;
          if (!porPosto.has(c.postoId)) porPosto.set(c.postoId, []);
          porPosto.get(c.postoId)!.push(c);
        }
      }
    }
    const celulas = new Map<string, Celula>();
    for (const [ch, porPosto] of itens) {
      const valores = new Map([...porPosto].map(([id, its]) => [id, mediaPonderada(its)]));
      const aberta = valores.size >= k;
      celulas.set(ch, { ...meta.get(ch)!, valores, aberta, motivo: aberta ? null : 'poucos_postos', resumo: null });
    }

    aplicarProtecaoSubtracao(celulas, k);

    for (const c of celulas.values()) {
      if (c.aberta) c.resumo = resumir([...c.valores.values()]);
      saida.push(c);
    }
  }
  return saida;
}

type Arvore = Map<string, string[]>; // célula -> células imediatamente abaixo

function chavePai(c: Celula): string {
  const d = c.distribuidoraId;
  switch (c.nivel) {
    case 'micro': return chave('meso', c.meso!, d);
    case 'meso': return chave('uf', c.uf!, d);
    case 'uf': return chave('regiao', c.regiao!, d);
    case 'regiao': return chave('brasil', 'BR', d);
    default: throw new Error('brasil não tem nível acima');
  }
}

function montarArvores(celulas: Map<string, Celula>) {
  const ligar = (arv: Arvore, pai: string, filho: string) => {
    if (!arv.has(pai)) arv.set(pai, []);
    arv.get(pai)!.push(filho);
  };
  // Hierarquia geográfica por distribuidora (0 = totais) e, para cada área, a "estrela" área -> distribuidoras
  const hierarquias = new Map<number, Arvore>([[0, new Map()]]);
  const estrelas: Arvore = new Map();
  for (const [ch, c] of celulas) {
    if (c.nivel !== 'brasil') {
      if (!hierarquias.has(c.distribuidoraId)) hierarquias.set(c.distribuidoraId, new Map());
      ligar(hierarquias.get(c.distribuidoraId)!, chavePai(c), ch);
    }
    if (c.distribuidoraId !== 0) ligar(estrelas, chave(c.nivel, c.area, 0), ch);
  }
  return { totais: hierarquias.get(0)!, hierarquias: [...hierarquias.values()], estrelas };
}

const ordem = (a: Celula, b: Celula) => a.valores.size - b.valores.size || chaveDe(a).localeCompare(chaveDe(b));

/** Postos de `base` que não estão em nenhuma das células abertas `cobrindo` nem em `excluir`. */
function resto(base: Celula, cobrindo: Celula[], excluir: Set<number> = new Set()): number {
  const cobertos = new Set(excluir);
  for (const q of cobrindo) for (const id of q.valores.keys()) cobertos.add(id);
  let n = 0;
  for (const id of base.valores.keys()) if (!cobertos.has(id)) n++;
  return n;
}

function aplicarProtecaoSubtracao(celulas: Map<string, Celula>, k: number): void {
  const { totais, hierarquias, estrelas } = montarArvores(celulas);
  const cel = (ch: string) => celulas.get(ch)!;
  const abertasAbaixo = (arv: Arvore, ch: string): Celula[] =>
    (arv.get(ch) ?? []).flatMap(f => [...(cel(f).aberta ? [cel(f)] : []), ...abertasAbaixo(arv, f)]);
  const inseguro = (n: number) => n > 0 && n < k;
  const fechar = (c: Celula) => { c.aberta = false; c.motivo = 'protecao_subtracao'; };

  let mudou = true;
  while (mudou) {
    mudou = false;

    // 1. Área menos as subáreas abertas, em cada hierarquia
    for (const arv of hierarquias) {
      for (const pai of arv.keys()) {
        const p = cel(pai);
        if (!p.aberta) continue;
        const abertas = abertasAbaixo(arv, pai);
        if (!inseguro(resto(p, abertas))) continue;
        // Fechar a subárea mais estreita sem outra aberta embaixo devolve pelo menos k postos ao resto
        const folhas = abertas.filter(c => abertasAbaixo(arv, chaveDe(c)).length === 0).sort(ordem);
        fechar(folhas[0]!);
        mudou = true;
      }
    }

    // 2. Área menos distribuidoras (cada uma e todas juntas), também descontando subáreas que não compram delas
    for (const [pai, filhas] of estrelas) {
      const p = cel(pai);
      if (!p.aberta) continue;
      const dists = filhas.map(cel).filter(c => c.aberta);
      if (!dists.length) continue;
      const subareas = abertasAbaixo(totais, pai);
      for (const grupo of [...dists.map(d => [d]), dists]) {
        const deles = new Set(grupo.flatMap(d => [...d.valores.keys()]));
        const disjuntas = subareas.filter(b => ![...b.valores.keys()].some(id => deles.has(id)));
        if (inseguro(resto(p, [], deles)) || inseguro(resto(p, disjuntas, deles))) {
          fechar([...grupo].sort(ordem)[0]!);
          mudou = true;
          break;
        }
      }
    }
  }
}
