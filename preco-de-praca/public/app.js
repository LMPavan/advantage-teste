// Preço de Praça: interface do posto. Todas as estatísticas vêm prontas do servidor, já com o sigilo aplicado.

const PRODUTOS = [
  { id: 'gc', nome: 'Gasolina C', curto: 'Gasolina' },
  { id: 'et', nome: 'Etanol hidratado', curto: 'Etanol' },
  { id: 's10', nome: 'Diesel S10', curto: 'Diesel S10' },
  { id: 's500', nome: 'Diesel S500', curto: 'Diesel S500' },
];
const PBY = Object.fromEntries(PRODUTOS.map(p => [p.id, p]));
const NIVEIS = ['brasil', 'regiao', 'uf', 'meso', 'micro'];
const NOME_NIVEL = { brasil: 'Brasil', regiao: 'Região', uf: 'Estado', meso: 'Mesorregião', micro: 'Microrregião' };
const NIVEIS_DISTRIBUIDORA = ['brasil', 'regiao', 'uf'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const S = {
  eu: null, geo: null, semanas: null, tab: 'exec',
  prod: 'gc', regiao: '', uf: '', meso: '', micro: '', semana: '',
  agrupar: 'uf', ordem: { chave: 'mediana', dir: 1 },
  painel: null, tabela: null, nf: null, historico: null,
};
const $app = document.getElementById('app');

/* ---------- utilidades ---------- */
async function api(caminho, op = {}) {
  const r = await fetch(caminho, { credentials: 'same-origin', ...op });
  const tipo = r.headers.get('content-type') || '';
  const corpo = tipo.includes('json') ? await r.json() : await r.text();
  if (!r.ok) { const e = new Error(corpo?.erro || 'Algo deu errado. Tente de novo.'); e.status = r.status; e.corpo = corpo; throw e; }
  return corpo;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v, d = 3) => v == null ? '—' : Number(v).toFixed(d).replace('.', ',');
const R = (v, d = 3) => v == null ? '—' : 'R$ ' + brl(v, d);
const dataCurta = s => { const [, m, d] = s.split('-'); return `${Number(d)}/${MESES[Number(m) - 1]}`; };
const dataLonga = s => { const [a, m, d] = s.split('-'); return `${d}/${m}/${a}`; };
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3400); }

function escopo() {
  if (S.micro) return ['micro', S.micro];
  if (S.meso) return ['meso', S.meso];
  if (S.uf) return ['uf', S.uf];
  if (S.regiao) return ['regiao', S.regiao];
  return ['brasil', 'BR'];
}
const posto = () => S.eu.postos[0];

