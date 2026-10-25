import { mkdirSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Baixa do ITI o pacote com os certificados de todas as autoridades da ICP-Brasil e extrai em data/icp-brasil/.
// Com eles, a assinatura da NF-e só é aceita se o certificado da distribuidora for da ICP-Brasil.
const URL_ITI = 'https://acraiz.icpbrasil.gov.br/credenciadas/CertificadosAC-ICP-Brasil/ACcompactado.zip';

/** Extrai os arquivos de um .zip (métodos "stored" e "deflate"), lendo o diretório central. */
export function extrairZip(zip: Buffer): { nome: string; dados: Buffer }[] {
  let fim = zip.length - 22;
  while (fim >= 0 && zip.readUInt32LE(fim) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error('Arquivo .zip inválido.');
  const total = zip.readUInt16LE(fim + 10);
  let p = zip.readUInt32LE(fim + 16);
  const out: { nome: string; dados: Buffer }[] = [];
  for (let i = 0; i < total; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('Diretório do .zip corrompido.');
    const metodo = zip.readUInt16LE(p + 10), tamanho = zip.readUInt32LE(p + 20);
    const lNome = zip.readUInt16LE(p + 28), lExtra = zip.readUInt16LE(p + 30), lComent = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const nome = zip.subarray(p + 46, p + 46 + lNome).toString('utf8');
    p += 46 + lNome + lExtra + lComent;
    if (nome.endsWith('/')) continue;
    const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const bruto = zip.subarray(inicio, inicio + tamanho);
    if (metodo === 0) out.push({ nome, dados: Buffer.from(bruto) });
    else if (metodo === 8) out.push({ nome, dados: inflateRawSync(bruto) });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const destino = fileURLToPath(new URL('../../data/icp-brasil/', import.meta.url));
  const r = await fetch(URL_ITI);
  if (!r.ok) throw new Error(`Falha ao baixar do ITI: HTTP ${r.status}`);
  const arquivos = extrairZip(Buffer.from(await r.arrayBuffer())).filter(a => /\.(crt|cer|pem)$/i.test(a.nome));
  mkdirSync(destino, { recursive: true });
  for (const a of arquivos) writeFileSync(destino + a.nome.split('/').pop(), a.dados);
  console.log(`${arquivos.length} certificados da ICP-Brasil salvos em ${destino}`);
}
