import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from './db.ts';

const scrypt = promisify(scryptCb) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(senha, sal, 64);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function conferirSenha(senha: string, armazenado: string): Promise<boolean> {
  const [alg, sal, hash] = armazenado.split('$');
  if (alg !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await scrypt(senha, Buffer.from(sal, 'base64'), esperado.length);
  return timingSafeEqual(esperado, calculado);
}

export const COOKIE = 'sessao';
const DURACAO_MS = 30 * 864e5;

export async function criarSessao(db: Db, usuarioId: number): Promise<{ token: string; expira: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DURACAO_MS);
  await db.query('INSERT INTO sessoes (token, usuario_id, expira_em) VALUES ($1, $2, $3)', [token, usuarioId, expira]);
  return { token, expira };
}

export interface Usuario { id: number; email: string; nome: string; admin: boolean }

declare module 'fastify' {
  interface FastifyRequest { usuario: Usuario | null }
}

/** Chave de API para integração com o sistema do cliente. Só o hash fica no banco. */
export function gerarTokenApi(): { token: string; hash: string; prefixo: string } {
  const token = 'pp_' + randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token), prefixo: token.slice(0, 7) };
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function carregarUsuario(db: Db, req: FastifyRequest): Promise<void> {
  req.usuario = null;
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
  if (bearer) {
    const { rows } = await db.query<Usuario>(
      `UPDATE tokens_api t SET usado_em = now() FROM usuarios u
        WHERE t.hash = $1 AND t.revogado_em IS NULL AND u.id = t.usuario_id
        RETURNING u.id, u.email, u.nome, u.admin`, [hashToken(bearer)]);
    req.usuario = rows[0] ?? null;
    return;
  }
  const token = req.cookies[COOKIE];
  if (!token) return;
  const { rows } = await db.query<Usuario>(
    `SELECT u.id, u.email, u.nome, u.admin FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token = $1 AND s.expira_em > now()`, [token]);
  req.usuario = rows[0] ?? null;
}

export function exigirLogin(req: FastifyRequest, reply: FastifyReply): Usuario | null {
  if (!req.usuario) { reply.code(401).send({ erro: 'Entre na sua conta para continuar.' }); return null; }
  return req.usuario;
}
