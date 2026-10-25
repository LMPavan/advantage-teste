import { situacaoSemana } from './acesso.ts';
import { config } from './config.ts';
import type { Db } from './db.ts';
import { PRODUTOS } from './dominio/produtos.ts';
import { momentoLocal, prazoEncerrado, semanaDoInstante, somarDias } from './dominio/semanas.ts';
import type { EnviarEmail } from './email.ts';

const dataBr = (s: string) => s.split('-').reverse().join('/');
const RODAPE = `\n\n${config.appUrl}\n\nPara não receber lembretes, desmarque a opção em "Minha conta".`;

/**
 * Lembretes por e-mail, chamados de hora em hora (horário de Brasília):
 * - segunda a partir das 9h e terça a partir das 12h: quem ainda não completou a semana anterior, cujo prazo é terça 23h59;
 * - quarta a partir das 8h: aviso de que os preços da semana foram publicados.
 * Cada lembrete é registrado antes do envio, então não se repete.
 */
export async function enviarLembretes(db: Db, enviar: EnviarEmail, agora = new Date()): Promise<number> {
  const { diaSemana, hora } = momentoLocal(agora);
  let enviados = 0;
  const registrar = async (usuarioId: number, semana: string, tipo: string) =>
    (await db.query('INSERT INTO lembretes_enviados (usuario_id, semana, tipo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [usuarioId, semana, tipo])).rowCount === 1;

  const { rows: usuarios } = await db.query<{ id: number; email: string; nome: string }>(
    `SELECT DISTINCT u.id, u.email, u.nome FROM usuarios u JOIN postos p ON p.usuario_id = u.id
      WHERE u.lembretes AND u.termos_versao IS NOT NULL AND NOT p.demo AND p.assinatura IN ('teste', 'ativa')`);

  const tipoPrazo = diaSemana === 1 && hora >= 9 ? 'prazo_segunda' : diaSemana === 2 && hora >= 12 ? 'prazo_terca' : null;
  if (tipoPrazo) {
    const semana = somarDias(semanaDoInstante(agora), -7);
    const fechada = (await db.query('SELECT 1 FROM semanas_fechadas WHERE semana = $1', [semana])).rowCount;
    if (!fechada && !prazoEncerrado(semana, agora)) {
      for (const u of usuarios) {
        const { rows: postos } = await db.query<{ id: number; razao_social: string }>('SELECT id, razao_social FROM postos WHERE usuario_id = $1 ORDER BY id', [u.id]);
        const faltas: string[] = [];
        for (const p of postos) {
          const s = await situacaoSemana(db, p.id, semana);
          const pend = PRODUTOS.filter(pr => s.produtos[pr.id] === 'pendente').map(pr => pr.nome);
          if (pend.length) faltas.push(`- ${p.razao_social}: ${pend.join(', ')}`);
        }
        if (!faltas.length || !(await registrar(u.id, semana, tipoPrazo))) continue;
        await enviar({
          para: u.email,
          assunto: `${tipoPrazo === 'prazo_terca' ? 'Último dia: ' : ''}envie as notas da semana de ${dataBr(semana)}`,
          texto: `Olá, ${u.nome}.\n\nO prazo para enviar as notas de compra da semana de ${dataBr(semana)} termina ${tipoPrazo === 'prazo_terca' ? 'hoje' : 'amanhã'} (terça-feira) às 23h59. Ainda faltam:\n\n${faltas.join('\n')}\n\nSe não comprou algum produto, marque "Não comprei" na tela de envio. Sem a semana completa, o painel fica bloqueado.${RODAPE}`,
        });
        enviados++;
      }
    }
  }

  if (diaSemana === 3 && hora >= 8) {
    const { rows } = await db.query<{ semana: string; postos: number }>(
      "SELECT semana, postos FROM semanas_fechadas WHERE fechada_em > $1::timestamptz - interval '2 days' ORDER BY semana DESC LIMIT 1", [agora]);
    const pub = rows[0];
    if (pub) {
      for (const u of usuarios) {
        if (!(await registrar(u.id, pub.semana, 'publicada'))) continue;
        await enviar({
          para: u.email,
          assunto: `Preços da semana de ${dataBr(pub.semana)} publicados`,
          texto: `Olá, ${u.nome}.\n\nOs preços de compra da semana de ${dataBr(pub.semana)} já estão no painel, com notas de ${pub.postos} empresas.${RODAPE}`,
        });
        enviados++;
      }
    }
  }
  return enviados;
}
