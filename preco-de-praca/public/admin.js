// Administração do piloto: participantes, notas em revisão, distribuidoras e senhas provisórias.

const $ = document.getElementById('adm');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cnpjFmt = c => String(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const brl = (v, d = 4) => v == null ? '—' : Number(v).toFixed(d).replace('.', ',');
const data = s => s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('pt-BR') : '—';
const PRODUTO = { gc: 'Gasolina C', et: 'Etanol', s10: 'Diesel S10', s500: 'Diesel S500' };
let senhaGerada = null;

async function api(caminho, op = {}) {
  const r = await fetch(caminho, { credentials: 'same-origin', ...op });
  const corpo = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text();
  if (!r.ok) { const e = new Error(corpo?.erro || 'Algo deu errado.'); e.status = r.status; throw e; }
  return corpo;
}
const post = (caminho, corpo) => api(caminho, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });

async function carregar() {
  let p, rev, dist;
  try {
    [p, rev, dist] = await Promise.all([api('/api/admin/postos'), api('/api/admin/revisao'), api('/api/admin/distribuidoras')]);
  } catch (e) {
    $.innerHTML = `<div class="empty" style="margin-top:20px">${e.status === 401 ? 'Entre com uma conta de administração na <a href="/">página inicial</a>.' : esc(e.message)}</div>`;
    return;
  }
  const completos = p.postos.filter(x => x.semanaAberta.completa).length;
  $.innerHTML = `
  ${senhaGerada ? `<div class="aviso" style="margin:16px 0 0">Senha provisória de <b>${esc(senhaGerada.email)}</b>: <code class="num" style="user-select:all">${esc(senhaGerada.senha)}</code>. Passe ao cliente; ela não aparece de novo.</div>` : ''}
  <div class="kpis" style="margin-top:16px">
    <div class="kpi"><span class="eyebrow">Postos cadastrados</span><span class="v">${p.postos.length}</span></div>
    <div class="kpi"><span class="eyebrow">Semana em aberto completa</span><span class="v">${completos}</span><span class="foot">de ${p.postos.length} postos</span></div>
    <div class="kpi"><span class="eyebrow">Notas em revisão</span><span class="v">${rev.nfes.length}</span></div>
    <div class="kpi"><span class="eyebrow">Última semana publicada</span><span class="v" style="font-size:20px">${p.semanas[0] ? data(p.semanas[0].semana) : '—'}</span><span class="foot">${p.semanas[0] ? p.semanas[0].postos + ' empresas' : 'nenhuma ainda'}</span></div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head"><div><h2>Notas em revisão</h2><p>Só entram nas estatísticas depois de aceitas. Semanas já publicadas não mudam.</p></div></div>
    ${rev.nfes.length ? `<div class="tbl-wrap"><table class="items"><thead><tr><th>Posto</th><th>Distribuidora</th><th>Semana</th><th>Itens</th><th>Motivo</th><th></th></tr></thead><tbody>
      ${rev.nfes.map(n => `<tr><td class="t">${esc(n.razao_social)}<div class="muted num">${esc(cnpjFmt(n.cnpj))}</div></td><td class="t">${esc(n.emitente_nome)}</td><td>${data(n.semana)}</td>
        <td class="t">${(n.itens || []).map(i => `${PRODUTO[i.produto]}: R$ ${brl(i.precoLitro)}`).join('<br>')}</td>
        <td class="t" style="white-space:normal;min-width:220px">${(n.motivos || []).map(m => esc(m.texto)).join('<br>')}</td>
        <td class="t"><button class="btn" data-decidir="${n.id}" data-status="aceita">Aceitar</button> <button class="btn ghost" data-decidir="${n.id}" data-status="recusada">Recusar</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted" style="margin:0">Nenhuma nota aguardando revisão.</p>'}
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-head"><div><h2>Participantes</h2><p>Situação de cada posto na semana em aberto e acesso ao painel.</p></div></div>
    <div class="tbl-wrap"><table class="items"><thead><tr><th>Usuário</th><th>Posto</th><th>Microrregião</th><th>Semana em aberto</th><th>Painel</th><th>Acesso</th><th></th></tr></thead><tbody>
      ${p.postos.map(x => `<tr><td class="t">${esc(x.usuario.nome)}<div class="muted">${esc(x.usuario.email)}</div></td>
        <td class="t">${esc(x.razaoSocial)}<div class="muted num">${esc(cnpjFmt(x.cnpj))}</div></td>
        <td class="t">${esc(x.micro ?? 'sem NF ainda')}</td>
        <td class="t">${Object.entries(x.semanaAberta.produtos).map(([k, v]) => `${PRODUTO[k]}: ${{ enviado: '✓', em_revisao: 'revisão', sem_compra: 'não comprou', pendente: '—' }[v]}`).join('<br>')}</td>
        <td class="t">${x.liberado ? 'Liberado' : x.motivo === 'assinatura' ? 'Acesso vencido' : 'Bloqueado (NF)'}</td>
        <td class="t"><select data-assinatura="${x.postoId}" aria-label="Acesso de ${esc(x.razaoSocial)}">${['teste', 'ativa', 'inadimplente', 'cancelada'].map(a => `<option ${a === x.assinatura ? 'selected' : ''}>${a}</option>`).join('')}</select>
          <div class="muted">${x.assinatura === 'teste' ? 'até ' + data(x.testeAte) : ''}</div></td>
        <td class="t"><button class="sair" data-senha="${x.usuario.id}" data-email="${esc(x.usuario.email)}">Gerar senha provisória</button></td></tr>`).join('')}
    </tbody></table></div>
  </div>

  <div class="card" style="margin-bottom:24px">
    <div class="card-head"><div><h2>Distribuidoras</h2><p>Criadas automaticamente pela raiz do CNPJ do emitente. Ajuste o nome que aparece no comparativo.</p></div></div>
    <div class="tbl-wrap"><table class="items"><thead><tr><th>Raiz do CNPJ</th><th>Nome no painel</th><th></th></tr></thead><tbody>
      ${dist.distribuidoras.map(d => `<tr><td class="t num">${esc(d.cnpj_raiz)}</td><td class="t"><input type="text" id="dist-${d.id}" value="${esc(d.nome)}" style="width:100%;min-width:220px"></td>
        <td class="t"><button class="btn ${d.revisada ? 'ghost' : ''}" data-dist="${d.id}">${d.revisada ? 'Salvar' : 'Confirmar'}</button></td></tr>`).join('') || '<tr><td colspan="3" class="t muted">Nenhuma ainda.</td></tr>'}
    </tbody></table></div>
  </div>`;
}

$.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.decidir) await post(`/api/admin/nfes/${b.dataset.decidir}`, { status: b.dataset.status });
    if (b.dataset.dist) await post(`/api/admin/distribuidoras/${b.dataset.dist}`, { nome: document.getElementById('dist-' + b.dataset.dist).value });
    if (b.dataset.senha) senhaGerada = { email: b.dataset.email, senha: (await post(`/api/admin/usuarios/${b.dataset.senha}/senha`, {})).senha };
    carregar();
  } catch (err) { alertar(err.message); }
});
$.addEventListener('change', async e => {
  const id = e.target.dataset.assinatura; if (!id) return;
  try { await post(`/api/admin/postos/${id}/assinatura`, { assinatura: e.target.value }); carregar(); } catch (err) { alertar(err.message); }
});
function alertar(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3400); }

carregar();
