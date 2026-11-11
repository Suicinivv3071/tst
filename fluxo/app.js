'use strict';
/* Fluxo — app financeiro (PWA, dados salvos no próprio aparelho) */

/* ===== utilidades ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = n => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const sum = a => a.reduce((s, x) => s + x, 0);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const curYm = () => today().slice(0, 7);
const ymIdx = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + m - 1; };
const addMonths = (ym, n) => { const i = ymIdx(ym) + n; return `${Math.floor(i / 12)}-${pad(i % 12 + 1)}`; };
const ymDate = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1); };
const ymLabel = ym => ymDate(ym).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
const ymShort = ym => ymDate(ym).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + ym.slice(2, 4);
const parseMoney = v => {
  const s = String(v || '').trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const dayLabel = iso => {
  if (iso === today()) return 'Hoje';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`) return 'Ontem';
  const [yy, m, d] = iso.split('-').map(Number);
  return new Date(yy, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
};

/* ===== dados ===== */
const KEY = 'fluxo.v1';
const empty = () => ({ tx: [], cards: [], goals: [], debts: [] });
const load = () => {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return { ...empty(), ...d }; } catch { /* ignora */ }
  return empty();
};
const state = { tab: 'home', ym: curYm(), cardId: null, data: load() };
const D = () => state.data;
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state.data)); } catch { toast('Não foi possível salvar neste navegador'); } };

const CATS_OUT = [['Moradia', '🏠'], ['Mercado', '🛒'], ['Comida', '🍔'], ['Transporte', '🚗'], ['Lazer', '🎉'], ['Saúde', '💊'], ['Educação', '📚'], ['Assinaturas', '📺'], ['Compras', '🛍️'], ['Metas', '🎯'], ['Outros', '✨']];
const CATS_IN = [['Salário', '💼'], ['Freela', '💻'], ['Investimentos', '📈'], ['Presente', '🎁'], ['Resgate', '🎯'], ['Outros', '✨']];
const CAT_COLORS = ['#3ef2c1', '#7c5cff', '#ff6b81', '#ffc15e', '#4cc9f0', '#f72585', '#90be6d', '#b5838d', '#ff9f1c', '#9d4edd', '#8b91b3'];
const catIcon = (t, name) => ([...(t === 'in' ? CATS_IN : CATS_OUT)].find(c => c[0] === name) || [0, '✨'])[1];
const catColor = name => CAT_COLORS[Math.max(0, CATS_OUT.findIndex(c => c[0] === name))];

/* ===== cálculos ===== */
const monthTx = ym => D().tx.filter(t => t.date.startsWith(ym));
const installmentsOf = ym => D().debts.flatMap(d => {
  const i = ymIdx(ym) - ymIdx(d.start);
  return i >= 0 && i < d.n ? [{ d, i, paid: !!d.paid[i] }] : [];
});
function monthStats(ym) {
  const tx = monthTx(ym);
  const income = sum(tx.filter(t => t.type === 'in').map(t => t.amount));
  const expense = sum(tx.filter(t => t.type === 'out').map(t => t.amount));
  const inst = installmentsOf(ym);
  const instTotal = sum(inst.map(x => x.d.value));
  const instPending = sum(inst.filter(x => !x.paid).map(x => x.d.value));
  return { tx, income, expense, inst, instTotal, instPending, free: income - expense - instTotal };
}
const cardSpend = (cardId, ym) => {
  const tx = monthTx(ym).filter(t => t.type === 'out' && t.cardId === cardId);
  const inst = installmentsOf(ym).filter(x => x.d.cardId === cardId);
  return { tx, inst, total: sum(tx.map(t => t.amount)) + sum(inst.map(x => x.d.value)) };
};

/* ===== ícones ===== */
const I = {
  home: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M5 13c2-1.6 3.6 1.4 7 0s5 .8 7-.4"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h3"/></svg>',
  goal: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/></svg>',
  debt: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h3"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  wifi: '<svg viewBox="0 0 24 24"><path d="M8 8.5a5.5 5.5 0 0 1 0 7M11.5 6a9 9 0 0 1 0 12M15 3.5a12.5 12.5 0 0 1 0 17"/></svg>',
};

