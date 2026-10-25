export type ProdutoId = 'gc' | 'et' | 's10' | 's500';

export const PRODUTOS: { id: ProdutoId; nome: string; anp: string }[] = [
  { id: 'gc', nome: 'Gasolina C', anp: '320102001' },
  { id: 'et', nome: 'Etanol hidratado', anp: '810101001' },
  { id: 's10', nome: 'Diesel S10', anp: '820101034' },
  { id: 's500', nome: 'Diesel S500', anp: '820101012' },
];

export const PRODUTO_IDS = PRODUTOS.map(p => p.id);

/** Identifica o produto pelo código ANP do item; sem código, tenta pela descrição. */
export function identificarProduto(codigoAnp: string, descricao: string): ProdutoId | null {
  const porCodigo = PRODUTOS.find(p => p.anp === codigoAnp);
  if (porCodigo) return porCodigo.id;
  if (codigoAnp) return null; // tem código ANP de outro produto (lubrificante, gasolina premium, etc.)
  const d = descricao.toUpperCase();
  if (/\bS-?10\b/.test(d)) return 's10';
  if (/\bS-?500\b/.test(d)) return 's500';
  if (/ETANOL|ALCOOL|ÁLCOOL/.test(d) && /HIDRATADO/.test(d)) return 'et';
  if (/GASOLINA C\b/.test(d) && !/PREMIUM|ADITIVADA|PODIUM|V-POWER|GRID/.test(d)) return 'gc';
  return null;
}