/* ---------- tooltip ---------- */
const TIPS = {}; let tipN = 0;
function tip(titulo, linhas) { const id = 't' + tipN++; TIPS[id] = `<div class="tt">${esc(titulo)}</div><table>${linhas.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="num">${esc(v)}</td></tr>`).join('')}</table>`; return id; }
const linhasCelula = c => [['Empresas', c.postos], ['Média', R(c.media)], ['Mediana', R(c.mediana)], ['Moda', c.moda != null ? R(c.moda, 2) : 'sem repetição']];
const $tip = document.getElementById('tip');
document.addEventListener('pointermove', e => {
  const t = e.target.closest?.('[data-tip]');
  if (!t || !TIPS[t.dataset.tip]) { $tip.hidden = true; return; }
  $tip.innerHTML = TIPS[t.dataset.tip]; $tip.hidden = false;
  const r = $tip.getBoundingClientRect();
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
  $tip.style.left = Math.max(8, x) + 'px'; $tip.style.top = Math.max(8, y) + 'px';
});
document.addEventListener('scroll', () => { $tip.hidden = true; }, true);

/* ---------- entrada ---------- */
let CONVITE = false;
function telaEntrada(modo = 'entrar', erro = '') {
  document.getElementById('topo').hidden = true;
  const cad = modo === 'cadastro';
  $app.innerHTML = `<div class="entrada">
    <div class="brand"><h1 style="font-size:28px">Preço de Praça</h1></div>
    <p class="ink2" style="margin:0">Veja quanto os postos da sua região pagam às distribuidoras. Para ver, você compartilha toda semana a NF de compra.</p>
    <form class="card" id="f-entrada" novalidate>
      <h2>${cad ? 'Cadastrar posto' : 'Entrar'}</h2>
      ${cad ? `
        <div class="field"><label for="c-nome">Seu nome</label><input type="text" id="c-nome" autocomplete="name" required></div>
        <div class="field"><label for="c-razao">Razão social do posto</label><input type="text" id="c-razao" required></div>
        <div class="field"><label for="c-cnpj">CNPJ do posto</label><input type="text" id="c-cnpj" inputmode="numeric" placeholder="00.000.000/0000-00" required></div>
        ${CONVITE ? '<div class="field"><label for="c-convite">Código de convite</label><input type="text" id="c-convite" required></div>' : ''}` : ''}
      <div class="field"><label for="c-email">E-mail</label><input type="email" id="c-email" autocomplete="email" required></div>
      <div class="field"><label for="c-senha">Senha</label><input type="password" id="c-senha" autocomplete="${cad ? 'new-password' : 'current-password'}" required minlength="8"></div>
      ${erro ? `<p class="erro" role="alert">${esc(erro)}</p>` : ''}
      <button class="btn" type="submit">${cad ? 'Cadastrar e começar o teste grátis' : 'Entrar'}</button>
      <button class="btn ghost" type="button" id="trocar">${cad ? 'Já tenho conta' : 'Cadastrar meu posto'}</button>
      ${cad ? '<p class="muted" style="font-size:12px;margin:0">A cidade do posto é definida pela primeira NF-e que você enviar, pelo endereço do destinatário.</p>' : '<p class="muted" style="font-size:12px;margin:0">Esqueceu a senha? Peça uma senha provisória à equipe do Preço de Praça.</p>'}
    </form></div>`;
  document.getElementById('trocar').onclick = () => telaEntrada(cad ? 'entrar' : 'cadastro');
  document.getElementById('f-entrada').onsubmit = async e => {
    e.preventDefault();
    const v = id => document.getElementById(id)?.value ?? '';
    try {
      if (cad) await api('/api/cadastro', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: v('c-nome'), razaoSocial: v('c-razao'), cnpj: v('c-cnpj'), email: v('c-email'), senha: v('c-senha'), convite: v('c-convite') }) });
      else await api('/api/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: v('c-email'), senha: v('c-senha') }) });
      iniciar();
    } catch (err) { telaEntrada(modo, err.message); }
  };
}

/* ---------- topo ---------- */
function renderTopo() {
  const p = posto();
  const aberta = p?.semanaAberta;
  let pill = '';
  if (!S.eu.liberado) pill = `<span class="pill lock"><span class="dot"></span>${p?.motivo === 'assinatura' ? 'Assinatura inativa' : 'NF da semana pendente'}</span>`;
  else if (aberta?.completa) pill = `<span class="pill ok"><span class="dot"></span>Semana de ${dataCurta(aberta.semana)} enviada</span>`;
  else pill = `<span class="pill rev"><span class="dot"></span>Envie a semana de ${dataCurta(aberta.semana)}</span>`;
  document.getElementById('me').innerHTML = `<span class="ink2">${esc(p?.razaoSocial ?? '')}${p?.microNome ? ' · ' + esc(p.microNome) : ''}</span>${pill}<button class="sair" id="sair">Sair</button>`;
  document.getElementById('sair').onclick = async () => { await api('/api/sair', { method: 'POST' }); telaEntrada(); };
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab));
}

/* ---------- filtros ---------- */
function htmlFiltros() {
  const g = S.geo;
  const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
  const ufs = g.ufs.filter(u => !S.regiao || u.regiao === S.regiao);
  const mesos = g.mesos.filter(m => (!S.uf || m.uf === S.uf) && (!S.regiao || ufs.some(u => u.sigla === m.uf)));
  const micros = S.meso ? g.micros.filter(m => m.meso === S.meso) : S.uf ? g.micros.filter(m => mesos.some(x => x.codigo === m.meso)) : [];
  const temFiltro = S.regiao || S.uf || S.meso || S.micro;
  const [nivel, area] = escopo();
  return `<div class="filters">
    <div class="field"><label>Produto</label><div class="seg" id="f-prod">${PRODUTOS.map(p => `<button data-prod="${p.id}" aria-pressed="${S.prod === p.id}">${p.curto}</button>`).join('')}</div></div>
    <div class="field"><label for="f-regiao">Região</label><select id="f-regiao">${opt('', 'Todas', !S.regiao)}${g.regioes.map(r => opt(r.codigo, r.nome, S.regiao === r.codigo)).join('')}</select></div>
    <div class="field"><label for="f-uf">Estado</label><select id="f-uf">${opt('', 'Todos', !S.uf)}${ufs.map(u => opt(u.sigla, u.sigla, S.uf === u.sigla)).join('')}</select></div>
    <div class="field"><label for="f-meso">Mesorregião</label><select id="f-meso" ${S.uf ? '' : 'disabled title="Escolha um estado"'}>${opt('', S.uf ? 'Todas' : 'Escolha o estado', !S.meso)}${S.uf ? mesos.map(m => opt(m.codigo, m.nome, S.meso === m.codigo)).join('') : ''}</select></div>
    <div class="field"><label for="f-micro">Microrregião</label><select id="f-micro" ${S.uf ? '' : 'disabled'}>${opt('', S.uf ? 'Todas' : 'Escolha o estado', !S.micro)}${micros.map(m => opt(m.codigo, m.nome, S.micro === m.codigo)).join('')}</select></div>
    <div class="field"><label for="f-semana">Semana de compra</label><select id="f-semana">${S.semanas.publicadas.map(w => opt(w.semana, 'Semana de ' + dataCurta(w.semana), S.semana === w.semana)).join('')}</select></div>
    ${temFiltro ? '<button class="btn ghost" id="f-limpar">Ver Brasil</button>' : ''}
    ${posto()?.areas ? '<button class="btn ghost" id="f-minha">Minha microrregião</button>' : ''}
  </div>
  <div class="scope">Mostrando <b>${esc(S.painel?.area?.nome ?? NOME_NIVEL[nivel])}</b> · ${PBY[S.prod].nome} · semana de ${dataCurta(S.semana)} · nível: ${NOME_NIVEL[nivel].toLowerCase()}</div>`;
}

function ligarFiltros(raiz) {
  raiz.querySelector('.filters')?.addEventListener('change', e => {
    const id = e.target.id, v = e.target.value;
    if (id === 'f-regiao') { S.regiao = v; S.uf = S.meso = S.micro = ''; }
    if (id === 'f-uf') { S.uf = v; S.meso = S.micro = ''; if (v) S.regiao = S.geo.ufs.find(u => u.sigla === v).regiao; }
    if (id === 'f-meso') { S.meso = v; S.micro = ''; }
    if (id === 'f-micro') { S.micro = v; if (v) S.meso = S.geo.micros.find(m => m.codigo === v).meso; }
    if (id === 'f-semana') S.semana = v;
    carregar();
  });
  raiz.querySelector('.filters')?.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.prod) { S.prod = b.dataset.prod; carregar(); }
    if (b.id === 'f-limpar') { S.regiao = S.uf = S.meso = S.micro = ''; carregar(); }
    if (b.id === 'f-minha') irParaMinhaRegiao();
  });
}
function irParaMinhaRegiao() {
  const a = posto().areas;
  Object.assign(S, { regiao: a.regiao, uf: a.uf, meso: a.meso, micro: a.micro });
  carregar();
}

/* ---------- bloqueio ---------- */
function htmlBloqueio() {
  const p = S.eu.postos.find(x => !x.liberado) ?? posto();
  const assinatura = p?.motivo === 'assinatura';
  return `<div class="lockable locked"><div class="lock-overlay"><div class="lock-card">
    <span class="pill lock"><span class="dot"></span>Visualização bloqueada</span>
    <h2>${assinatura ? 'Sua assinatura não está ativa' : 'Envie a NF desta semana para continuar vendo os preços'}</h2>
    <p class="ink2" style="margin:0">${assinatura ? 'Regularize a assinatura para voltar a ver o painel.' : `Você não enviou a semana de ${dataCurta(p.semanaPublicada.semana)}, que é a publicada agora. O painel volta assim que você completar a semana de ${dataCurta(p.semanaAberta.semana)} (gasolina, etanol, diesel S10 e S500, ou "não comprei").`}</p>
    ${assinatura ? '' : '<div><button class="btn" data-goto="nf">Enviar NF agora</button></div>'}
  </div></div><div class="content"><div style="height:420px"></div></div></div>`;
}

/* ---------- visão executiva ---------- */
function kpi(k) {
  const c = k.atual, a = k.anterior, p = PBY[k.produto];
  let delta = '<span class="delta flat">sem comparação</span>';
  if (c?.aberta && a?.aberta) {
    const d = c.mediana - a.mediana;
    const cls = Math.abs(d) < 0.0005 ? 'flat' : d > 0 ? 'up' : 'down';
    delta = `<span class="delta ${cls}">${cls === 'flat' ? '• estável' : (d > 0 ? '▲ ' : '▼ ') + brl(Math.abs(d))} vs semana anterior</span>`;
  }
  if (!c?.aberta) {
    return `<button class="kpi" data-prod="${p.id}" aria-pressed="${S.prod === p.id}"><span class="eyebrow">${p.nome} · mediana</span>
      <span class="v muted" style="font-size:18px">Dado protegido</span>
      <span class="foot"><span>${c ? (Number(c.postos) < 5 ? `${c.postos} de 5 empresas necessárias` : 'fechado para evitar identificar postos por subtração') : 'nenhum envio nesta área'}</span></span></button>`;
  }
  return `<button class="kpi" data-prod="${p.id}" aria-pressed="${S.prod === p.id}" data-tip="${tip(p.nome, linhasCelula(c))}">
    <span class="eyebrow">${p.nome} · mediana</span>
    <span class="v"><small>R$</small>${brl(c.mediana)}</span>${delta}
    <span class="foot"><span>Média ${R(c.media)}</span><span>${esc(c.postos)} empresas</span></span></button>`;
}

function niceTicks(lo, hi, max = 5) {
  const span = hi - lo || 0.1;
  const passo = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1].find(s => span / s <= max) || 1;
  const out = [];
  for (let t = Math.floor(lo / passo) * passo; t <= Math.ceil(hi / passo) * passo + 1e-9; t += passo) out.push(Math.round(t * 1000) / 1000);
  return out;
}

function graficoTendencia(pts) {
  const ok = pts.filter(p => p.celula?.aberta);
  if (!ok.length) return '<div class="empty">Nenhuma semana com dados publicáveis nesta área.</div>';
  const W = 640, H = 230, m = { l: 56, r: 18, t: 14, b: 28 };
  const ticks = niceTicks(Math.min(...ok.flatMap(p => [p.celula.media, p.celula.mediana])) - 0.02, Math.max(...ok.flatMap(p => [p.celula.media, p.celula.mediana])) + 0.02);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const n = Math.max(pts.length, 2);
  const x = i => m.l + i * (W - m.l - m.r) / (n - 1);
  const y = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  let faixa = '', linha = '', seg = [];
  const fecha = () => {
    if (seg.length > 1) {
      faixa += `<path d="M${seg.map(p => `${x(p.i)},${y(p.celula.media)}`).join('L')}" fill="none" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
      linha += `<path d="M${seg.map(p => `${x(p.i)},${y(p.celula.mediana)}`).join('L')}" fill="none" stroke="var(--series)" stroke-width="2" stroke-linejoin="round"/>`;
    }
    seg = [];
  };
  pts.forEach((p, i) => { p.i = i; if (p.celula?.aberta) seg.push(p); else fecha(); }); fecha();
  const grade = ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${brl(t, 2)}</text>`).join('');
  const rotulos = pts.map(p => `<text x="${x(p.i)}" y="${H - 8}" text-anchor="middle" ${p.semana === S.semana ? 'style="fill:var(--ink);font-weight:600"' : ''}>${dataCurta(p.semana)}</text>`).join('');
  const col = (W - m.l - m.r) / (n - 1);
  const pontos = pts.map(p => p.celula?.aberta
    ? `<circle cx="${x(p.i)}" cy="${y(p.celula.mediana)}" r="${p.semana === S.semana ? 5.5 : 4}" fill="var(--series)" stroke="var(--surface)" stroke-width="2"/>`
    : `<text x="${x(p.i)}" y="${(m.t + H - m.b) / 2}" text-anchor="middle">protegido</text>`).join('');
  const alvos = pts.map(p => `<rect x="${x(p.i) - col / 2}" y="${m.t}" width="${col}" height="${H - m.t - m.b}" fill="transparent" style="cursor:pointer" data-semana="${p.semana}"
    data-tip="${p.celula?.aberta ? tip('Semana de ' + dataCurta(p.semana), linhasCelula(p.celula)) : tip('Semana de ' + dataCurta(p.semana), [['Situação', 'dado protegido']])}"/>`).join('');
  const ult = ok[ok.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Mediana e média semanais">${grade}${faixa}${linha}${pontos}
    <text x="${x(ult.i) - 8}" y="${y(ult.celula.mediana) - 10}" text-anchor="end" style="fill:var(--ink);font-weight:600">${brl(ult.celula.mediana)}</text>${rotulos}${alvos}</svg>
    <div class="legend"><span><i style="width:18px;height:2px;background:var(--series)"></i>Mediana</span><span><i style="width:18px;height:0;border-top:1.5px dashed var(--ink-2)"></i>Média</span><span class="muted">Clique numa semana para selecioná-la</span></div>`;
}