/* ===== cartão fictício ===== */
const BRANDS = [
  [/nubank|^nu$|nu bank/, '#9b30d9', '#4a0e80'], [/ita[uú]/, '#ff8a00', '#0b2f73'], [/bradesco/, '#e4002b', '#7a0019'],
  [/santander/, '#ec0000', '#8c0000'], [/c6/, '#2b2b2b', '#0c0c0c'], [/inter/, '#ff7a00', '#c24a00'],
  [/banco do brasil|^bb$/, '#f9dd16', '#1f4fa3', '#10213f'], [/caixa/, '#005ca9', '#f7931e'], [/pic ?pay/, '#21c25e', '#0b7a35'],
  [/mercado ?pago/, '#00b1ea', '#0a4fa8'], [/next/, '#00e676', '#0b6b3a', '#06210f'], [/neon/, '#00d4ff', '#0a3d6b'],
  [/xp/, '#222', '#a98600'], [/btg/, '#0b2a4a', '#154a7d'], [/sicredi/, '#4cae4f', '#11602a'], [/will/, '#ffd400', '#e6a800', '#2b2200'],
  [/mastercard|master/, '#eb001b', '#f79e1b'], [/visa/, '#1a1f71', '#2d3aa8'], [/elo/, '#111', '#4a4a4a'], [/amex|american/, '#2e77bb', '#0b3d6b'],
];
function brandColors(name) {
  const n = name.toLowerCase().trim();
  const b = BRANDS.find(b => b[0].test(n));
  if (b) return { c1: b[1], c2: b[2], fg: b[3] || '#fff' };
  const h = hash(n) % 360;
  return { c1: `hsl(${h} 70% 48%)`, c2: `hsl(${(h + 50) % 360} 70% 22%)`, fg: '#fff' };
}
function cardFace(name, id = name, cls = '', attrs = '') {
  const { c1, c2, fg } = brandColors(name || 'cartão');
  const last4 = String(1000 + (Math.imul(hash(id || 'x'), 2654435761) >>> 0) % 9000);
  return `<div class="ccard ${cls}" ${attrs} style="--c1:${c1};--c2:${c2};--fg:${fg}">
    <div class="c-top"><span class="c-brand">${esc(name || 'Seu cartão')}</span>${I.wifi}</div>
    <div class="c-chip"></div>
    <div class="c-num">•••• •••• •••• ${last4}</div>
    <div class="c-bot"><span>SEU NOME</span><span class="c-flag"><i></i><i></i></span></div></div>`;
}

/* ===== sheet e toast ===== */
let toastTimer;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-action="undo">Desfazer</button>' : ''}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), undo ? 5000 : 2600);
  toast.undo = undo;
}
function openSheet(title, html, onSubmit, init) {
  const el = $('#sheet');
  el.innerHTML = `<div class="sheet-bg" data-action="close"></div><form class="sheet-card" novalidate><div class="grab"></div><h2>${title}</h2>${html}</form>`;
  el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
  const form = $('form', el);
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (onSubmit(form, new FormData(form)) === false) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }
    closeSheet();
  });
  init?.(form);
  const first = $('[autofocus]', form); if (first && matchMedia('(hover:hover)').matches) first.focus();
}
function closeSheet() { const el = $('#sheet'); el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); el.innerHTML = ''; }

/* ===== telas ===== */
const monthNav = () => `<div class="monthnav"><button data-action="prev" aria-label="Mês anterior">‹</button><span>${ymLabel(state.ym)}</span><button data-action="next" aria-label="Próximo mês">›</button></div>`;

