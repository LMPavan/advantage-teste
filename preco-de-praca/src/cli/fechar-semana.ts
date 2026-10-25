import { criarPool, migrar } from '../db.ts';
import { segundaDaData } from '../dominio/semanas.ts';
import { fecharSemana, fecharSemanasPendentes } from '../estatistica/fechamento.ts';

// Uso: npm run fechar-semana            fecha todas as semanas com prazo vencido
//      npm run fechar-semana 2026-10-12 fecha uma semana específica (ignora o prazo)
const db = criarPool();
await migrar(db);
const arg = process.argv[2];
if (arg) {
  const r = await fecharSemana(db, segundaDaData(arg));
  console.log(`Semana ${segundaDaData(arg)}: ${r.postos} postos, ${r.abertas} de ${r.celulas} células publicadas.`);
} else {
  const f = await fecharSemanasPendentes(db);
  console.log(f.length ? `Publicadas: ${f.join(', ')}` : 'Nenhuma semana pendente.');
}
await db.end();