function blocoDistribuidoras(p) {
  const [nivel] = escopo();
  if (!NIVEIS_DISTRIBUIDORA.includes(nivel)) {
    return '<div class="empty">O comparativo de distribuidoras é publicado por estado, região e Brasil. Em meso e microrregião mostramos só o total, para nenhum posto ser identificado.</div>';
  }
  const ds = p.distribuidoras;
  if (!ds.length) return `<div class="empty">Nenhuma distribuidora com dados suficientes nesta área.${p.distribuidorasProtegidas ? ` ${p.distribuidorasProtegidas} protegida(s).` : ''}</div>`;
  const ticks = niceTicks(Math.min(...ds.flatMap(d => [d.celula.media, d.celula.mediana])) - 0.02, Math.max(...ds.flatMap(d => [d.celula.media, d.celula.mediana])) + 0.02);
  const lo = ticks[0], hi = ticks[ticks.length - 1], pct = v => (v - lo) / (hi - lo) * 100;
  const melhor = ds[0].celula.mediana;
  return `<div class="axis" aria-hidden="true"><span></span><div class="ticks">${ticks.map(t => `<span style="left:${pct(t)}%">${brl(t, 2)}</span>`).join('')}</div><span style="text-align:right">mediana</span></div>
    <div class="drows">${ds.map((d, i) => `<div class="drow" data-tip="${tip(d.nome, linhasCelula(d.celula))}">
      <div class="dname">${esc(d.nome)}<span class="sub">${esc(d.celula.postos)} empresas</span></div>
      <div class="track"><div class="rail"></div><div class="avg" style="left:${pct(d.celula.media)}%"></div><div class="med" style="left:${pct(d.celula.mediana)}%"></div></div>
      <div class="dval">${brl(d.celula.mediana)}${i ? `<div class="muted" style="font-size:11px">+${brl(d.celula.mediana - melhor)}</div>` : ''}</div></div>`).join('')}</div>
    ${p.distribuidorasProtegidas ? `<p class="muted" style="font-size:12px;margin:8px 6px 0">${p.distribuidorasProtegidas} distribuidora(s) com poucas empresas nesta área não aparecem.</p>` : ''}
    <div class="legend"><span><i style="width:12px;height:12px;border-radius:50%;background:var(--series)"></i>Mediana</span><span><i style="width:2px;height:14px;background:var(--ink)"></i>Média</span></div>`;
}

