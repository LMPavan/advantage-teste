/**
 * Preferências client-side por meta: quais já tiveram a celebração exibida (evita repetir a cada reload)
 * e a meta pessoal "esticada" que o frentista definiu por cima da meta oficial. Tudo fica só no navegador
 * do frentista — não existe backend para isso, é uma camada de engajamento pessoal.
 */

const CELEBRATED_KEY = "fuelgoals_celebrated_goals";
const STRETCH_KEY = "fuelgoals_stretch_goals";

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // localStorage indisponível (modo privado etc.) — celebração simplesmente pode repetir.
  }
}

function celebrationKey(goalId: string, endDate: string): string {
  return `${goalId}:${endDate}`;
}

export function wasCelebrated(goalId: string, endDate: string): boolean {
  return readSet(CELEBRATED_KEY).has(celebrationKey(goalId, endDate));
}

export function markCelebrated(goalId: string, endDate: string) {
  const set = readSet(CELEBRATED_KEY);
  set.add(celebrationKey(goalId, endDate));
  writeSet(CELEBRATED_KEY, set);
}

function readStretchMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STRETCH_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function getStretchPercent(goalId: string): number | null {
  const map = readStretchMap();
  return map[goalId] ?? null;
}

export function setStretchPercent(goalId: string, percent: number | null) {
  try {
    const map = readStretchMap();
    if (percent === null) delete map[goalId];
    else map[goalId] = percent;
    localStorage.setItem(STRETCH_KEY, JSON.stringify(map));
  } catch {
    // ignora
  }
}
