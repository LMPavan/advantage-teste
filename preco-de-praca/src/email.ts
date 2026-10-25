import nodemailer from 'nodemailer';
import { config } from './config.ts';

export interface Email { para: string; assunto: string; texto: string }
export type EnviarEmail = (email: Email) => Promise<void>;

/** Envia por SMTP quando SMTP_URL está configurado; senão só registra no log (útil em desenvolvimento). */
export function criarEnviador(log: (msg: string) => void): EnviarEmail {
  if (!config.smtpUrl) {
    return async e => log(`e-mail não enviado (SMTP_URL ausente) para ${e.para}: ${e.assunto}`);
  }
  const transporte = nodemailer.createTransport(config.smtpUrl);
  return async e => {
    await transporte.sendMail({ from: config.emailRemetente, to: e.para, subject: e.assunto, text: e.texto });
  };
}