function viewHome() {
  const s = monthStats(state.ym);
  const isNow = state.ym === curYm();
  const fill = s.income > 0 ? Math.max(0, Math.min(1, s.free / s.income)) : 0;
  const low = s.free < 0 || (s.income > 0 && fill < .15);
  let sub = s.income > 0 ? `${Math.round(fill * 100)}% da renda` : 'registre um ganho';
  let pill = '';
  if (isNow && s.income > 0) {
    const dim = new Date(+state.ym.slice(0, 4), +state.ym.slice(5), 0).getDate();
    const left = dim - new Date().getDate() + 1;
    pill = s.free > 0
      ? `<div class="pill">Hoje você pode gastar <b>${brl(s.free / left)}</b></div>`
      : `<div class="pill neg">Mês no limite — segure os gastos</div>`;
  }
  const byCat = {};
  s.tx.filter(t => t.type === 'out').forEach(t => byCat[t.category] = (byCat[t.category] || 0) + t.amount);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const totalOut = sum(cats.map(c => c[1]));
  const catBlock = cats.length ? `<div class="panel"><h3>Para onde foi</h3>
    <div class="stack">${cats.map(([c, v]) => `<i style="width:${v / totalOut * 100}%;background:${catColor(c)}" title="${esc(c)}"></i>`).join('')}</div>
    <div class="legend">${cats.slice(0, 6).map(([c, v]) => `<div><span><i style="background:${catColor(c)}"></i>${esc(c)}</span><b>${brl(v)}</b></div>`).join('')}</div></div>` : '';

  const days = {};
  [...s.tx].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).forEach(t => (days[t.date] ||= []).push(t));
  const list = Object.keys(days).length ? Object.entries(days).map(([d, arr]) => `<div class="day">${dayLabel(d)}</div>` + arr.map(t => {
    const card = t.cardId && D().cards.find(c => c.id === t.cardId);
    return `<div class="item"><div class="ic">${catIcon(t.type, t.category)}</div>
      <div class="mid"><b>${esc(t.desc || t.category)}</b><small>${esc(t.category)}${card ? ' · ' + esc(card.provider) : ''}</small></div>
      <div class="val ${t.type === 'in' ? 'pos' : ''}">${t.type === 'in' ? '+' : '−'} ${brl(t.amount)}</div>
      <button class="x" data-action="del-tx" data-id="${t.id}" aria-label="Remover">✕</button></div>`;
  }).join('')).join('') : `<div class="empty"><b>Nada por aqui ainda</b>Toque no + para registrar seu primeiro ganho ou gasto.
      ${D().tx.length + D().cards.length + D().goals.length + D().debts.length === 0 ? '<br><button class="btn small" data-action="demo">Ver com dados de exemplo</button>' : ''}</div>`;

  return `<div class="top"><div><p class="eyebrow">Seu mês em fluxo</p><h1>Início</h1></div>
      <div class="row">${monthNav()}<button class="iconbtn" data-action="settings" aria-label="Ajustes">${I.gear}</button></div></div>
    <div class="home-grid">
      <section class="hero">
        <div class="orb ${low ? 'low' : ''}" style="--fill:${fill}"><div class="wave w2"></div><div class="wave w1"></div>
          <div class="orb-in"><small>Livre no mês</small><strong>${brl(s.free)}</strong><span>${sub}</span></div></div>
        ${pill}
        <div class="trio">
          <div class="stat"><small>Ganhos</small><b class="pos">${brl(s.income)}</b></div>
          <div class="stat"><small>Gastos</small><b class="neg">${brl(s.expense)}</b></div>
          <div class="stat"><small>Parcelas</small><b>${brl(s.instTotal)}</b></div>
        </div>
      </section>
      <section>${catBlock}<div class="panel"><h3>Lançamentos</h3>${list}</div></section>
    </div>
    <button class="fab" data-action="add-tx" aria-label="Novo lançamento">${I.plus}</button>`;
}

