/** Dígito verificador módulo 11 usado na chave de acesso da NF-e (pesos 2..9 da direita para a esquerda). */
export function dvChave(chave43: string): number {
  let soma = 0, peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function chaveValida(chave: string): boolean {
  return /^\d{44}$/.test(chave) && dvChave(chave.slice(0, 43)) === Number(chave[43]);
}

export function somenteDigitos(s: string): string {
  return s.replace(/\D/g, '');
}

function dvCnpj(base: string): number {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = [...base].reduce((s, d, i) => s + Number(d) * pesos[i]!, 0);
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}

export function cnpjValido(entrada: string): boolean {
  const c = somenteDigitos(entrada);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  return dvCnpj(c.slice(0, 12)) === Number(c[12]) && dvCnpj(c.slice(0, 13)) === Number(c[13]);
}

/** Completa os dígitos verificadores de uma base de 12 dígitos (raiz + filial). */
export function completarCnpj(base12: string): string {
  const d1 = dvCnpj(base12);
  return base12 + d1 + dvCnpj(base12 + d1);
}

export function formatarCnpj(c: string): string {
  return c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c;
}
