import { config } from '../config.ts';

// Semanas vão de segunda a domingo no horário de Brasília e são identificadas pela segunda-feira (YYYY-MM-DD).
const FUSO = 'America/Sao_Paulo';

/** Data local (YYYY-MM-DD) em Brasília para um instante. */
export function dataLocal(instante: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante);
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(data + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana de uma data YYYY-MM-DD. */
export function segundaDaData(data: string): string {
  const dow = new Date(data + 'T12:00:00Z').getUTCDay(); // 0 = domingo
  return somarDias(data, dow === 0 ? -6 : 1 - dow);
}

export function semanaDoInstante(instante: Date): string {
  return segundaDaData(dataLocal(instante));
}

/** Último instante para enviar NF da semana: fim do dia (Brasília) de domingo + prazoDias. */
export function prazoEnvio(semana: string, prazoDias = config.prazoDias): Date {
  const ultimoDia = somarDias(semana, 6 + prazoDias);
  return new Date(ultimoDia + 'T23:59:59.999-03:00');
}

export function prazoEncerrado(semana: string, agora: Date): boolean {
  return agora.getTime() > prazoEnvio(semana).getTime();
}