function blocoMinha(p) {
  const m = p.minha;
  if (!m) return '<div class="empty">Sua localização aparece depois da primeira NF-e aceita.</div>';
  if (m.valor == null) return `<div class="empty">Você não tem ${PBY[S.prod].nome.toLowerCase()} aceita na semana de ${dataCurta(S.semana)}.</div>`;
  if (!m.referencia) return '<div class="empty">Sua microrregião, mesorregião e estado não tinham postos suficientes nesta semana.</div>';
  const c = m.referencia.celula, diff = m.valor - c.mediana;
  const lo = Math.min(c.mediana, c.media, m.valor) - 0.05, hi = Math.max(c.mediana, c.media, m.valor) + 0.05, pct = v => (v - lo) / (hi - lo) * 100;
  return `<div class="eyebrow">Você pagou</div><div class="pos-big num">${R(m.valor)}</div>
    <div class="delta ${diff > 0 ? 'up' : 'down'}" style="font-size:13px">${R(Math.abs(diff))} ${diff > 0 ? 'acima' : 'abaixo'} da mediana de ${esc(m.referencia.nome)}</div>
    <div class="pos-bar" aria-hidden="true"><div class="rail"></div><div class="medm avgm" style="left:${pct(c.media)}%"></div><div class="medm" style="left:${pct(c.mediana)}%"></div><div class="you" style="left:${pct(m.valor)}%"><b></b></div></div>
    <div class="legend" style="margin-top:4px"><span><i style="width:10px;height:10px;border-radius:50%;background:var(--ink)"></i>Você</span><span><i style="width:2px;height:12px;background:var(--series)"></i>Mediana</span><span><i style="width:2px;height:12px;background:var(--ink-2)"></i>Média</span></div>
    <p class="muted" style="font-size:12px;margin:10px 0 0">Comparação com ${NOME_NIVEL[m.referencia.nivel].toLowerCase()} ${esc(m.referencia.nome)}, a menor área com dados publicados em volta do seu posto.</p>`;
}

function renderExec() {
  const p = S.painel;
  const c = p.kpis.find(k => k.produto === S.prod).atual;
  return `<div class="kpis">${p.kpis.map(kpi).join('')}</div>
  <div class="grid">
    <div class="card c8"><div class="card-head"><div><h2>Evolução semanal · ${PBY[S.prod].nome}</h2><p>R$ por litro pago à distribuidora, a partir das NF-e validadas</p></div></div>${graficoTendencia(p.tendencia)}</div>
    <div class="card c4"><div class="card-head"><div><h2>Sua posição</h2><p>${PBY[S.prod].nome} · semana de ${dataCurta(S.semana)}</p></div></div>${blocoMinha(p)}</div>
    <div class="card c7"><div class="card-head"><div><h2>Comparativo de distribuidoras</h2><p>${esc(p.area.nome)} · ${PBY[S.prod].nome} · só com 5 ou mais empresas</p></div></div>${blocoDistribuidoras(p)}</div>
    <div class="card c5"><div class="card-head"><div><h2>Estatísticas da área</h2><p>${esc(p.area.nome)}${c ? ` · ${esc(c.postos)} empresas` : ''}</p></div></div>
      ${c?.aberta ? `<div class="stats5">
        <div class="stat"><div class="l">Média</div><div class="v">${brl(c.media)}</div></div>
        <div class="stat hl"><div class="l">Mediana</div><div class="v">${brl(c.mediana)}</div></div>
        <div class="stat"><div class="l">Moda</div><div class="v">${c.moda != null ? brl(c.moda, 2) : '—'}</div></div></div>
        <p class="muted" style="font-size:12px;margin:10px 0 0">R$/litro. Cada empresa entra uma vez, com a média ponderada pelo volume das cargas da semana. Moda em faixas de R$ 0,01${c.moda != null ? ` (${c.modaPostos} empresas)` : '; nenhum preço se repetiu'}. Mínima e máxima não são publicadas porque seriam o preço de uma única empresa.</p>`
      : `<div class="empty">${c ? (Number(c.postos) < 5 ? `Área fechada: ${c.postos} de 5 empresas compartilharam nesta semana.` : 'Área fechada para evitar que uma empresa seja identificada por subtração entre áreas.') : 'Nenhum envio nesta área nesta semana.'}</div>`}
    </div>
  </div>`;
}

