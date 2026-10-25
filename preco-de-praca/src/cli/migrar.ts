import { criarPool, migrar } from '../db.ts';

const db = criarPool();
await migrar(db);
console.log('Banco atualizado.');
await db.end();