function viewCards() {
  const { cards } = D();
  if (!cards.some(c => c.id === state.cardId)) state.cardId = cards[0]?.id || null;
  const head = `<div class="top"><div><p class="eyebrow">Seus cartões</p><h1>Cartões</h1></div><div class="row">${monthNav()}</div></div>`;
  if (!cards.length) return head + `<div class="panel empty"><b>Nenhum cartão ainda</b>Adicione só o nome do banco ou bandeira — a gente cria o cartão pra você.
    <br><button class="btn primary" data-action="add-card">Adicionar cartão</button></div>`;
  const card = cards.find(c => c.id === state.cardId);
  const sp = cardSpend(card.id, state.ym);
  const byCat = {};
  sp.tx.forEach(t => byCat[t.category] = (byCat[t.category] || 0) + t.amount);
  if (sp.inst.length) byCat['Parcelas'] = sum(sp.inst.map(x => x.d.value));
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats[0]?.[1] || 1;
  const rows = [
    ...sp.tx.map(t => ({ date: t.date, ic: catIcon('out', t.category), name: t.desc || t.category, sub: t.category, v: t.amount, id: t.id })),
    ...sp.inst.map(x => ({ date: `${state.ym}-00`, ic: '🧾', name: x.d.name, sub: `Parcela ${x.i + 1}/${x.d.n}${x.paid ? ' · paga' : ''}`, v: x.d.value })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return head + `<div class="cards-grid">
    <div class="carousel">${cards.map(c => cardFace(c.provider, c.id, c.id === card.id ? 'sel' : '', `data-action="sel-card" data-id="${c.id}" role="button" tabindex="0"`)).join('')}
      <button class="ccard add" data-action="add-card">${I.plus}Novo cartão</button></div>
    <div>
      <div class="panel"><p class="eyebrow">Gasto no ${esc(card.provider)} em ${ymLabel(state.ym)}</p><div class="bigfig">${brl(sp.total)}</div>
        <p class="hint">${sp.tx.length} compra${sp.tx.length === 1 ? '' : 's'}${sp.inst.length ? ` + ${sp.inst.length} parcela${sp.inst.length === 1 ? '' : 's'}` : ''}</p></div>
      ${cats.length ? `<div class="panel"><h3>Por categoria</h3><div class="mini">${cats.map(([c, v]) => `<div class="r"><span>${esc(c)}</span><div class="bar"><i style="width:${v / max * 100}%"></i></div><b>${brl(v)}</b></div>`).join('')}</div></div>` : ''}
      <div class="panel"><h3>Compras</h3>${rows.length ? rows.map(r => `<div class="item"><div class="ic">${r.ic}</div><div class="mid"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></div><div class="val">${brl(r.v)}</div>${r.id ? `<button class="x" data-action="del-tx" data-id="${r.id}" aria-label="Remover">✕</button>` : ''}</div>`).join('')
      : '<div class="empty">Sem compras neste mês.<br>Ao registrar um gasto, escolha este cartão em “Pago com”.</div>'}</div>
      <button class="btn danger small" data-action="del-card" data-id="${card.id}">Remover este cartão</button>
    </div></div>`;
}

function viewGoals() {
  const { goals } = D();
  const head = `<div class="top"><div><p class="eyebrow">Sonhos com prazo</p><h1>Metas</h1></div><button class="btn primary small" data-action="add-goal">+ Nova meta</button></div>`;
  if (!goals.length) return head + `<div class="panel empty"><b>O que você quer conquistar?</b>Uma viagem, um celular, a reserva de emergência… defina quanto quer guardar e acompanhe.
    <br><button class="btn primary" data-action="add-goal">Criar minha primeira meta</button></div>`;
  return head + `<div class="goals">${goals.map(g => {
    const pct = Math.min(100, Math.round(g.saved / g.target * 100));
    const left = Math.max(0, g.target - g.saved);
    let hint = '';
    if (left <= 0) hint = '<span class="done-tag">🎉 Meta atingida!</span>';
    else if (g.deadline) {
      const m = ymIdx(g.deadline) - ymIdx(curYm());
      hint = m > 0 ? `<p class="hint">Guarde <b>${brl(left / m)}</b>/mês para chegar em ${ymLabel(g.deadline)}</p>` : `<p class="hint neg">Prazo (${ymLabel(g.deadline)}) já passou</p>`;
    }
    return `<div class="panel goal"><div class="ring" style="--p:${pct}"><span>${esc(g.emoji)}</span><em>${pct}%</em></div>
      <div><h4>${esc(g.name)}</h4><p class="nums"><b>${brl(g.saved)}</b> de ${brl(g.target)}</p>
        <div class="bar"><i style="width:${pct}%"></i></div>${hint}
        <div class="acts"><button class="btn small" data-action="deposit" data-id="${g.id}">Guardar / resgatar</button>
        <button class="btn small danger" data-action="del-goal" data-id="${g.id}" aria-label="Remover meta">✕</button></div></div></div>`;
  }).join('')}</div>`;
}

function viewDebts() {
  const { debts, cards } = D();
  const head = `<div class="top"><div><p class="eyebrow">Parcelas e financiamentos</p><h1>Parcelas</h1></div><button class="btn primary small" data-action="add-debt">+ Nova</button></div>`;
  if (!debts.length) return head + `<div class="panel empty"><b>Sem parcelas por aqui</b>Cadastre compras parceladas e financiamentos e vá dando baixa mês a mês.
    <br><button class="btn primary" data-action="add-debt">Cadastrar parcela</button></div>`;
  const now = curYm();
  const monthTotal = sum(installmentsOf(now).map(x => x.d.value));
  const owed = sum(debts.map(d => d.paid.filter(p => !p).length * d.value));
  return head + `<div class="sumrow"><div class="stat"><small>Comprometido em ${ymShort(now)}</small><b>${brl(monthTotal)}</b></div><div class="stat"><small>Saldo devedor total</small><b>${brl(owed)}</b></div></div>
  <div class="debts">${debts.map(d => {
    const paidN = d.paid.filter(Boolean).length;
    const rest = d.n - paidN;
    const card = cards.find(c => c.id === d.cardId);
    const end = addMonths(d.start, d.n - 1);
    return `<div class="panel debt"><h4>${esc(d.name)} <span class="badge ${d.kind === 'fin' ? 'fin' : ''}">${d.kind === 'fin' ? 'Financiamento' : 'Parcelado'}</span>${card ? `<span class="badge">${esc(card.provider)}</span>` : ''}</h4>
      <div class="meta"><span>${brl(d.value)} × ${d.n}</span><span>${rest ? `Faltam <b>${brl(rest * d.value)}</b>` : '<b class="pos">Quitado 🎉</b>'}</span></div>
      <div class="bar"><i style="width:${paidN / d.n * 100}%"></i></div>
      <div class="timeline">${d.paid.map((p, i) => {
        const ym = addMonths(d.start, i);
        const cls = p ? 'paid' : ym < now ? 'late' : ym === now ? 'now' : '';
        return `<button type="button" class="inst ${cls}" data-action="toggle-inst" data-id="${d.id}" data-i="${i}" aria-pressed="${p}" aria-label="Parcela ${i + 1}, ${ymShort(ym)}"><span class="ck">${p ? '✓' : ym < now ? '!' : ''}</span><b>${i + 1}/${d.n}</b>${ymShort(ym)}</button>`;
      }).join('')}</div>
      <p class="hint">${paidN}/${d.n} pagas · termina em ${ymLabel(end)} · toque numa parcela para dar baixa</p>
      <div class="acts" style="display:flex;gap:8px;margin-top:12px">
        ${rest ? `<button class="btn small primary" data-action="pay-next" data-id="${d.id}">Baixar próxima parcela</button>` : ''}
        <button class="btn small danger" data-action="del-debt" data-id="${d.id}">Remover</button></div></div>`;
  }).join('')}</div>`;
}

const TABS = [['home', 'Início', I.home, viewHome], ['cards', 'Cartões', I.card, viewCards], ['goals', 'Metas', I.goal, viewGoals], ['debts', 'Parcelas', I.debt, viewDebts]];
function render() {
  $('#nav').innerHTML = `<div class="brand"><img src="icon.svg" alt="">Fluxo</div>` +
    TABS.map(t => `<button data-action="tab" data-tab="${t[0]}" class="${state.tab === t[0] ? 'on' : ''}" ${state.tab === t[0] ? 'aria-current="page"' : ''}>${t[2]}${t[1]}</button>`).join('');
  $('#view').innerHTML = TABS.find(t => t[0] === state.tab)[3]();
  $$('.timeline').forEach(t => { const n = $('.inst:not(.paid)', t); if (n) t.scrollLeft = Math.max(0, n.offsetLeft - 8); });
}
const update = () => { persist(); render(); };

/* ===== formulários ===== */
const chips = (name, items, sel) => items.map(([v, label], i) => `<label><input type="radio" name="${name}" value="${esc(v)}" ${v === sel || (!sel && i === 0) ? 'checked' : ''}><span>${label}</span></label>`).join('');

function formTx() {
  const defDate = state.ym === curYm() ? today() : `${state.ym}-01`;
  const cardOpts = [['', 'Dinheiro / Pix / Débito'], ...D().cards.map(c => [c.id, '💳 ' + esc(c.provider)])];
  openSheet('Novo lançamento', `
    <div class="seg out" id="typeSeg"><label><input type="radio" name="type" value="out" checked><span>Gasto</span></label><label><input type="radio" name="type" value="in"><span>Ganho</span></label></div>
    <label class="big-amount"><span>R$</span><input name="amount" inputmode="decimal" placeholder="0,00" autocomplete="off" autofocus aria-label="Valor"></label>
    <label class="field"><span>Descrição</span><input name="desc" placeholder="Ex.: Mercado do mês" autocomplete="off"></label>
    <div class="field"><span>Categoria</span><div class="chips" id="cats"></div></div>
    <div class="field" id="payRow"><span>Pago com</span><div class="chips">${chips('card', cardOpts, '')}</div></div>
    <label class="field"><span>Data</span><input type="date" name="date" value="${defDate}"></label>
    <button class="btn primary block" type="submit">Salvar</button>`,
    (f, fd) => {
      const amount = parseMoney(fd.get('amount'));
      if (amount <= 0) { toast('Informe um valor maior que zero'); return false; }
      const type = fd.get('type');
      D().tx.push({ id: uid(), type, amount, desc: fd.get('desc').trim(), category: fd.get('cat') || 'Outros', date: fd.get('date') || today(), cardId: type === 'out' ? fd.get('card') || null : null });
      state.ym = (fd.get('date') || today()).slice(0, 7);
      update();
    },
    f => {
      const paint = () => {
        const type = f.type.value;
        $('#typeSeg').className = 'seg ' + type;
        $('#cats').innerHTML = chips('cat', (type === 'in' ? CATS_IN : CATS_OUT).filter(c => c[0] !== (type === 'in' ? 'Resgate' : 'Metas')).map(c => [c[0], `${c[1]} ${c[0]}`]));
        $('#payRow').style.display = type === 'out' && D().cards.length ? '' : 'none';
      };
      f.addEventListener('change', e => { if (e.target.name === 'type') paint(); });
      paint();
    });
}

function formCard() {
  const sug = ['Nubank', 'Itaú', 'Bradesco', 'Santander', 'C6 Bank', 'Inter', 'Banco do Brasil', 'Caixa', 'Mastercard', 'Visa'];
  openSheet('Novo cartão', `
    <div class="preview" id="prev">${cardFace('', 'novo', 'static')}</div>
    <label class="field"><span>Nome do banco ou bandeira</span><input name="provider" placeholder="Ex.: Nubank" autocomplete="off" autofocus maxlength="24"></label>
    <div class="chips" style="margin-bottom:16px">${sug.map(s => `<button type="button" data-action="fill-provider" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <button class="btn primary block" type="submit">Adicionar cartão</button>`,
    (f, fd) => {
      const provider = fd.get('provider').trim();
      if (!provider) { toast('Digite o nome do cartão'); return false; }
      const c = { id: uid(), provider };
      D().cards.push(c); state.cardId = c.id; update();
    },
    f => f.provider.addEventListener('input', () => { $('#prev').innerHTML = cardFace(f.provider.value.trim(), 'novo', 'static'); }));
}

function formGoal() {
  const emojis = ['✈️', '🏖️', '🎮', '🚗', '🏠', '💍', '📱', '💻', '🎓', '🛟', '🎁', '🎸'].map(e => [e, e]);
  openSheet('Nova meta', `
    <label class="field"><span>O que você quer conquistar?</span><input name="name" placeholder="Ex.: Viagem para o Japão" autocomplete="off" autofocus></label>
    <div class="field"><span>Ícone</span><div class="chips">${chips('emoji', emojis, '✈️')}</div></div>
    <div class="two"><label class="field"><span>Quanto precisa (R$)</span><input name="target" inputmode="decimal" placeholder="0,00"></label>
    <label class="field"><span>Já guardado (R$)</span><input name="saved" inputmode="decimal" placeholder="0,00"></label></div>
    <label class="field"><span>Quero até (opcional)</span><input type="month" name="deadline" min="${curYm()}"></label>
    <button class="btn primary block" type="submit">Criar meta</button>`,
    (f, fd) => {
      const name = fd.get('name').trim(), target = parseMoney(fd.get('target'));
      if (!name || target <= 0) { toast('Informe o nome e o valor da meta'); return false; }
      D().goals.push({ id: uid(), name, emoji: fd.get('emoji'), target, saved: parseMoney(fd.get('saved')), deadline: fd.get('deadline') || '' });
      update();
    });
}

function formDeposit(id) {
  const g = D().goals.find(x => x.id === id);
  openSheet(`${esc(g.emoji)} ${esc(g.name)}`, `
    <div class="seg" id="depSeg"><label><input type="radio" name="kind" value="in" checked><span>Guardar</span></label><label><input type="radio" name="kind" value="out"><span>Resgatar</span></label></div>
    <label class="big-amount"><span>R$</span><input name="amount" inputmode="decimal" placeholder="0,00" autocomplete="off" autofocus aria-label="Valor"></label>
    <label class="check"><input type="checkbox" name="reg" checked><span id="regTxt">Descontar do saldo livre deste mês</span></label>
    <button class="btn primary block" type="submit">Confirmar</button>`,
    (f, fd) => {
      let v = parseMoney(fd.get('amount'));
      if (v <= 0) { toast('Informe um valor'); return false; }
      const save = fd.get('kind') === 'in';
      if (!save) v = Math.min(v, g.saved);
      g.saved = Math.max(0, g.saved + (save ? v : -v));
      if (fd.get('reg')) D().tx.push({ id: uid(), type: save ? 'out' : 'in', amount: v, desc: `${save ? 'Guardado em' : 'Resgate de'} ${g.name}`, category: save ? 'Metas' : 'Resgate', date: today(), cardId: null });
      update();
    },
    f => f.addEventListener('change', e => { if (e.target.name === 'kind') $('#regTxt').textContent = f.kind.value === 'in' ? 'Descontar do saldo livre deste mês' : 'Somar ao saldo livre deste mês'; }));
}

function formDebt() {
  const cardOpts = [['', 'Nenhum'], ...D().cards.map(c => [c.id, '💳 ' + esc(c.provider)])];
  openSheet('Nova parcela / financiamento', `
    <div class="seg" id="kindSeg"><label><input type="radio" name="kind" value="parc" checked><span>Parcelamento</span></label><label><input type="radio" name="kind" value="fin"><span>Financiamento</span></label></div>
    <label class="field"><span>Nome</span><input name="name" placeholder="Ex.: Notebook, Carro…" autocomplete="off" autofocus></label>
    <div class="two"><label class="field"><span>Valor da parcela (R$)</span><input name="value" inputmode="decimal" placeholder="0,00"></label>
    <label class="field"><span>Nº de parcelas</span><input name="n" type="number" inputmode="numeric" min="1" max="600" placeholder="12"></label></div>
    <div class="two"><label class="field"><span>1º vencimento</span><input type="month" name="start" value="${curYm()}"></label>
    <label class="field"><span>Já pagas</span><input name="done" type="number" inputmode="numeric" min="0" value="0"></label></div>
    ${D().cards.length ? `<div class="field" id="cardRow"><span>Cartão (opcional)</span><div class="chips">${chips('card', cardOpts, '')}</div></div>` : ''}
    <p class="hint" id="total" style="margin:-4px 0 14px"></p>
    <button class="btn primary block" type="submit">Cadastrar</button>`,
    (f, fd) => {
      const name = fd.get('name').trim(), value = parseMoney(fd.get('value')), n = parseInt(fd.get('n'), 10);
      if (!name || value <= 0 || !(n >= 1)) { toast('Preencha nome, valor e nº de parcelas'); return false; }
      const done = Math.max(0, Math.min(n, parseInt(fd.get('done'), 10) || 0));
      D().debts.push({ id: uid(), name, kind: fd.get('kind'), value, n, start: fd.get('start') || curYm(), cardId: fd.get('card') || null, paid: Array.from({ length: n }, (_, i) => i < done) });
      update();
    },
    f => {
      const calc = () => { const v = parseMoney(f.value.value), n = parseInt(f.n.value, 10); $('#total').textContent = v > 0 && n > 0 ? `Total: ${brl(v * n)}` : ''; };
      f.value.addEventListener('input', calc); f.n.addEventListener('input', calc);
      f.addEventListener('change', e => { if (e.target.name === 'kind' && $('#cardRow')) $('#cardRow').style.display = f.kind.value === 'fin' ? 'none' : ''; });
    });
}

function formSettings() {
  openSheet('Ajustes', `<div class="setrow">
    <p class="mut">Seus dados ficam salvos só neste aparelho. Use o backup para levar para outro.</p>
    <button type="button" class="btn" data-action="export">⬇️ Exportar backup (.json)</button>
    <button type="button" class="btn" data-action="import">⬆️ Importar backup</button>
    <button type="button" class="btn" data-action="demo">✨ Carregar dados de exemplo</button>
    <button type="button" class="btn danger" data-action="reset">🗑️ Apagar tudo</button></div>`, () => true);
}

/* ===== ações ===== */
let snapshot = null;
const remember = () => { snapshot = JSON.stringify(state.data); };
const actions = {
  tab: el => { state.tab = el.dataset.tab; render(); scrollTo(0, 0); },
  prev: () => { state.ym = addMonths(state.ym, -1); render(); },
  next: () => { state.ym = addMonths(state.ym, 1); render(); },
  close: closeSheet,
  'add-tx': formTx, 'add-card': formCard, 'add-goal': formGoal, 'add-debt': formDebt, settings: formSettings,
  deposit: el => formDeposit(el.dataset.id),
  'sel-card': el => { state.cardId = el.dataset.id; render(); },
  'fill-provider': el => { const i = $('input[name=provider]'); i.value = el.dataset.v; i.dispatchEvent(new Event('input')); },
  'del-tx': el => { remember(); D().tx = D().tx.filter(t => t.id !== el.dataset.id); update(); toast('Lançamento removido', true); },
  'del-card': el => {
    if (!confirm('Remover este cartão? Os gastos continuam registrados, mas sem o vínculo com ele.')) return;
    remember(); D().cards = D().cards.filter(c => c.id !== el.dataset.id);
    D().tx.forEach(t => { if (t.cardId === el.dataset.id) t.cardId = null; });
    D().debts.forEach(d => { if (d.cardId === el.dataset.id) d.cardId = null; });
    update(); toast('Cartão removido', true);
  },
  'del-goal': el => { if (!confirm('Remover esta meta?')) return; remember(); D().goals = D().goals.filter(g => g.id !== el.dataset.id); update(); toast('Meta removida', true); },
  'del-debt': el => { if (!confirm('Remover esta parcela/financiamento?')) return; remember(); D().debts = D().debts.filter(d => d.id !== el.dataset.id); update(); toast('Removido', true); },
  'toggle-inst': el => { const d = D().debts.find(x => x.id === el.dataset.id); const i = +el.dataset.i; d.paid[i] = !d.paid[i]; update(); if (d.paid[i]) toast(`Parcela ${i + 1}/${d.n} baixada ✓`); },
  'pay-next': el => { const d = D().debts.find(x => x.id === el.dataset.id); const i = d.paid.indexOf(false); if (i < 0) return; d.paid[i] = true; update(); toast(`Parcela ${i + 1}/${d.n} baixada ✓`); },
  undo: () => { if (!snapshot) return; state.data = { ...empty(), ...JSON.parse(snapshot) }; snapshot = null; update(); $('#toast').classList.remove('show'); },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' }));
    a.download = `fluxo-backup-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: () => $('#importFile').click(),
  reset: () => { if (!confirm('Apagar TODOS os dados deste aparelho?')) return; state.data = empty(); closeSheet(); update(); toast('Tudo apagado'); },
  demo: () => {
    if ((D().tx.length || D().debts.length) && !confirm('Isso substitui os dados atuais pelos de exemplo. Continuar?')) return;
    state.data = demoData(); state.ym = curYm(); closeSheet(); update(); toast('Dados de exemplo carregados');
  },
};

function demoData() {
  const now = curYm(), dom = Math.max(1, new Date().getDate()), day = n => `${now}-${pad(Math.min(n, dom))}`;
  const cards = [{ id: 'c1', provider: 'Nubank' }, { id: 'c2', provider: 'Itaú' }, { id: 'c3', provider: 'C6 Bank' }];
  const t = (type, amount, desc, category, date, cardId = null) => ({ id: uid(), type, amount, desc, category, date, cardId });
  return {
    cards,
    tx: [
      t('in', 5200, 'Salário', 'Salário', day(5)), t('in', 850, 'Projeto de design', 'Freela', day(8)),
      t('out', 1450, 'Aluguel', 'Moradia', day(6)), t('out', 387.9, 'Mercado do mês', 'Mercado', day(7), 'c1'),
      t('out', 54.9, 'iFood', 'Comida', day(9), 'c1'), t('out', 39.9, 'Streaming', 'Assinaturas', day(3), 'c2'),
      t('out', 120, 'Combustível', 'Transporte', day(10), 'c3'), t('out', 89, 'Cinema + jantar', 'Lazer', day(11), 'c2'),
      t('out', 200, 'Guardado em Viagem para o Japão', 'Metas', day(5)),
    ],
    goals: [
      { id: uid(), name: 'Viagem para o Japão', emoji: '✈️', target: 18000, saved: 6200, deadline: addMonths(now, 14) },
      { id: uid(), name: 'PlayStation 5', emoji: '🎮', target: 3500, saved: 3100, deadline: addMonths(now, 2) },
      { id: uid(), name: 'Reserva de emergência', emoji: '🛟', target: 15000, saved: 2400, deadline: '' },
    ],
    debts: [
      { id: uid(), name: 'iPhone 15', kind: 'parc', value: 399.9, n: 12, start: addMonths(now, -4), cardId: 'c1', paid: Array.from({ length: 12 }, (_, i) => i < 4) },
      { id: uid(), name: 'Financiamento do carro', kind: 'fin', value: 1150, n: 48, start: addMonths(now, -10), cardId: null, paid: Array.from({ length: 48 }, (_, i) => i < 10) },
      { id: uid(), name: 'Notebook', kind: 'parc', value: 520, n: 10, start: addMonths(now, 1), cardId: 'c2', paid: Array(10).fill(false) },
    ],
  };
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-action=sel-card]')) { e.preventDefault(); actions['sel-card'](e.target); }
});
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.tx) || !Array.isArray(d.debts)) throw 0;
    state.data = { ...empty(), ...d }; closeSheet(); update(); toast('Backup importado');
  } catch { toast('Arquivo de backup inválido'); }
});

render();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