/* ---------- explorar ---------- */
function renderExplorar() {
  const t = S.tabela;
  const [nivel] = escopo();
  const opcoes = NIVEIS.slice(NIVEIS.indexOf(nivel) + 1);
  if (!opcoes.length) return '<div class="empty">A microrregião é o menor nível publicado. Volte um nível nos filtros para comparar áreas.</div>';
  const { chave, dir } = S.ordem;
  const valor = l => chave === 'nome' ? l.nome : chave === 'postos' ? null : chave === 'delta' ? (l.celula.aberta && l.medianaAnterior != null ? l.celula.mediana - l.medianaAnterior : null) : (l.celula.aberta ? l.celula[chave] : null);
  const linhas = [...t.linhas].sort((a, b) => {
    const va = valor(a), vb = valor(b);
    if (va == null && vb == null) return a.nome.localeCompare(b.nome, 'pt-BR');
    if (va == null) return 1; if (vb == null) return -1;
    return (typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb) * dir;
  });
  const th = (k, l) => `<th data-ordem="${k}" aria-sort="${chave === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'}">${l}${chave === k ? (dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  const abertas = linhas.filter(l => l.celula.aberta).length;
  return `<div class="card-head">
      <div><h2>${PBY[S.prod].nome} por ${NOME_NIVEL[t.agrupar].toLowerCase()}</h2><p>${abertas} de ${linhas.length} com dados publicados na semana de ${dataCurta(S.semana)}. Clique numa linha para abrir a visão executiva.</p></div>
      <div class="field"><label>Agrupar por</label><div class="seg" id="grp">${opcoes.map(n => `<button data-g="${n}" aria-pressed="${t.agrupar === n}">${NOME_NIVEL[n]}</button>`).join('')}</div></div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr>${th('nome', NOME_NIVEL[t.agrupar])}<th>Empresas</th>${th('media', 'Média')}${th('mediana', 'Mediana')}${th('moda', 'Moda')}${th('delta', 'Δ semana')}</tr></thead>
      <tbody>${linhas.map(l => {
        const c = l.celula;
        if (!c.aberta) return `<tr class="lockr" data-area="${esc(l.area)}"><td class="t">${esc(l.nome)}</td><td>${esc(c.postos)}</td><td colspan="4" class="lockbadge" style="text-align:left">${Number(c.postos) < 5 ? `Faltam ${5 - Number(c.postos)} empresa(s) para liberar` : 'Protegido para evitar identificação por subtração'}</td></tr>`;
        const d = l.medianaAnterior != null ? c.mediana - l.medianaAnterior : null;
        return `<tr data-area="${esc(l.area)}"><td class="t"><b>${esc(l.nome)}</b></td><td>${esc(c.postos)}</td><td>${brl(c.media)}</td><td><b>${brl(c.mediana)}</b></td><td>${c.moda != null ? brl(c.moda, 2) : '<span class="muted">—</span>'}</td>
          <td class="${d == null || Math.abs(d) < 0.0005 ? 'muted' : d > 0 ? 'delta up' : 'delta down'}">${d == null ? '—' : Math.abs(d) < 0.0005 ? 'estável' : (d > 0 ? '▲ ' : '▼ ') + brl(Math.abs(d))}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="t muted">Nenhum envio nesta área.</td></tr>'}</tbody>
    </table></div>`;
}

function abrirArea(nivel, area) {
  if (nivel === 'regiao') Object.assign(S, { regiao: area, uf: '', meso: '', micro: '' });
  if (nivel === 'uf') Object.assign(S, { uf: area, regiao: S.geo.ufs.find(u => u.sigla === area).regiao, meso: '', micro: '' });
  if (nivel === 'meso') { const m = S.geo.mesos.find(x => x.codigo === area); Object.assign(S, { meso: area, uf: m.uf, regiao: S.geo.ufs.find(u => u.sigla === m.uf).regiao, micro: '' }); }
  if (nivel === 'micro') { const mi = S.geo.micros.find(x => x.codigo === area); const m = S.geo.mesos.find(x => x.codigo === mi.meso); Object.assign(S, { micro: area, meso: m.codigo, uf: m.uf, regiao: S.geo.ufs.find(u => u.sigla === m.uf).regiao }); }
  S.tab = 'exec';
  carregar();
}

/* ---------- envio de NF ---------- */
const ROTULO_SITUACAO = { enviado: 'NF aceita', em_revisao: 'NF em revisão', sem_compra: 'Declarado sem compra', pendente: 'Aguardando NF' };

function checklistPosto(p, varios) {
  const sem = p.semanaAberta;
  const feitos = Object.values(sem.produtos).filter(s => s !== 'pendente').length;
  return `<div class="card">
    <div class="card-head"><div><h2>${varios ? esc(p.razaoSocial) : `Semana de ${dataCurta(sem.semana)}`}</h2><p>${varios ? `CNPJ ${esc(cnpjFmt(p.cnpj))} · ` : ''}${feitos} de 4 produtos informados.</p></div>
      <span class="pill ${sem.completa ? 'ok' : 'lock'}"><span class="dot"></span>${sem.completa ? 'Semana completa' : 'Semana incompleta'}</span></div>
    <div class="check">${PRODUTOS.map(pr => {
      const s = sem.produtos[pr.id];
      const cls = s === 'sem_compra' ? 'skip' : s === 'pendente' ? '' : 'done';
      return `<div class="chk ${cls}"><span class="ic">${s === 'sem_compra' ? '–' : s === 'pendente' ? '' : '✓'}</span>
        <div><b>${pr.nome}</b><div class="muted" style="font-size:12px">${ROTULO_SITUACAO[s]}</div></div>
        ${s === 'pendente' || s === 'sem_compra' ? `<label><input type="checkbox" id="sc-${p.postoId}-${pr.id}" data-sem-compra="${pr.id}" data-posto="${p.postoId}" ${s === 'sem_compra' ? 'checked' : ''}> Não comprei</label>` : ''}</div>`;
    }).join('')}</div>
  </div>`;
}

const cnpjFmt = c => String(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

function renderNF() {
  const postos = S.eu.postos, sem = postos[0].semanaAberta;
  const prazo = new Date(sem.prazo).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' (Brasília)';
  const r = S.nf;
  let resultado = '';
  if (r?.erro) resultado = `<div class="card"><h3>Não foi possível usar este arquivo</h3><p class="ink2" style="margin:6px 0 0">${esc(r.erro)}</p></div>`;
  else if (r) {
    const pill = { aceita: ['ok', 'Aceita'], em_revisao: ['rev', 'Em revisão'], recusada: ['no', 'Recusada'] }[r.status];
    const icone = { ok: ['ok', '✓'], info: ['inf', 'i'], revisao: ['inf', '!'], recusa: ['no', '✕'] };
    resultado = `<div class="card">
      <div class="card-head"><div><h2>NF-e ${esc(r.nota.numero)}</h2><p>${esc(r.nota.emitente.nome)} · ${esc(r.nota.emitente.cnpj)} → ${esc(r.nota.destinatario.nome)}</p></div><span class="pill ${pill[0]}"><span class="dot"></span>${pill[1]}</span></div>
      <ul class="vlist">${r.verificacoes.map(v => `<li><span class="${icone[v.gravidade][0]}">${icone[v.gravidade][1]}</span><span>${esc(v.texto)}</span></li>`).join('')}</ul>
      <div class="tbl-wrap" style="margin-top:14px"><table class="items"><thead><tr><th>Item</th><th>Código ANP</th><th>No painel</th><th>CFOP</th><th>Litros</th><th>R$/litro</th></tr></thead>
      <tbody>${r.itens.map(i => `<tr><td class="t">${esc(i.descricao)}</td><td class="t">${esc(i.codigoAnp || '—')}</td><td class="t">${i.produto ? PBY[i.produto].nome : '<span class="muted">não entra</span>'}</td><td>${esc(i.cfop)}</td><td>${Number(i.litros).toLocaleString('pt-BR')}</td><td><b>${brl(i.precoLitro, 4)}</b></td></tr>`).join('')}</tbody></table></div>
      ${r.status === 'em_revisao' ? '<p class="muted" style="font-size:12px;margin:10px 0 0">Notas em revisão contam para liberar o seu painel, mas só entram nas estatísticas depois de aprovadas.</p>' : ''}
    </div>`;
  }
  const hist = S.historico?.nfes ?? [];
  return `<p class="scope" style="margin:0 0 14px">Semana de compra de ${dataCurta(sem.semana)} · prazo de envio: ${esc(prazo)}. "Não comprei" vale por até 2 semanas seguidas para cada produto.</p>
  <div class="grid">
    <div class="c5" style="display:flex;flex-direction:column;gap:14px;min-width:0">${postos.map(p => checklistPosto(p, postos.length > 1)).join('')}</div>
    <div class="c7" style="display:flex;flex-direction:column;gap:14px;min-width:0">
      <div class="card"><div class="drop" id="drop">
        <h2>Envie o XML da NF-e de compra</h2>
        <p class="ink2" style="margin:0;max-width:52ch">O XML chega no e-mail da distribuidora ou fica no portal dela. Conferimos a assinatura digital, o CNPJ do posto, a data e o preço por litro de cada produto.${postos.length > 1 ? ' Cada nota vai para o posto do CNPJ destinatário.' : ''}</p>
        <div class="btns">
          <label class="btn" for="nf-arquivo">Escolher arquivos .xml</label>
          <input type="file" id="nf-arquivo" accept=".xml,text/xml,application/xml" multiple hidden>
          ${S.eu.demo ? '<button class="btn ghost" data-exemplo="1">NF de exemplo: gasolina + etanol</button><button class="btn ghost" data-exemplo="2">NF de exemplo: diesel</button>' : ''}
        </div>
        <p class="muted" style="font-size:12px;margin:0">Pode arrastar vários arquivos de uma vez.${S.eu.demo ? ' As notas de exemplo são assinadas com um certificado de teste.' : ''}</p>
      </div></div>
      ${resultado}
      ${hist.length ? `<div class="card"><h3 style="margin-bottom:10px">Notas enviadas</h3><div class="tbl-wrap"><table class="items hist"><thead><tr><th>Enviada</th><th>Distribuidora</th><th>Semana</th><th>Situação</th></tr></thead>
        <tbody>${hist.slice(0, 12).map(n => `<tr><td class="t">${new Date(n.enviada_em).toLocaleDateString('pt-BR')}</td><td class="t">${esc(n.emitente_nome)}</td><td>${dataCurta(n.semana)}</td><td class="t">${{ aceita: 'Aceita', em_revisao: 'Em revisão', recusada: 'Recusada' }[n.status]}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    </div>
  </div>`;
}

async function enviarXml(xml) {
  try {
    S.nf = await api('/api/nfes', { method: 'POST', headers: { 'content-type': 'application/xml' }, body: xml });
    toast(S.nf.status === 'aceita' ? 'Nota aceita.' : 'Nota enviada para revisão.');
  } catch (e) {
    S.nf = e.corpo?.verificacoes ? e.corpo : { erro: e.message };
  }
}

async function enviarArquivos(arquivos) {
  for (const f of arquivos) await enviarXml(await f.text());
  await atualizarConta();
  carregar();
}

/* ---------- conta ---------- */
function renderConta() {
  const postos = S.eu.postos;
  const tokens = S.tokens?.tokens ?? [];
  const novo = S.tokenNovo;
  const origem = location.origin;
  return `<div class="grid">
    <div class="card c7">
      <div class="card-head"><div><h2>Postos da conta</h2><p>Uma rede pode cadastrar todos os CNPJs. Para o mínimo de 5, a rede conta como uma empresa.</p></div></div>
      <div class="tbl-wrap"><table class="items"><thead><tr><th>Posto</th><th>CNPJ</th><th>Microrregião</th><th>Semana atual</th><th>Acesso</th></tr></thead>
        <tbody>${postos.map(p => `<tr><td class="t">${esc(p.razaoSocial)}</td><td class="t num">${esc(cnpjFmt(p.cnpj))}</td><td class="t">${esc(p.microNome ?? 'definida na 1ª NF')}</td>
          <td class="t">${p.semanaAberta.completa ? 'Completa' : 'Incompleta'}</td><td class="t">${p.assinatura === 'teste' ? `Teste até ${p.testeAte ? dataLonga(p.testeAte) : '—'}` : esc(p.assinatura)}</td></tr>`).join('')}</tbody></table></div>
      <form id="f-posto" class="filters" style="margin:14px 0 0" novalidate>
        <div class="field"><label for="np-cnpj">CNPJ</label><input type="text" id="np-cnpj" inputmode="numeric" placeholder="00.000.000/0000-00"></div>
        <div class="field" style="flex:1;min-width:180px"><label for="np-razao">Razão social</label><input type="text" id="np-razao"></div>
        <button class="btn" type="submit">Adicionar posto</button>
      </form>
    </div>
    <div class="card c5">
      <div class="card-head"><div><h2>Integração com o seu sistema</h2><p>Para o ERP enviar as notas e ler os preços sem abrir o navegador.</p></div></div>
      ${novo ? `<div class="aviso" style="margin:0 0 12px"><b>Copie a chave agora: ela não aparece de novo.</b><br><code class="num" style="overflow-wrap:anywhere;user-select:all">${esc(novo)}</code></div>` : ''}
      ${tokens.length ? `<ul class="vlist" style="margin-bottom:12px">${tokens.map(t => `<li><span class="ok">●</span><span>${esc(t.nome)} <span class="muted num">${esc(t.prefixo)}…</span> · ${t.usado_em ? 'usada em ' + new Date(t.usado_em).toLocaleDateString('pt-BR') : 'nunca usada'} <button class="sair" data-revogar="${t.id}">revogar</button></span></li>`).join('')}</ul>` : '<p class="muted" style="margin:0 0 12px">Nenhuma chave criada.</p>'}
      <form id="f-token" class="filters" style="margin:0" novalidate>
        <div class="field" style="flex:1"><label for="tk-nome">Nome da chave</label><input type="text" id="tk-nome" placeholder="ERP do posto"></div>
        <button class="btn" type="submit">Criar chave de API</button>
      </form>
      <details style="margin-top:14px"><summary class="ink2" style="cursor:pointer">Como usar</summary>
        <pre class="num" style="white-space:pre-wrap;font-size:12px;background:var(--bg);padding:10px;border-radius:6px;overflow-x:auto">Enviar uma NF-e:
curl -X POST ${esc(origem)}/api/nfes \\
  -H "Authorization: Bearer SUA_CHAVE" \\
  -H "Content-Type: application/xml" \\
  --data-binary @nota.xml

Ler o painel da sua microrregião:
curl "${esc(origem)}/api/painel?semana=AAAA-MM-DD&amp;produto=gc&amp;nivel=micro&amp;area=CODIGO" \\
  -H "Authorization: Bearer SUA_CHAVE"</pre>
        <p class="muted" style="font-size:12px">Produtos: gc, et, s10, s500. Níveis: brasil, regiao, uf, meso, micro. Semanas publicadas em /api/semanas.</p>
      </details>
    </div>
    ${S.eu.usuario.admin ? '<div class="card c12"><h2>Administração</h2><p class="ink2" style="margin:6px 0 10px">Participantes, notas em revisão e senhas provisórias.</p><a class="btn" href="/admin.html">Abrir administração</a></div>' : ''}
  </div>`;
}

/* ---------- regras ---------- */
function renderRegras() {
  return `<div class="prose">
    <h2 style="margin-top:0">Como os preços são publicados</h2>
    <div class="rules">
      <div class="card"><h3>Mínimo de 5 empresas</h3><p>Um preço só aparece quando 5 ou mais empresas diferentes (raiz do CNPJ) compartilharam naquela área, produto e semana. Uma rede com vários postos conta como uma.</p></div>
      <div class="card"><h3>Sem preço individual</h3><p>Publicamos média, mediana e moda. Mínima e máxima não aparecem porque seriam o preço pago por uma única empresa.</p></div>
      <div class="card"><h3>Sem cidade</h3><p>A menor área é a microrregião do IBGE. Comparativo de distribuidoras só por estado, região e Brasil.</p></div>
    </div>
    <h2>Proteção contra subtração</h2>
    <p>Se uma mesorregião aparece com 8 empresas e uma das microrregiões dela com 6, daria para calcular as outras 2 por diferença. Nesses casos o sistema fecha mais uma área até o que sobra ter 0 ou pelo menos 5 empresas. Por isso algumas áreas aparecem como protegidas. A quantidade de empresas das áreas abertas aparece em faixas (5 a 9, 10 a 19…), pelo mesmo motivo. A semana é publicada uma única vez, depois do prazo, para ninguém comparar o número antes e depois de um novo envio.</p>
    <h2>Envio semanal</h2>
    <ul>
      <li>A semana vai de segunda a domingo. As notas podem ser enviadas até terça-feira, 23h59, da semana seguinte.</li>
      <li>Para ver o painel, todos os postos da conta precisam ter completado a semana publicada mais recente ou a semana em aberto.</li>
      <li>Cada empresa entra uma vez por semana em cada produto, com a média das cargas ponderada pelo volume.</li>
    </ul>
    <h2>Validação da nota</h2>
    <ul>
      <li>Assinatura digital da distribuidora: se o preço for alterado no XML, a assinatura deixa de conferir e a nota é recusada.</li>
      <li>Destinatário igual ao CNPJ do posto, data dentro da semana, CFOP de revenda e código ANP do produto.</li>
      <li>Preço muito diferente da mediana da região vai para revisão manual antes de entrar nas estatísticas.</li>
    </ul>
  </div>`;
}

/* ---------- carregamento ---------- */
async function atualizarConta() { S.eu = await api('/api/eu'); }

async function carregar() {
  for (const k in TIPS) delete TIPS[k];
  if (!S.eu.postos.length) {
    document.getElementById('me').innerHTML = `<span class="ink2">${esc(S.eu.usuario.email)}</span><button class="sair" id="sair">Sair</button>`;
    document.getElementById('sair').onclick = async () => { await api('/api/sair', { method: 'POST' }); telaEntrada(); };
    $app.innerHTML = `<div class="empty" style="margin-top:20px;flex-direction:column;gap:12px">Esta conta não tem posto cadastrado.${S.eu.usuario.admin ? '<a class="btn" href="/admin.html">Abrir administração</a>' : ''}</div>`;
    return;
  }
  renderTopo();
  if (S.tab === 'conta') {
    S.tokens = await api('/api/tokens').catch(() => null);
    $app.innerHTML = renderConta();
    return;
  }
  if (S.tab === 'nf') {
    S.historico = await api('/api/nfes').catch(() => null);
    $app.innerHTML = renderNF();
    return;
  }
  if (S.tab === 'how') { $app.innerHTML = renderRegras(); return; }
  if (!S.eu.liberado) { $app.innerHTML = htmlBloqueio(); return; }
  if (!S.semanas.publicadas.length) {
    $app.innerHTML = '<div class="empty" style="margin-top:20px">Ainda não há semana publicada. A primeira sai na quarta-feira seguinte ao fechamento da semana de envio.</div>';
    return;
  }
  const [nivel, area] = escopo();
  const q = new URLSearchParams({ semana: S.semana, produto: S.prod, nivel, area });
  try {
    S.painel = await api('/api/painel?' + q);
    if (S.tab === 'explore') {
      const opcoes = NIVEIS.slice(NIVEIS.indexOf(nivel) + 1);
      if (opcoes.length && !opcoes.includes(S.agrupar)) S.agrupar = opcoes[0];
      S.tabela = opcoes.length ? await api('/api/tabela?' + new URLSearchParams({ semana: S.semana, produto: S.prod, nivel, area, agrupar: S.agrupar })) : { linhas: [] };
    }
  } catch (e) {
    if (e.status === 403) { await atualizarConta(); renderTopo(); $app.innerHTML = htmlBloqueio(); return; }
    $app.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    return;
  }
  $app.innerHTML = htmlFiltros() + (S.tab === 'exec' ? renderExec() : renderExplorar());
  ligarFiltros($app);
}

$app.addEventListener('click', async e => {
  const go = e.target.closest('[data-goto]'); if (go) { S.tab = go.dataset.goto; carregar(); return; }
  const k = e.target.closest('.kpi[data-prod]'); if (k) { S.prod = k.dataset.prod; carregar(); return; }
  const w = e.target.closest('[data-semana]'); if (w) { S.semana = w.dataset.semana; carregar(); return; }
  const g = e.target.closest('[data-g]'); if (g) { S.agrupar = g.dataset.g; carregar(); return; }
  const th = e.target.closest('th[data-ordem]');
  if (th) { const c = th.dataset.ordem; S.ordem = S.ordem.chave === c ? { chave: c, dir: -S.ordem.dir } : { chave: c, dir: 1 }; $app.innerHTML = htmlFiltros() + renderExplorar(); ligarFiltros($app); return; }
  const tr = e.target.closest('tr[data-area]'); if (tr && S.tab === 'explore') { abrirArea(S.tabela.agrupar, tr.dataset.area); return; }
  const rv = e.target.closest('[data-revogar]');
  if (rv) { await api('/api/tokens/' + rv.dataset.revogar, { method: 'DELETE' }); S.tokenNovo = null; carregar(); return; }
  const ex = e.target.closest('[data-exemplo]');
  if (ex) {
    ex.disabled = true;
    try { await enviarXml(await api('/api/demo/nfe-exemplo?n=' + ex.dataset.exemplo)); } catch (err) { S.nf = { erro: err.message }; }
    await atualizarConta(); carregar();
  }
});
$app.addEventListener('change', async e => {
  if (e.target.id === 'nf-arquivo' && e.target.files.length) { await enviarArquivos([...e.target.files]); return; }
  const sc = e.target.dataset?.semCompra;
  if (sc) {
    try { await api('/api/sem-compra?posto=' + e.target.dataset.posto, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ produto: sc, marcado: e.target.checked }) }); }
    catch (err) { toast(err.message); }
    await atualizarConta(); carregar();
  }
});
$app.addEventListener('submit', async e => {
  if (e.target.id !== 'f-posto' && e.target.id !== 'f-token') return; // o formulário de entrada tem o próprio tratamento
  e.preventDefault();
  const v = id => document.getElementById(id)?.value ?? '';
  try {
    if (e.target.id === 'f-posto') {
      await api('/api/postos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cnpj: v('np-cnpj'), razaoSocial: v('np-razao') }) });
      toast('Posto adicionado.');
      await atualizarConta();
    }
    if (e.target.id === 'f-token') {
      S.tokenNovo = (await api('/api/tokens', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: v('tk-nome') }) })).token;
    }
    carregar();
  } catch (err) { toast(err.message); }
});
['dragover', 'dragleave', 'drop'].forEach(ev => $app.addEventListener(ev, e => {
  const d = e.target.closest?.('#drop'); if (!d) return;
  e.preventDefault();
  d.classList.toggle('over', ev === 'dragover');
  if (ev === 'drop' && e.dataTransfer.files.length) enviarArquivos([...e.dataTransfer.files]);
}));
document.getElementById('tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  S.tab = b.dataset.tab; S.nf = null; S.tokenNovo = null; carregar();
});

async function iniciar() {
  CONVITE = (await api('/api/config-publica').catch(() => ({}))).convite ?? false;
  try { await atualizarConta(); } catch (e) { if (e.status === 401) return telaEntrada(); throw e; }
  document.getElementById('topo').hidden = false;
  [S.geo, S.semanas] = await Promise.all([api('/api/geo'), api('/api/semanas')]);
  S.semana = S.semanas.publicadas[0]?.semana ?? '';
  carregar();
}
iniciar();
