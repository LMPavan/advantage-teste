import { randomBytes } from 'node:crypto';
import { gerarHash } from '../auth.ts';
import { criarPool, migrar } from '../db.ts';

// Uso:
//   npm run admin -- criar email@empresa.com "Nome"   cria um administrador e mostra a senha
//   npm run admin -- senha email@empresa.com          gera uma senha nova para qualquer usuário
const [acao, email, nome] = process.argv.slice(2);
const db = criarPool();
await migrar(db);
const senha = randomBytes(9).toString('base64url');
if (acao === 'criar' && email) {
  await db.query(`INSERT INTO usuarios (email, nome, senha_hash, admin) VALUES (lower($1), $2, $3, true)
    ON CONFLICT (email) DO UPDATE SET admin = true, senha_hash = EXCLUDED.senha_hash`, [email, nome || 'Administração', await gerarHash(senha)]);
  console.log(`Administrador ${email} pronto. Senha: ${senha}`);
} else if (acao === 'senha' && email) {
  const { rowCount } = await db.query('UPDATE usuarios SET senha_hash = $2 WHERE email = lower($1)', [email, await gerarHash(senha)]);
  console.log(rowCount ? `Nova senha de ${email}: ${senha}` : `Usuário ${email} não encontrado.`);
} else {
  console.log('Uso: npm run admin -- criar <email> [nome]  |  npm run admin -- senha <email>');
  process.exitCode = 1;
}
await db.end();
