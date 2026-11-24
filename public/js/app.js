/* Hospital Vendor Management System — demo portal. Data lives in this browser only. */
{
const D = window.VMS_DATA;
const CATS = D.CATEGORIES, ROLES = D.ROLES;
const KEY = 'vms-demo-state', RKEY = 'vms-demo-role';
const HOSPITAL = 'Sunrise Multispeciality Hospital';
let S = null, role = null;
const ui = { vq: '', vcat: '', vstatus: '', scat: '', nabhVendor: '' };

/* ---------- storage ---------- */
function load() {
  try { const r = localStorage.getItem(KEY); if (r) { const o = JSON.parse(r); if (o && o.version === D.VERSION) { S = o; return; } } } catch (e) {}
  S = D.seed(); save();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
try { role = localStorage.getItem(RKEY); if (!ROLES[role]) role = null; } catch (e) {}

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isoToday = () => D.addDays(0);
const days = iso => Math.round((new Date(iso + 'T00:00:00') - today0()) / 864e5);
const fdate = iso => iso ? new Date(iso.length > 10 ? iso : iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const ftime = iso => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const lakh = n => '₹' + n.toFixed(1) + ' L';
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
const vendor = id => S.vendors.find(v => v.id === id);
const po = id => S.pos.find(p => p.id === id);
const grnFor = poId => S.grns.find(g => g.poId === poId);
const invFor = poId => S.invoices.find(i => i.poId === poId);
const R = () => ROLES[role];
const can = p => R().perms.includes(p);
const nextId = (prefix) => { S.seq += 1; return prefix + '-' + String(S.seq).padStart(4, '0'); };
const mask = (s, keep = 4) => can('unmask') ? s : '•'.repeat(Math.max(0, s.length - keep)) + s.slice(-keep);
function log(action, target) { S.audit.unshift({ ts: new Date().toISOString(), role: R().name, action, target }); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); }

/* ---------- business rules ---------- */
const W = { quality: 30, delivery: 25, price: 15, compliance: 15, service: 15 };
const DIM_NAMES = { quality: 'Quality', delivery: 'Delivery', price: 'Price', compliance: 'Compliance', service: 'Service' };
function qScore(s) { let t = Object.keys(W).reduce((a, k) => a + s[k] * W[k] / 100, 0); if (s.critical) t = Math.min(t, 54); return Math.round(t); }
const latest = v => v.scores.length ? v.scores[v.scores.length - 1] : null;
const score = v => latest(v) ? qScore(latest(v)) : null;
const band = sc => sc == null ? null : sc >= 85 ? 'A' : sc >= 70 ? 'B' : sc >= 55 ? 'C' : 'D';
const BANDS = {
  A: { name: 'Preferred', action: 'Eligible for auto-renewal and rate contracts; first call for emergency orders' },
  B: { name: 'Approved', action: 'Renew on standard review' },
  C: { name: 'Watch', action: 'Corrective action plan within 30 days; renewal only with committee approval' },
  D: { name: 'Exit', action: 'No new POs except emergencies; replace at renewal' }
};
const bandBadge = v => { const b = band(score(v)); return b ? `<span class="b ${b}">${b} · ${BANDS[b].name}</span>` : '<span class="sub">Not scored</span>'; };
const isLive = v => v.status === 'Active' || v.status === 'Watch';

function blockers(v) {
  const r = [];
  if (!isLive(v)) r.push('Vendor status is ' + v.status);
  v.docs.forEach(d => {
    if (!d.verified) r.push(d.name + ' not verified');
    else if (d.expiry && days(d.expiry) < 0) r.push(d.name + ' expired on ' + fdate(d.expiry));
  });
  if (v.handlesPersonalData && !(v.dpa && v.dpa.signed)) r.push('Data processing addendum (DPDP) not signed');
  return r;
}
function autoSuspend() {
  S.vendors.forEach(v => {
    if (!isLive(v)) return;
    const exp = v.docs.filter(d => d.expiry && days(d.expiry) < 0);
    if (exp.length) { v.status = 'Suspended'; v.suspendReason = exp.map(d => d.name).join(', ') + ' expired'; S.audit.unshift({ ts: new Date().toISOString(), role: 'System', action: 'Auto-suspended — ' + v.suspendReason, target: v.code }); }
  });
}
function statusBadge(s) {
  const cls = { Active: 'ok', Watch: 'warn', Suspended: 'bad', Exited: 'bad', 'Pending verification': 'info', 'Pending approval': 'info', Draft: '' }[s] || '';
  return `<span class="b ${cls}">${esc(s)}</span>`;
}
function poLevel(amount) { return amount <= 50000 ? { lvl: 'L1', who: 'Purchase manager' } : amount <= 500000 ? { lvl: 'L2', who: 'Finance manager / CFO' } : { lvl: 'L3', who: 'CEO / Medical Superintendent' }; }
function canApprovePO(p) { return p.status === 'Pending approval' && R().poLimit >= p.amount && p.raisedBy !== R().name; }

function matchOf(i) {
  const p = po(i.poId), g = grnFor(i.poId), v = vendor(i.vendorId), r = [];
  if (!g) r.push('No goods receipt (GRN) yet');
  else { const acc = g.qtyReceived - g.qtyRejected; if (i.qty > acc) r.push(`Billed qty ${i.qty} > accepted qty ${acc}`); }
  if (p && Math.abs(i.rate - p.rate) / p.rate > 0.02) r.push(`Rate ${inr(i.rate)} vs PO ${inr(p.rate)} (${((i.rate / p.rate - 1) * 100).toFixed(1)}%)`);
  if (v && v.turnoverAbove5cr && !i.irn) r.push('E-invoice IRN missing (supplier > ₹5 cr turnover)');
  return { ok: !r.length, reasons: r };
}
function dueInfo(i) {
  const v = vendor(i.vendorId), g = grnFor(i.poId);
  const msme = v && (v.msme === 'Micro' || v.msme === 'Small');
  const term = msme ? Math.min(v.paymentTerm || 15, 45) : (v && v.paymentTerm) || 30;
  const base = g ? g.date : i.date;
  const due = new Date(base + 'T00:00:00'); due.setDate(due.getDate() + term);
  const dueIso = due.toISOString().slice(0, 10);
  return { msme, term, due: dueIso, days: days(dueIso) };
}
const invAmount = i => i.qty * i.rate;

function expiringItems(limit = 90) {
  const out = [];
  S.vendors.forEach(v => {
    if (v.status === 'Exited' || !v.empanelledOn) return;
    v.docs.forEach(d => { if (d.expiry && days(d.expiry) <= limit) out.push({ v, kind: 'doc', item: d.name, expiry: d.expiry, days: days(d.expiry) }); });
    if (v.contractEnd && days(v.contractEnd) <= limit) out.push({ v, kind: 'contract', item: 'Vendor contract term', expiry: v.contractEnd, days: days(v.contractEnd) });
  });
  return out.sort((a, b) => a.days - b.days);
}
function stage(d) {
  if (d < 0) return { t: 'Expired — new POs blocked', c: 'bad' };
  if (d <= 15) return { t: 'T−15 · escalated to CEO/MS', c: 'bad' };
  if (d <= 30) return { t: 'T−30 reminder', c: 'warn' };
  if (d <= 60) return { t: 'T−60 reminder', c: 'warn' };
  return { t: 'T−90 reminder', c: 'info' };
}
function incidentClock(x) {
  const hrs = (Date.now() - new Date(x.detected).getTime()) / 3600e3;
  return { hrs, left: 72 - hrs };
}

/* ---------- counts for nav ---------- */
function counts() {
  return {
    onboarding: S.vendors.filter(v => v.status === 'Pending verification' || v.status === 'Pending approval').length,
    pos: S.pos.filter(p => p.status === 'Pending approval').length,
    grn: S.pos.filter(p => p.status === 'Approved').length,
    inv: S.invoices.filter(i => i.status !== 'Paid' && !matchOf(i).ok).length,
    ren: expiringItems(30).length,
    priv: S.incidents.filter(x => !x.closed).length + S.vendors.filter(v => v.handlesPersonalData && !(v.dpa && v.dpa.signed) && v.status !== 'Exited').length
  };
}

/* ---------- sign-in ---------- */
function renderLogin() {
  $('#app').innerHTML = `<div class="login">
    <section class="brand">
      <div class="logo"><i></i>${HOSPITAL}</div>
      <div><h1>Vendor management system</h1>
      <p>One vendor master for purchase, stores and finance: verified onboarding, purchase orders blocked for non-compliant vendors, three-way match, MSME payment clock, quarterly scorecards, renewals, NABH audit pack and DPDP privacy controls.</p></div>
      <p class="sub" style="color:#89aeab">Demo environment · all vendors, people and figures are fictional · data stays in this browser</p>
    </section>
    <section class="pick">
      <h2>Sign in as</h2>
      <p class="sub">Pick a role to see what that user can do. You can switch roles at any time from the top bar.</p>
      <div class="roles">${Object.entries(ROLES).map(([k, r]) => `<button class="role" data-act="signin" data-role="${k}"><b>${esc(r.name)}</b><span>${esc(r.who)}</span></button>`).join('')}</div>
    </section></div>`;
}

/* ---------- shell ---------- */
const NAV = [
  ['dashboard', 'Dashboard'], ['vendors', 'Vendor master'], ['onboarding', 'Onboarding & approval', 'onboarding'],
  ['purchase-orders', 'Purchase orders', 'pos'], ['grn', 'Goods receipt (GRN)', 'grn'], ['invoices', 'Invoices & payments', 'inv'],
  ['scorecards', 'Scorecards'], ['renewals', 'Renewals & expiry', 'ren'], ['nabh', 'NABH audit pack'], ['privacy', 'Privacy (DPDP)', 'priv'], ['audit', 'Audit trail']
];
function renderShell() {
  $('#app').innerHTML = `<div class="shell">
    <aside id="side"><div class="logo"><i></i>Vendor portal</div><nav id="nav"></nav>
      <div class="foot">${HOSPITAL}<br>Demo data only<button data-act="reset">Reset demo data</button></div></aside>
    <main><div class="top"><div class="row"><button class="menu" data-act="menu" aria-label="Open menu">☰</button><span class="demo">Demo</span></div>
      <div class="who"><label class="sub" for="roleSel">Signed in as</label>
      <select id="roleSel">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === role ? 'selected' : ''}>${esc(r.name)} — ${esc(r.who)}</option>`).join('')}</select>
      <button class="btn sm" data-act="signout">Sign out</button></div></div>
      <div class="view" id="view"></div></main></div>`;
  $('#roleSel').addEventListener('change', e => { role = e.target.value; try { localStorage.setItem(RKEY, role); } catch (x) {} toast('Now acting as ' + R().name); refresh(); });
}
function renderNav(cur) {
  const c = counts();
  $('#nav').innerHTML = NAV.map(([h, t, k], i) => (i === 3 ? '<small>Procure to pay</small>' : i === 6 ? '<small>Performance & compliance</small>' : '') +
    `<a href="#${h}" class="${cur === h || (h === 'vendors' && cur.startsWith('vendor-')) ? 'on' : ''}"><span>${t}</span>${k && c[k] ? `<span class="pill">${c[k]}</span>` : ''}</a>`).join('');
}
function head(title, sub, actions) {
  return `<div class="head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="row">${actions}</div>` : ''}</div>`;
}

/* ---------- views ---------- */
const V = {};

V.dashboard = () => {
  const vs = S.vendors, live = vs.filter(isLive);
  const blocked = vs.filter(v => v.empanelledOn && v.status !== 'Exited' && blockers(v).length);
  const exp = expiringItems(90);
  const held = S.invoices.filter(i => i.status !== 'Paid' && !matchOf(i).ok);
  const msmeDue = S.invoices.filter(i => i.status !== 'Paid' && dueInfo(i).msme && dueInfo(i).days <= 7);
  const scored = live.filter(v => score(v) != null);
  const avg = scored.length ? Math.round(scored.reduce((a, v) => a + score(v), 0) / scored.length) : 0;
  const c = counts();
  const flow = [
    ['Registration', vs.filter(v => v.status === 'Draft' || v.status === 'Pending verification').length, 'onboarding'],
    ['Document verification', vs.filter(v => v.status === 'Pending verification').length, 'onboarding'],
    ['Evaluation & approval', vs.filter(v => v.status === 'Pending approval').length, 'onboarding'],
    ['Empanelled vendors', live.length, 'vendors'],
    ['Purchase orders open', S.pos.filter(p => p.status === 'Pending approval' || p.status === 'Approved').length, 'purchase-orders'],
    ['Goods received', S.grns.length, 'grn'],
    ['Invoices unpaid', S.invoices.filter(i => i.status !== 'Paid').length, 'invoices'],
    ['Scored this quarter', scored.length, 'scorecards'],
    ['Renewals due ≤ 90 days', exp.length, 'renewals']
  ];
  const alerts = [];
  vs.filter(v => v.status === 'Suspended').forEach(v => alerts.push(['bad', `<a href="#vendor-${v.id}">${esc(v.name)}</a> suspended — ${esc(v.suspendReason || blockers(v)[0] || '')}. New POs blocked.`]));
  S.incidents.filter(x => !x.closed).forEach(x => { const k = incidentClock(x); alerts.push([k.left < 24 ? 'bad' : 'warn', `Privacy incident <a href="#privacy">${esc(x.id)}</a>: ${Math.max(0, Math.round(k.left))} h left to file the detailed report with the Data Protection Board.`]); });
  vs.filter(v => v.handlesPersonalData && !(v.dpa && v.dpa.signed) && v.status !== 'Exited').forEach(v => alerts.push(['warn', `<a href="#vendor-${v.id}">${esc(v.name)}</a> handles personal data but has no signed data processing addendum.`]));
  msmeDue.forEach(i => { const d = dueInfo(i); alerts.push([d.days < 0 ? 'bad' : 'warn', `MSME payment <a href="#invoices">${esc(i.id)}</a> to ${esc(vendor(i.vendorId).name)} ${d.days < 0 ? 'overdue by ' + plural(-d.days, 'day') : 'due in ' + plural(d.days, 'day')} (${inr(invAmount(i))}). Late payment loses the tax deduction under Section 43B(h).`]); });
  held.forEach(i => alerts.push(['warn', `Invoice <a href="#invoices">${esc(i.id)}</a> on hold — ${esc(matchOf(i).reasons[0])}.`]));
  S.pos.filter(canApprovePO).forEach(p => alerts.push(['info', `PO <a href="#purchase-orders">${esc(p.id)}</a> for ${inr(p.amount)} is waiting for your approval.`]));
  if (can('approveVendor')) vs.filter(v => v.status === 'Pending approval').forEach(v => alerts.push(['info', `<a href="#onboarding">${esc(v.name)}</a> is waiting for empanelment approval.`]));

  const totalSpend = live.reduce((a, v) => a + v.spend, 0) || 1;
  const byBand = { A: 0, B: 0, C: 0, D: 0 }; live.forEach(v => { const b = band(score(v)); if (b) byBand[b] += v.spend; });
  const colors = { A: 'var(--green)', B: 'var(--blue)', C: 'var(--amber)', D: 'var(--red)' };

  return head(`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${esc(R().who.split(' ').slice(-2)[0])}`, `${esc(R().name)} · ${fdate(isoToday())}`) +
    `<div class="flow" aria-label="Vendor lifecycle">${flow.map(f => `<a href="#${f[2]}"><b>${f[1]}</b><span>${f[0]}</span></a>`).join('')}</div>
    <div class="kpis">
      <a class="kpi" href="#vendors"><b>${live.length}</b><span>Active vendors</span></a>
      <a class="kpi ${blocked.length ? 'bad' : ''}" href="#vendors"><b>${blocked.length}</b><span>Blocked from new POs</span></a>
      <a class="kpi ${c.ren ? 'warn' : ''}" href="#renewals"><b>${exp.length}</b><span>Documents/contracts expiring ≤ 90 days</span></a>
      <a class="kpi ${held.length ? 'warn' : ''}" href="#invoices"><b>${held.length}</b><span>Invoices on hold (3-way match)</span></a>
      <a class="kpi ${msmeDue.length ? 'warn' : ''}" href="#invoices"><b>${inr(msmeDue.reduce((a, i) => a + invAmount(i), 0))}</b><span>MSME payments due ≤ 7 days</span></a>
      <a class="kpi" href="#scorecards"><b>${avg}</b><span>Average vendor score / 100</span></a>
    </div>
    <div class="grid g2">
      <section class="card"><h2>Needs attention</h2>${alerts.length ? `<ul class="alerts">${alerts.map(a => `<li><span class="dot ${a[0]}"></span><span>${a[1]}</span></li>`).join('')}</ul>` : '<p class="empty">Nothing needs attention.</p>'}</section>
      <section class="card"><h2>Annual spend by score band</h2>
        <div class="bars">${['A', 'B', 'C', 'D'].map(b => `<div class="r"><span>${b} · ${BANDS[b].name}</span><div class="track"><i style="width:${pct(byBand[b], totalSpend)}%;background:${colors[b]}"></i></div><span class="n">${lakh(byBand[b])}</span></div>`).join('')}</div>
        <p class="sub">${pct(byBand.C + byBand.D, totalSpend)}% of spend sits with vendors on Watch or Exit bands.</p>
        <h3 style="margin-top:16px">Recent activity</h3>
        <ul class="alerts">${S.audit.slice(0, 5).map(a => `<li><span class="dot"></span><span><b>${esc(a.action)}</b> · ${esc(a.target)}<br><span class="sub">${esc(a.role)} · ${ftime(a.ts)}</span></span></li>`).join('')}</ul>
      </section>
    </div>`;
};

V.vendors = () => {
  const rows = S.vendors.filter(v =>
    (!ui.vq || (v.name + v.code + v.gstin + v.city).toLowerCase().includes(ui.vq.toLowerCase())) &&
    (!ui.vcat || v.category === ui.vcat) && (!ui.vstatus || v.status === ui.vstatus));
  const statuses = [...new Set(S.vendors.map(v => v.status))];
  return head('Vendor master', 'The single list of vendors that Inventory and Finance read. Only vendors with valid documents and a signed data addendum (where needed) can receive a purchase order.',
    can('createVendor') ? '<button class="btn primary" data-act="newVendor">Register vendor</button>' : '') +
    `<div class="card"><div class="filters">
      <input id="vq" type="search" placeholder="Search name, code, GSTIN, city" value="${esc(ui.vq)}" aria-label="Search vendors">
      <select id="vcat" aria-label="Category"><option value="">All categories</option>${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${ui.vcat === k ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
      <select id="vstatus" aria-label="Status"><option value="">All statuses</option>${statuses.map(s => `<option ${ui.vstatus === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
    </div>
    <div class="scroll"><table class="stack"><thead><tr><th>Vendor</th><th>Category</th><th>Status</th><th>Score</th><th>PO eligibility</th><th class="n">Spend (12 m)</th></tr></thead><tbody>
    ${rows.map(v => { const b = blockers(v); return `<tr class="click" data-act="openVendor" data-id="${v.id}">
      <td><b>${esc(v.name)}</b><br><span class="sub">${esc(v.code)} · ${esc(v.city)}${v.msme ? ' · MSME ' + esc(v.msme) : ''}</span></td>
      <td>${esc(CATS[v.category].name)}<br><span class="sub">Risk: ${esc(CATS[v.category].risk)}</span></td>
      <td>${statusBadge(v.status)}</td>
      <td>${score(v) != null ? `<b>${score(v)}</b> ` : ''}${bandBadge(v)}</td>
      <td>${b.length ? `<span class="b bad">Blocked</span><br><span class="sub">${esc(b[0])}${b.length > 1 ? ' +' + (b.length - 1) : ''}</span>` : '<span class="b ok">Can order</span>'}</td>
      <td class="n">${v.spend ? lakh(v.spend) : '—'}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">No vendors match.</td></tr>'}
    </tbody></table></div></div>`;
};

function trendSvg(v) {
  if (!v.scores.length) return '<p class="empty">No scorecards yet — first quarter after empanelment.</p>';
  const pts = v.scores.map(qScore), W0 = 420, H0 = 150, pad = 28;
  const lo = Math.min(...pts, 55) - 6, hi = Math.max(...pts, 85) + 6;
  const x = i => pad + i * (W0 - pad * 2) / Math.max(1, pts.length - 1), y = s => H0 - 22 - (s - lo) / (hi - lo) * (H0 - 44);
  const bandLines = [85, 70, 55].map(t => `<line x1="${pad}" x2="${W0 - pad}" y1="${y(t)}" y2="${y(t)}" stroke="currentColor" stroke-opacity=".15" stroke-dasharray="3 3"/><text x="${W0 - pad + 4}" y="${y(t) + 4}" font-size="10" fill="currentColor" opacity=".55">${t}</text>`).join('');
  return `<div class="fig"><svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="Score trend">${bandLines}
    <polyline fill="none" stroke="var(--teal)" stroke-width="2.5" points="${pts.map((s, i) => x(i) + ',' + y(s)).join(' ')}"/>
    ${pts.map((s, i) => `<circle cx="${x(i)}" cy="${y(s)}" r="4" fill="var(--teal)"/><text x="${x(i)}" y="${y(s) - 9}" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">${s}</text><text x="${x(i)}" y="${H0 - 4}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">${esc(v.scores[i].q)}</text>`).join('')}
  </svg></div>`;
}

V.vendor = (id) => {
  const v = vendor(id); if (!v) return head('Vendor not found', '<a href="#vendors">Back to vendor master</a>');
  const b = blockers(v), l = latest(v);
  const pos = S.pos.filter(p => p.vendorId === v.id), invs = S.invoices.filter(i => i.vendorId === v.id);
  const acts = [];
  if (can('approveVendor') && v.status === 'Pending approval') acts.push(`<button class="btn primary" data-act="approveVendor" data-id="${v.id}">Approve empanelment</button>`);
  if (can('approveVendor') && isLive(v)) acts.push(`<button class="btn danger" data-act="setStatus" data-id="${v.id}" data-s="Suspended">Suspend</button>`);
  if (can('approveVendor') && v.status === 'Suspended') acts.push(`<button class="btn" data-act="setStatus" data-id="${v.id}" data-s="Active">Reinstate</button>`);
  if (can('approveVendor') && v.status !== 'Exited' && v.empanelledOn) acts.push(`<button class="btn danger" data-act="setStatus" data-id="${v.id}" data-s="Exited">Exit vendor</button>`);
  if (can('rate') && isLive(v)) acts.push(`<button class="btn" data-act="rateVendor" data-id="${v.id}">Rate vendor</button>`);
  acts.push(`<button class="btn" data-act="vendorFile" data-id="${v.id}">NABH vendor file</button>`);
  return `<p class="noprint"><a href="#vendors">← Vendor master</a></p>` +
    head(esc(v.name), `${esc(v.code)} · ${esc(CATS[v.category].name)} · ${esc(v.city)} &nbsp; ${statusBadge(v.status)} ${bandBadge(v)}`, acts.join('')) +
    (b.length ? `<div class="block bad" style="margin-bottom:16px"><b>Purchase orders blocked</b><ul>${b.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : `<div class="block ok" style="margin-bottom:16px"><b>Cleared for purchase orders.</b> All mandatory documents are verified and in date.</div>`) +
    `<div class="grid g2">
      <section class="card"><h2>Documents</h2><div class="scroll"><table class="stack"><thead><tr><th>Document</th><th>Number</th><th>Expiry</th><th>Status</th><th></th></tr></thead><tbody>
      ${v.docs.map((d, i) => { const dd = d.expiry ? days(d.expiry) : null; const st = !d.verified ? '<span class="b info">Awaiting verification</span>' : dd == null ? '<span class="b ok">Verified</span>' : dd < 0 ? '<span class="b bad">Expired</span>' : dd <= 30 ? `<span class="b warn">${dd} days left</span>` : dd <= 90 ? `<span class="b info">${dd} days left</span>` : '<span class="b ok">Valid</span>';
        const canEdit = can('createVendor') || can('renew');
        return `<tr><td>${esc(d.name)}</td><td class="nowrap">${esc(d.number)}</td><td class="nowrap">${fdate(d.expiry)}</td><td>${st}</td><td>${canEdit && (!d.verified || d.expiry) ? `<button class="btn sm" data-act="${d.verified ? 'renewDoc' : 'verifyDoc'}" data-id="${v.id}" data-i="${i}">${d.verified ? 'Upload renewed' : 'Verify'}</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div></section>
      <section class="card"><h2>Profile</h2><dl class="kv">
        <dt>Contact</dt><dd>${esc(v.contact.name)}<br><span class="sub">${esc(v.contact.email)} · ${esc(mask(v.contact.phone.replace(/\s/g, ''), 4))}</span></dd>
        <dt>GSTIN</dt><dd>${esc(v.gstin)} <span class="b ok">Verified</span></dd>
        <dt>PAN</dt><dd>${esc(mask(v.pan))}</dd>
        <dt>Bank account</dt><dd>${esc(mask(v.bank.acc))} · ${esc(v.bank.ifsc)}</dd>
        <dt>MSME (Udyam)</dt><dd>${v.msme ? esc(v.msme) + ' enterprise' : 'Not MSME'}</dd>
        <dt>Payment term</dt><dd>${v.paymentTerm} days${v.msme === 'Micro' || v.msme === 'Small' ? ' (capped at 45 by MSMED Act)' : ''}</dd>
        <dt>E-invoice</dt><dd>${v.turnoverAbove5cr ? 'Required (turnover above ₹5 cr)' : 'Not applicable'}</dd>
        <dt>Personal data</dt><dd>${v.handlesPersonalData ? `Data processor — ${v.dpa && v.dpa.signed ? 'addendum signed ' + fdate(v.dpa.date) : '<span class="b bad">addendum missing</span>'}` : 'Does not handle personal data'}</dd>
        <dt>Empanelled</dt><dd>${fdate(v.empanelledOn)}</dd><dt>Contract ends</dt><dd>${fdate(v.contractEnd)}</dd>
      </dl>${can('unmask') ? '' : '<p class="sub">PAN, bank and phone numbers are masked for your role.</p>'}</section>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <section class="card"><h2>Score trend</h2>${trendSvg(v)}
        ${l ? `<div class="bars">${Object.keys(W).map(k => `<div class="r"><span>${DIM_NAMES[k]} (${W[k]})</span><div class="track"><i style="width:${l[k]}%;background:var(--teal)"></i></div><span class="n">${l[k]}</span></div>`).join('')}</div>
        ${l.critical ? '<div class="block bad">A critical event this quarter caps the score at 54.</div>' : ''}<p class="sub">Band action: ${esc(BANDS[band(score(v))].action)}.</p>` : ''}</section>
      <section class="card"><h2>Purchase orders & invoices</h2>
        ${pos.length ? `<div class="scroll"><table><thead><tr><th>PO</th><th>Item</th><th class="n">Amount</th><th>Status</th></tr></thead><tbody>${pos.map(p => `<tr><td class="nowrap">${esc(p.id)}</td><td>${esc(p.desc)}</td><td class="n">${inr(p.amount)}</td><td><span class="b">${esc(p.status)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No purchase orders yet.</p>'}
        ${invs.length ? `<p class="sub">Invoices: ${invs.map(i => esc(i.id) + ' (' + esc(i.status) + ')').join(', ')}</p>` : ''}
      </section>
    </div>
    <section class="card" style="margin-top:16px"><h2>Audit trail for this vendor</h2>${auditTable(S.audit.filter(a => a.target === v.code || a.target === v.name))}</section>`;
};

V.onboarding = () => {
  const pend = S.vendors.filter(v => v.status === 'Pending verification' || v.status === 'Pending approval' || v.status === 'Draft');
  return head('Onboarding & empanelment', 'No vendor gets a code — and so no PO, GRN or payment — until every mandatory document for its category is verified and the committee approves it on a 100-point sheet.',
    can('createVendor') ? '<button class="btn primary" data-act="newVendor">Register vendor</button>' : '') +
    `<div class="card"><h2>Approval queue</h2><div class="scroll"><table class="stack"><thead><tr><th>Vendor</th><th>Category</th><th>Stage</th><th>Documents</th><th>Evaluation</th><th></th></tr></thead><tbody>
    ${pend.map(v => { const tot = v.docs.length, ok = v.docs.filter(d => d.verified).length; const ev = v.evaluation ? Object.values(v.evaluation).reduce((a, b) => a + b, 0) : null;
      let act = `<button class="btn sm" data-act="openVendor" data-id="${v.id}">Open</button>`;
      if (v.status === 'Pending approval' && can('approveVendor')) act += ` <button class="btn sm primary" data-act="approveVendor" data-id="${v.id}">Evaluate & approve</button>`;
      return `<tr><td><b>${esc(v.name)}</b><br><span class="sub">${esc(v.city)}</span></td><td>${esc(CATS[v.category].name)}</td><td>${statusBadge(v.status)}</td>
      <td>${ok}/${tot} verified${v.handlesPersonalData && !(v.dpa && v.dpa.signed) ? '<br><span class="b bad">DPA missing</span>' : ''}</td><td>${ev != null ? ev + '/100' : '—'}</td><td class="nowrap">${act}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">No vendors waiting.</td></tr>'}
    </tbody></table></div></div>
    <div class="grid g3" style="margin-top:16px">
      <section class="card"><h3>Common to every vendor</h3><ul class="sub">${D.COMMON_DOCS.map(d => `<li>${esc(d)}</li>`).join('')}<li>Udyam (MSME) certificate if applicable</li><li>Data processing addendum if the vendor sees personal data</li></ul></section>
      <section class="card"><h3>Category-specific</h3><ul class="sub">${Object.values(CATS).map(c => `<li><b>${esc(c.name)}:</b> ${esc(c.docs.join(', '))}</li>`).join('')}</ul></section>
      <section class="card"><h3>Empanelment sheet (100 points)</h3><ul class="sub"><li>Quality — 40</li><li>Price — 30</li><li>Delivery capacity — 15</li><li>References — 15</li></ul><p class="sub">60 or more to empanel. Capital items need a multidisciplinary committee.</p></section>
    </div>`;
};

V['purchase-orders'] = () => {
  const list = [...S.pos].reverse();
  return head('Purchase orders', 'PO price defaults to the contract rate. Approval by value: up to ₹50,000 purchase manager; up to ₹5 lakh finance manager; above that CEO/MS. The person who raises a PO cannot approve it.',
    can('raisePO') ? '<button class="btn primary" data-act="newPO">New purchase order</button>' : '') +
    `<div class="card"><div class="scroll"><table class="stack"><thead><tr><th>PO</th><th>Vendor</th><th>Item</th><th class="n">Qty</th><th class="n">Amount</th><th>Approval</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map(p => { const v = vendor(p.vendorId), lv = poLevel(p.amount);
      let act = '';
      if (canApprovePO(p)) act = `<button class="btn sm primary" data-act="approvePO" data-id="${p.id}">Approve</button> <button class="btn sm danger" data-act="rejectPO" data-id="${p.id}">Reject</button>`;
      else if (p.status === 'Pending approval') act = `<span class="sub">Needs ${esc(lv.who)}${p.raisedBy === R().name ? ' (not you — raised by you)' : ''}</span>`;
      return `<tr><td class="nowrap"><b>${esc(p.id)}</b><br><span class="sub">${fdate(p.date)}</span></td><td><a href="#vendor-${v.id}">${esc(v.name)}</a></td><td>${esc(p.desc)}</td><td class="n">${p.qty.toLocaleString('en-IN')}</td><td class="n">${inr(p.amount)}</td>
      <td>${lv.lvl}<br><span class="sub">${p.approvedBy ? 'By ' + esc(p.approvedBy) : esc(lv.who)}</span></td><td><span class="b ${p.status === 'Pending approval' ? 'info' : p.status === 'Rejected' ? 'bad' : p.status === 'Closed' ? 'ok' : ''}">${esc(p.status)}</span></td><td>${act}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
};

V.grn = () => {
  const waiting = S.pos.filter(p => p.status === 'Approved');
  return head('Goods receipt (GRN)', 'Stores records what arrived, what was rejected at inspection and the shelf life. Each GRN feeds the vendor\'s delivery and quality scores and unlocks the invoice for payment.') +
    `<div class="card"><h2>Awaiting delivery</h2>${waiting.length ? `<div class="scroll"><table class="stack"><thead><tr><th>PO</th><th>Vendor</th><th>Item</th><th class="n">Qty ordered</th><th>Expected</th><th></th></tr></thead><tbody>
    ${waiting.map(p => `<tr><td>${esc(p.id)}</td><td>${esc(vendor(p.vendorId).name)}</td><td>${esc(p.desc)}</td><td class="n">${p.qty.toLocaleString('en-IN')}</td><td class="nowrap">${fdate(p.expected)} ${days(p.expected) < 0 ? '<span class="b bad">Late</span>' : ''}</td>
    <td>${can('grn') ? `<button class="btn sm primary" data-act="newGRN" data-id="${p.id}">Record receipt</button>` : '<span class="sub">Stores records this</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Nothing awaiting delivery.</p>'}</div>
    <div class="card" style="margin-top:16px"><h2>Receipts</h2><div class="scroll"><table class="stack"><thead><tr><th>GRN</th><th>PO / vendor</th><th>Date</th><th class="n">Received</th><th class="n">Rejected</th><th>On time</th><th>Shelf life</th></tr></thead><tbody>
    ${[...S.grns].reverse().map(g => { const p = po(g.poId); return `<tr><td>${esc(g.id)}</td><td>${esc(g.poId)}<br><span class="sub">${esc(vendor(p.vendorId).name)}</span></td><td class="nowrap">${fdate(g.date)}</td><td class="n">${g.qtyReceived.toLocaleString('en-IN')}</td><td class="n">${g.qtyRejected ? `<span class="b bad">${g.qtyRejected}</span>` : 0}</td><td>${g.onTime ? '<span class="b ok">Yes</span>' : '<span class="b warn">Late</span>'}</td><td>${g.shelfLifeMonths == null ? '—' : g.shelfLifeMonths < 6 ? `<span class="b warn">${g.shelfLifeMonths} months — under 6</span>` : g.shelfLifeMonths + ' months'}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
};

V.invoices = () => {
  const toInvoice = S.pos.filter(p => p.status === 'Received' && !invFor(p.id));
  return head('Invoices & payments', 'No invoice is paid without a GRN. The system holds an invoice until quantity, rate and e-invoice IRN match; micro and small suppliers must be paid within their agreed term, at most 45 days.') +
    (toInvoice.length ? `<div class="card" style="margin-bottom:16px"><h2>Received, invoice not yet entered</h2><div class="row">${toInvoice.map(p => `<span>${esc(p.id)} · ${esc(vendor(p.vendorId).name)}</span>${can('invoice') ? `<button class="btn sm" data-act="newInvoice" data-id="${p.id}">Enter invoice</button>` : ''}`).join('')}</div>${can('invoice') ? '' : '<p class="sub">Accounts enters invoices.</p>'}</div>` : '') +
    `<div class="card"><div class="scroll"><table class="stack"><thead><tr><th>Invoice</th><th>Vendor</th><th class="n">Amount</th><th>3-way match</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>
    ${[...S.invoices].reverse().map(i => { const v = vendor(i.vendorId), m = matchOf(i), d = dueInfo(i);
      let act = '';
      if (i.status === 'Entered' && can('preparePay')) act = m.ok ? `<button class="btn sm" data-act="preparePay" data-id="${i.id}">Prepare payment</button>` : `<button class="btn sm" data-act="fixInvoice" data-id="${i.id}">Resolve hold</button>`;
      if (i.status === 'Prepared' && can('approvePay')) act = m.ok && invAmount(i) <= R().payLimit ? `<button class="btn sm primary" data-act="approvePay" data-id="${i.id}">Approve & pay</button>` : `<span class="sub">${m.ok ? 'Above your limit' : 'On hold'}</span>`;
      if (i.status === 'Prepared' && !m.ok && can('preparePay')) act = `<button class="btn sm" data-act="fixInvoice" data-id="${i.id}">Resolve hold</button>`;
      const due = i.status === 'Paid' ? `<span class="sub">Paid ${fdate(i.paidOn)}</span>` : `${fdate(d.due)}<br>${d.days < 0 ? `<span class="b bad">${plural(-d.days, 'day')} overdue</span>` : d.days <= 7 ? `<span class="b warn">${plural(d.days, 'day')} left</span>` : `<span class="sub">${d.days} days left</span>`}${d.msme ? ' <span class="b info">MSME</span>' : ''}`;
      return `<tr><td class="nowrap"><b>${esc(i.id)}</b><br><span class="sub">${esc(i.number)} · ${esc(i.poId)}</span></td><td>${esc(v.name)}</td><td class="n">${inr(invAmount(i))}</td>
      <td>${m.ok ? '<span class="b ok">Matched</span>' : `<span class="b bad">On hold</span><br><span class="sub">${m.reasons.map(esc).join('<br>')}</span>`}</td><td class="nowrap">${due}</td><td><span class="b ${i.status === 'Paid' ? 'ok' : ''}">${esc(i.status)}</span></td><td>${act}</td></tr>`; }).join('')}
    </tbody></table></div><p class="sub">Flow: Accounts enters and prepares → Finance manager approves (up to ₹10 lakh) or CEO/MS above that. In the live system payments post to Tally as payment vouchers.</p></div>`;
};

V.scorecards = () => {
  const list = S.vendors.filter(v => v.scores.length && v.status !== 'Exited' && (!ui.scat || v.category === ui.scat)).sort((a, b) => score(b) - score(a));
  const catSpend = {}; S.vendors.forEach(v => catSpend[v.category] = (catSpend[v.category] || 0) + v.spend);
  const single = Object.keys(CATS).map(k => { const vs = S.vendors.filter(v => v.category === k && v.spend); const top = vs.sort((a, b) => b.spend - a.spend)[0]; return top && catSpend[k] && top.spend / catSpend[k] > 0.6 ? `${CATS[k].name}: ${top.name} holds ${Math.round(top.spend / catSpend[k] * 100)}% of spend` : null; }).filter(Boolean);
  return head('Vendor scorecards', `Each vendor gets a 100-point score every quarter (${D.quarters()[3]} shown): 70% calculated from GRN, quality and invoice data, 30% from user ratings. A recall, NSQ batch, licence lapse or data breach caps the quarter at 54.`) +
    `<div class="card"><div class="filters"><select id="scat" aria-label="Category"><option value="">All categories</option>${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${ui.scat === k ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
    <div class="scroll"><table class="stack"><thead><tr><th>#</th><th>Vendor</th><th class="n">Score</th><th>Band</th><th>Q · D · P · C · S</th><th class="n">Change</th><th class="n">Category spend share</th><th></th></tr></thead><tbody>
    ${list.map((v, n) => { const s = score(v), prev = v.scores.length > 1 ? qScore(v.scores[v.scores.length - 2]) : s, l = latest(v), share = catSpend[v.category] ? Math.round(v.spend / catSpend[v.category] * 100) : 0, b = band(s);
      return `<tr><td>${n + 1}</td><td><a href="#vendor-${v.id}"><b>${esc(v.name)}</b></a><br><span class="sub">${esc(CATS[v.category].name)}</span></td><td class="n"><b>${s}</b></td><td>${bandBadge(v)}${l.critical ? ' <span class="b bad">Critical event</span>' : ''}</td>
      <td><div class="dims" title="Quality, Delivery, Price, Compliance, Service">${Object.keys(W).map(k => `<i style="--w:${l[k]}%" title="${DIM_NAMES[k]} ${l[k]}"></i>`).join('')}</div><span class="sub">${Object.keys(W).map(k => l[k]).join(' · ')}</span></td>
      <td class="n">${s - prev > 0 ? '▲ ' + (s - prev) : s - prev < 0 ? '▼ ' + (prev - s) : '—'}</td><td class="n">${share}%${(b === 'C' || b === 'D') && share >= 30 ? '<br><span class="b warn">High spend, low score</span>' : ''}</td>
      <td>${can('rate') ? `<button class="btn sm" data-act="rateVendor" data-id="${v.id}">Rate</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div></div>
    <div class="grid g3" style="margin-top:16px">
      <section class="card"><h3>Weights</h3><table><tbody>${Object.keys(W).map(k => `<tr><td>${DIM_NAMES[k]}</td><td class="n">${W[k]}</td></tr>`).join('')}</tbody></table></section>
      <section class="card"><h3>Bands</h3><table><tbody>${[['85–100', 'A'], ['70–84', 'B'], ['55–69', 'C'], ['Below 55', 'D']].map(r => `<tr><td class="nowrap">${r[0]}</td><td><span class="b ${r[1]}">${r[1]} · ${BANDS[r[1]].name}</span><br><span class="sub">${BANDS[r[1]].action}</span></td></tr>`).join('')}</tbody></table></section>
      <section class="card"><h3>Single-source dependency</h3>${single.length ? `<ul>${single.map(s => `<li>${esc(s)}</li>`).join('')}</ul><p class="sub">One vendor above 60% of a category's spend.</p>` : '<p class="empty">No category depends on one vendor.</p>'}</section>
    </div>`;
};

V.renewals = () => {
  const items = expiringItems(90);
  return head('Renewals & expiry', 'Renewal starts 90 days before a licence or contract expires. Reminders at T−90, T−60, T−30; escalation to the CEO/MS at T−15; automatic suspension on expiry day. The vendor\'s band decides who can renew.') +
    `<div class="card"><div class="scroll"><table class="stack"><thead><tr><th>Vendor</th><th>Item</th><th>Expiry</th><th>Stage</th><th>Band</th><th>Renewal route</th><th></th></tr></thead><tbody>
    ${items.map(x => { const st = stage(x.days), b = band(score(x.v)); const crit = latest(x.v) && latest(x.v).critical;
      const route = x.kind === 'doc' ? 'Vendor uploads renewed document; purchase re-verifies' : b === 'A' && !crit ? 'Purchase manager may renew alone' : b === 'B' ? 'Standard committee review' : b === 'C' ? 'Committee approval + corrective plan' : b === 'D' ? 'Do not renew — find replacement' : 'Committee review';
      const di = x.kind === 'doc' ? x.v.docs.findIndex(d => d.name === x.item) : -1;
      return `<tr><td><a href="#vendor-${x.v.id}"><b>${esc(x.v.name)}</b></a><br><span class="sub">${statusBadge(x.v.status)}</span></td><td>${esc(x.item)}</td><td class="nowrap">${fdate(x.expiry)}<br><span class="sub">${x.days < 0 ? -x.days + ' days ago' : x.days + ' days left'}</span></td>
      <td><span class="b ${st.c}">${st.t}</span></td><td>${bandBadge(x.v)}</td><td>${esc(route)}</td>
      <td class="nowrap"><button class="btn sm" data-act="remind" data-id="${x.v.id}" data-item="${esc(x.item)}">Send reminder</button>${(can('createVendor') || can('renew')) ? (x.kind === 'doc' ? ` <button class="btn sm primary" data-act="renewDoc" data-id="${x.v.id}" data-i="${di}">Record renewal</button>` : ` <button class="btn sm primary" data-act="renewContract" data-id="${x.v.id}">Renew contract</button>`) : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Nothing expires in the next 90 days.</td></tr>'}
    </tbody></table></div></div>`;
};

V.nabh = () => {
  const live = S.vendors.filter(isLive), scored = live.filter(v => score(v) != null);
  const hi = scored.filter(v => ['A', 'B'].includes(band(score(v)))).length;
  const late = S.grns.filter(g => !g.onTime).length;
  const rec = S.grns.reduce((a, g) => a + g.qtyReceived, 0), rej = S.grns.reduce((a, g) => a + g.qtyRejected, 0);
  const files = S.vendors.filter(v => v.empanelledOn && v.status !== 'Exited');
  const complete = files.filter(v => !v.docs.some(d => !d.verified || (d.expiry && days(d.expiry) < 0)) && !(v.handlesPersonalData && !(v.dpa && v.dpa.signed))).length;
  const payBeforeGrn = S.invoices.filter(i => i.status === 'Paid' && (!grnFor(i.poId) || i.paidOn < grnFor(i.poId).date)).length;
  const ind = [
    ['% vendors with high score (band A or B)', pct(hi, scored.length), '≥ 80%', pct(hi, scored.length) >= 80],
    ['% delayed receipts', pct(late, S.grns.length), '≤ 10%', pct(late, S.grns.length) <= 10],
    ['% rejection at inspection', pct(rej, rec), '≤ 2%', pct(rej, rec) <= 2],
    ['% stock-outs due to purchase delay', pct(S.stockouts.events, S.stockouts.indents), '≤ 1%', pct(S.stockouts.events, S.stockouts.indents) <= 1],
    ['% vendor files complete and in date', pct(complete, files.length), '100%', complete === files.length],
    ['Payments released before GRN', payBeforeGrn, '0', payBeforeGrn === 0]
  ];
  const v = ui.nabhVendor ? vendor(ui.nabhVendor) : null;
  return head('NABH audit pack', 'Indicators the purchase and quality committees review monthly, and the vendor and purchase files assessors ask for during surveillance and renewal visits.', '<button class="btn" data-act="print">Print / save as PDF</button>') +
    `<div class="card"><h2>Monthly indicator pack · ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2><div class="scroll"><table class="stack"><thead><tr><th>Indicator</th><th class="n">This month</th><th class="n">Target</th><th>Status</th></tr></thead><tbody>
    ${ind.map(r => `<tr><td>${r[0]}</td><td class="n"><b>${r[1]}${typeof r[1] === 'number' && r[0].startsWith('%') ? '%' : ''}</b></td><td class="n">${r[2]}</td><td>${r[3] ? '<span class="b ok">Within target</span>' : '<span class="b bad">Action needed</span>'}</td></tr>`).join('')}
    </tbody></table></div><p class="sub">Stock-out figure is sample data (${S.stockouts.events} of ${S.stockouts.indents} indents); in the live system it comes from the HIS.</p></div>
    <div class="card" style="margin-top:16px"><h2>Evidence that evaluation led to action</h2><ul class="alerts">
      ${S.vendors.filter(x => ['C', 'D'].includes(band(score(x))) && x.status !== 'Exited').map(x => `<li><span class="dot ${band(score(x)) === 'D' ? 'bad' : 'warn'}"></span><span><a href="#vendor-${x.id}">${esc(x.name)}</a> — band ${band(score(x))}: ${esc(BANDS[band(score(x))].action)}. Status: ${esc(x.status)}.</span></li>`).join('') || '<li>No vendors on Watch or Exit bands.</li>'}
    </ul></div>
    <div class="card" style="margin-top:16px"><h2>Vendor file</h2><div class="filters"><select id="nabhV" aria-label="Choose vendor"><option value="">Choose a vendor…</option>${files.map(x => `<option value="${x.id}" ${ui.nabhVendor === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    ${v ? vendorFile(v) : '<p class="sub">Pick a vendor to assemble its empanelment, documents, scores and purchase trail in one printable file.</p>'}</div>`;
};
function vendorFile(v) {
  const pos = S.pos.filter(p => p.vendorId === v.id);
  return `<h3>${esc(v.name)} (${esc(v.code)})</h3><p class="sub">Empanelled ${fdate(v.empanelledOn)} · ${esc(CATS[v.category].name)} · status ${esc(v.status)}</p>
  <table><thead><tr><th>Document</th><th>Number</th><th>Expiry</th><th>Verified</th></tr></thead><tbody>${v.docs.map(d => `<tr><td>${esc(d.name)}</td><td>${esc(d.number)}</td><td>${fdate(d.expiry)}</td><td>${d.verified ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody></table>
  <h3 style="margin-top:14px">Quarterly evaluations</h3><table><thead><tr><th>Quarter</th>${Object.keys(W).map(k => `<th class="n">${DIM_NAMES[k]}</th>`).join('')}<th class="n">Score</th></tr></thead><tbody>${v.scores.map(s => `<tr><td>${esc(s.q)}</td>${Object.keys(W).map(k => `<td class="n">${s[k]}</td>`).join('')}<td class="n"><b>${qScore(s)}</b></td></tr>`).join('')}</tbody></table>
  <h3 style="margin-top:14px">Purchase trail</h3><table><thead><tr><th>PO</th><th>Approved by</th><th>GRN</th><th>Invoice</th><th>Paid</th></tr></thead><tbody>${pos.map(p => { const g = grnFor(p.id), i = invFor(p.id); return `<tr><td>${esc(p.id)} · ${inr(p.amount)}</td><td>${esc(p.approvedBy || 'Pending')}</td><td>${g ? esc(g.id) + ' · ' + fdate(g.date) : '—'}</td><td>${i ? esc(i.number) : '—'}</td><td>${i && i.paidOn ? fdate(i.paidOn) : '—'}</td></tr>`; }).join('') || '<tr><td colspan="5">No purchases.</td></tr>'}</tbody></table>`;
}

V.privacy = () => {
  const proc = S.vendors.filter(v => v.handlesPersonalData);
  return head('Privacy (DPDP Act 2023)', 'The hospital is the Data Fiduciary; every vendor that touches patient or staff data is a Data Processor. POs are blocked for a processor without a signed addendum. Breaches: intimate the Data Protection Board without delay, then a detailed report within 72 hours.',
    can('privacy') ? '<button class="btn primary" data-act="newIncident">Log incident</button>' : '') +
    `<div class="card"><h2>Incident register</h2>${S.incidents.length ? `<div class="scroll"><table class="stack"><thead><tr><th>Incident</th><th>Vendor</th><th>Detected</th><th>72-hour clock</th><th>Board intimated</th><th>Detailed report</th><th>Individuals notified</th></tr></thead><tbody>
    ${S.incidents.map(x => { const k = incidentClock(x), v = vendor(x.vendorId);
      const step = (f, label) => x[f] ? '<span class="b ok">Done</span>' : can('privacy') ? `<button class="btn sm" data-act="incStep" data-id="${x.id}" data-f="${f}">${label}</button>` : '<span class="b warn">Pending</span>';
      return `<tr><td><b>${esc(x.id)}</b> ${x.closed ? '<span class="b ok">Closed</span>' : ''}<br>${esc(x.title)}<br><span class="sub">${x.records} records · ref ${esc(x.hisRef)}</span></td><td>${esc(v ? v.name : 'Internal')}</td><td class="nowrap">${ftime(x.detected)}</td>
      <td>${x.reportFiled ? '<span class="b ok">Report filed</span>' : k.left > 0 ? `<span class="b ${k.left < 24 ? 'bad' : 'warn'}">${Math.round(k.left)} h left</span>` : `<span class="b bad">Overdue by ${Math.round(-k.left)} h</span>`}</td>
      <td>${step('boardIntimated', 'Mark intimated')}</td><td>${step('reportFiled', 'Mark filed')}</td><td>${step('individualsNotified', 'Mark notified')}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="empty">No incidents logged.</p>'}<p class="sub">Refer to patients only by their HIS reference number — never by name — so the vendor system holds no patient data.</p></div>
    <div class="card" style="margin-top:16px"><h2>Data processors</h2><div class="scroll"><table class="stack"><thead><tr><th>Vendor</th><th>Addendum</th><th>Hosting location</th><th>Sub-processors</th><th>Last security review</th><th>Privacy risk</th><th></th></tr></thead><tbody>
    ${proc.map(v => { const d = v.dpa || {}; const rev = d.lastReview ? days(d.lastReview) : null;
      return `<tr><td><a href="#vendor-${v.id}"><b>${esc(v.name)}</b></a><br>${statusBadge(v.status)}</td><td>${d.signed ? `<span class="b ok">Signed ${fdate(d.date)}</span>` : '<span class="b bad">Not signed — POs blocked</span>'}</td><td>${esc(d.hosting || '—')}</td><td>${esc(d.subprocessors || '—')}</td>
      <td>${d.lastReview ? fdate(d.lastReview) + (rev < -365 ? ' <span class="b warn">Over a year</span>' : '') : '<span class="b warn">None</span>'}</td><td><span class="b ${d.risk === 'Critical' ? 'bad' : 'warn'}">${esc(d.risk || '—')}</span></td>
      <td>${can('privacy') ? `<button class="btn sm" data-act="dpa" data-id="${v.id}">${d.signed ? 'Record review' : 'Record signed addendum'}</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
};

function auditTable(rows) {
  return rows.length ? `<div class="scroll"><table class="stack"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th></tr></thead><tbody>${rows.map(a => `<tr><td class="nowrap">${ftime(a.ts)}</td><td>${esc(a.role)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No entries yet.</p>';
}
V.audit = () => head('Audit trail', 'Every create, approve and change is logged with who and when — assessors check this, and DPDP needs logs of access to personal data kept for at least a year.') + `<div class="card">${auditTable(S.audit)}</div>`;

/* ---------- modal ---------- */
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
function modal(title, html, opts) {
  opts = opts || {};
  const m = $('#modal');
  m.innerHTML = `<div class="mbox ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mtitle"><form id="mform" novalidate><header><h2 id="mtitle">${esc(title)}</h2><button type="button" class="x" data-act="closeModal" aria-label="Close">×</button></header><div class="mbody">${html}</div><p class="ferr" id="ferr" role="alert"></p><footer><button type="button" class="btn" data-act="closeModal">Cancel</button>${opts.onSubmit ? `<button class="btn primary" type="submit">${esc(opts.submit || 'Save')}</button>` : ''}</footer></form></div>`;
  m.hidden = false;
  const f = $('#mform');
  f.addEventListener('submit', e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f));
    const r = opts.onSubmit(fd, f);
    if (typeof r === 'string') { $('#ferr').textContent = r; return; }
    closeModal(); save(); refresh(); if (r && r.toast) toast(r.toast);
  });
  if (opts.onMount) opts.onMount(f);
  const first = f.querySelector('input:not([type=hidden]),select,textarea'); if (first) first.focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

/* ---------- actions ---------- */
const A = {};
A.signin = d => { role = d.role; try { localStorage.setItem(RKEY, role); } catch (e) {} renderShell(); if (!location.hash) location.hash = 'dashboard'; refresh(); };
A.signout = () => { role = null; try { localStorage.removeItem(RKEY); } catch (e) {} renderLogin(); };
A.menu = () => $('#side').classList.toggle('open');
A.closeModal = closeModal;
A.openVendor = d => { location.hash = 'vendor-' + d.id; };
A.reset = () => modal('Reset demo data?', '<p>This puts every vendor, PO, invoice and log entry back to the starting sample data in this browser.</p>', { submit: 'Reset', onSubmit: () => { S = D.seed(); autoSuspend(); return { toast: 'Demo data reset' }; } });
A.print = () => { try { window.print(); } catch (e) { toast('Use your browser\'s Print command (Ctrl+P) to save as PDF'); } };
A.vendorFile = d => { ui.nabhVendor = d.id; location.hash = 'nabh'; };

A.newVendor = () => {
  const catOpts = Object.entries(CATS).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join('');
  modal('Register a vendor', `
    <label class="f">Vendor legal name<input name="name" required autocomplete="off"></label>
    <div class="two"><label class="f">Category<select name="category" id="fcat">${catOpts}</select></label><label class="f">City<input name="city" value="Bengaluru"></label></div>
    <div class="two"><label class="f">GSTIN<input name="gstin" maxlength="15" placeholder="29ABCDE1234F1Z5" style="text-transform:uppercase"></label><label class="f">PAN<input name="pan" maxlength="10" placeholder="ABCDE1234F" style="text-transform:uppercase"></label></div>
    <div class="two"><label class="f">Contact person<input name="cname"></label><label class="f">Contact email<input name="cemail" type="email"></label></div>
    <div class="two"><label class="f">MSME (Udyam) category<select name="msme"><option value="">Not MSME</option><option>Micro</option><option>Small</option><option>Medium</option></select></label><label class="f">Agreed payment term (days)<input name="term" type="number" min="0" max="180" value="30"></label></div>
    <label class="check"><input type="checkbox" name="pd" id="fpd"> Vendor will see patient or staff personal data (needs a DPDP data processing addendum)</label>
    <label class="check"><input type="checkbox" name="big" checked> Supplier turnover above ₹5 crore (e-invoice IRN required)</label>
    <div><h3>Mandatory documents</h3><p class="sub">Tick each document once received and checked. Expiry dates drive renewal reminders.</p><div class="doclist" id="fdocs"></div></div>`,
    { wide: true, submit: 'Submit for verification',
      onMount: f => { const draw = () => { const k = f.category.value; $('#fdocs').innerHTML = D.COMMON_DOCS.concat(CATS[k].docs).map((n, i) => `<div class="d"><label class="check"><input type="checkbox" data-doc="${i}"> ${esc(n)}</label>${i === 0 || i === 1 || i === 2 ? '<span class="sub">No expiry</span>' : `<input type="date" data-exp="${i}" value="${D.addDays(365)}" aria-label="Expiry date">`}</div>`).join(''); }; draw(); f.category.addEventListener('change', draw); },
      onSubmit: (x, f) => {
        if (!x.name.trim()) return 'Enter the vendor\'s legal name.';
        if (x.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/i.test(x.gstin.trim())) return 'GSTIN should be 15 characters, like 29ABCDE1234F1Z5.';
        if (x.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(x.pan.trim())) return 'PAN should be 10 characters, like ABCDE1234F.';
        const names = D.COMMON_DOCS.concat(CATS[x.category].docs);
        const docs = names.map((n, i) => { const e = f.querySelector(`[data-exp="${i}"]`); return { name: n, number: 'Pending', expiry: e ? e.value || null : null, verified: f.querySelector(`[data-doc="${i}"]`).checked }; });
        const all = docs.every(d => d.verified) && !x.pd;
        const n = S.vendors.length + 1, pre = { pharma: 'PH', device: 'MD', capital: 'CE', clinical: 'CS', it: 'IT', general: 'GF' }[x.category];
        const v = { id: 'V' + (100 + n), code: 'VEN-' + pre + '-' + String(n).padStart(4, '0'), name: x.name.trim(), category: x.category, city: x.city || '', contact: { name: x.cname || '', email: x.cemail || '', phone: '00000 00000' },
          gstin: (x.gstin || '').toUpperCase(), pan: (x.pan || 'XXXXX0000X').toUpperCase(), bank: { acc: '000000000000', ifsc: 'PENDING' }, msme: x.msme, paymentTerm: +x.term || 30, turnoverAbove5cr: !!x.big,
          handlesPersonalData: !!x.pd, dpa: x.pd ? { signed: false, date: null, hosting: 'Not stated', subprocessors: 'Not provided', lastReview: null, risk: x.category === 'it' ? 'Critical' : 'High' } : null,
          status: all ? 'Pending approval' : 'Pending verification', spend: 0, empanelledOn: null, contractEnd: null, docs, scores: [], evaluation: null };
        S.vendors.push(v); log('Registered vendor (' + v.status + ')', v.code);
        return { toast: v.name + ' added — ' + v.status.toLowerCase() };
      } });
};
A.verifyDoc = d => { const v = vendor(d.id), doc = v.docs[+d.i]; doc.verified = true; if (doc.number === 'Pending') doc.number = 'VER-' + Math.floor(1000 + Math.random() * 8999);
  log('Verified document: ' + doc.name, v.code);
  if (v.status === 'Pending verification' && v.docs.every(x => x.verified) && !(v.handlesPersonalData && !(v.dpa && v.dpa.signed))) { v.status = 'Pending approval'; log('Moved to committee approval', v.code); }
  save(); refresh(); toast('Document verified'); };
A.renewDoc = d => { const v = vendor(d.id), i = +d.i, doc = v.docs[i]; if (!doc) return;
  modal('Record renewed document', `<p><b>${esc(v.name)}</b> — ${esc(doc.name)}</p><label class="f">New document number<input name="num" value="${esc(doc.number)}"></label><label class="f">New expiry date<input name="exp" type="date" value="${D.addDays(365)}" required></label><label class="check"><input type="checkbox" name="ok" checked> Original seen and verified</label>`,
  { submit: 'Save renewal', onSubmit: x => { if (!x.exp || days(x.exp) <= 0) return 'Expiry must be a future date.'; if (!x.ok) return 'Verify the original before saving.';
    doc.number = x.num; doc.expiry = x.exp; doc.verified = true; log('Renewed document: ' + doc.name + ' to ' + fdate(x.exp), v.code);
    if (v.status === 'Suspended' && !blockers(Object.assign({}, v, { status: 'Active' })).length) { v.status = band(score(v)) === 'C' || band(score(v)) === 'D' ? 'Watch' : 'Active'; v.suspendReason = ''; log('Reinstated after document renewal', v.code); }
    return { toast: 'Renewal recorded' }; } }); };
A.renewContract = d => { const v = vendor(d.id), b = band(score(v)), crit = latest(v) && latest(v).critical;
  const alone = b === 'A' && !crit;
  if (!alone && !can('approveVendor')) { toast('Band ' + b + ' vendors need committee approval — only CEO/MS or purchase manager with committee can renew'); return; }
  modal('Renew contract', `<p><b>${esc(v.name)}</b> — band ${b || '—'} (${b ? BANDS[b].name : 'not scored'})</p>${b === 'D' ? '<div class="block bad">Band D: the policy is to replace this vendor, not renew.</div>' : ''}${b === 'C' ? '<div class="block warn">Band C: attach the corrective action plan and committee minutes.</div>' : ''}
    <label class="f">New contract end<input type="date" name="end" value="${D.addDays(365)}"></label><label class="f">Committee reference / notes<input name="note" placeholder="${alone ? 'Not required for band A' : 'e.g. PC minutes 14/2026'}"></label>`,
  { submit: 'Renew', onSubmit: x => { if (b === 'D') return 'Band D vendors cannot be renewed in this workflow.'; if (!alone && !x.note.trim()) return 'Add the committee reference.'; v.contractEnd = x.end; log('Renewed contract to ' + fdate(x.end) + (x.note ? ' (' + x.note + ')' : ''), v.code); return { toast: 'Contract renewed' }; } }); };
A.remind = d => { const v = vendor(d.id); log('Renewal reminder sent: ' + d.item, v.code); save(); refresh(); toast('Reminder logged for ' + v.contact.email + ' (demo — no email is sent)'); };
A.approveVendor = d => { const v = vendor(d.id); const e = v.evaluation || { quality: 0, price: 0, delivery: 0, references: 0 };
  const b = blockers(Object.assign({}, v, { status: 'Active' }));
  modal('Empanelment evaluation', `<p><b>${esc(v.name)}</b> · ${esc(CATS[v.category].name)}</p>${b.length ? `<div class="block bad">Cannot approve yet:<ul>${b.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <div class="two"><label class="f">Quality (out of 40)<input type="number" name="quality" min="0" max="40" value="${e.quality}"></label><label class="f">Price (out of 30)<input type="number" name="price" min="0" max="30" value="${e.price}"></label></div>
    <div class="two"><label class="f">Delivery capacity (out of 15)<input type="number" name="delivery" min="0" max="15" value="${e.delivery}"></label><label class="f">References (out of 15)<input type="number" name="references" min="0" max="15" value="${e.references}"></label></div>
    <p class="sub">Total must be 60 or more. The approval is recorded against your role.</p>`,
  { submit: 'Approve & issue vendor code', onSubmit: x => { if (b.length) return 'Resolve the blockers first.'; const ev = { quality: +x.quality, price: +x.price, delivery: +x.delivery, references: +x.references };
    if (ev.quality > 40 || ev.price > 30 || ev.delivery > 15 || ev.references > 15) return 'A score is above its maximum.';
    const t = ev.quality + ev.price + ev.delivery + ev.references; if (t < 60) return `Total is ${t}/100 — below the 60 needed to empanel.`;
    v.evaluation = ev; v.status = 'Active'; v.empanelledOn = isoToday(); v.contractEnd = D.addDays(365); log(`Approved empanelment (${t}/100)`, v.code); return { toast: v.name + ' empanelled — vendor code ' + v.code }; } }); };
A.setStatus = d => { const v = vendor(d.id);
  modal(d.s === 'Exited' ? 'Exit vendor' : d.s === 'Suspended' ? 'Suspend vendor' : 'Reinstate vendor', `<p><b>${esc(v.name)}</b> → ${esc(d.s)}</p><label class="f">Reason (recorded in the audit trail)<input name="why" required></label>`,
  { submit: 'Confirm', onSubmit: x => { if (!x.why.trim()) return 'Give a reason.'; if (d.s === 'Active' && blockers(Object.assign({}, v, { status: 'Active' })).length) return 'Documents are still expired or unverified — renew them first.';
    v.status = d.s; v.suspendReason = d.s === 'Suspended' ? x.why : ''; log(d.s + ': ' + x.why, v.code); return { toast: v.name + ' is now ' + d.s }; } }); };
A.rateVendor = d => { const v = vendor(d.id), l = latest(v); if (!l) return toast('No scorecard yet for this vendor');
  modal('Rate ' + v.name, `<p class="sub">Your rating feeds the Service dimension (30% of the score comes from structured user ratings).</p>
    <label class="f">Service and responsiveness this quarter<select name="r"><option value="5">5 — excellent</option><option value="4" selected>4 — good</option><option value="3">3 — acceptable</option><option value="2">2 — poor</option><option value="1">1 — unacceptable</option></select></label><label class="f">Comment<input name="c"></label>`,
  { submit: 'Submit rating', onSubmit: x => { const before = qScore(l); l.service = Math.round((l.service * 3 + (+x.r) * 20) / 4); log(`Rated ${x.r}/5${x.c ? ' — ' + x.c : ''}`, v.code); return { toast: `Score ${before} → ${qScore(l)}` }; } }); };

A.newPO = () => {
  const vs = S.vendors.filter(v => v.empanelledOn && v.status !== 'Exited');
  modal('New purchase order', `
    <label class="f">Vendor<select name="vendor" id="pov"><option value="">Choose…</option>${vs.map(v => `<option value="${v.id}">${esc(v.name)}${blockers(v).length ? ' — blocked' : ''}</option>`).join('')}</select></label>
    <div id="poblk"></div>
    <label class="f">Item / service<input name="desc" required></label>
    <div class="two"><label class="f">Quantity<input name="qty" type="number" min="1" value="1"></label><label class="f">Rate (₹, contract rate)<input name="rate" type="number" min="1" value="1000"></label></div>
    <label class="f">Expected delivery<input name="exp" type="date" value="${D.addDays(7)}"></label>
    <p class="sub" id="poamt"></p>`,
  { submit: 'Raise PO', onMount: f => {
      const upd = () => { const a = (+f.qty.value || 0) * (+f.rate.value || 0), l = poLevel(a); $('#poamt').textContent = `Amount ${inr(a)} · approval ${l.lvl} by ${l.who}`;
        const v = vendor(f.vendor.value), b = v ? blockers(v) : []; $('#poblk').innerHTML = b.length ? `<div class="block bad"><b>This vendor cannot receive a PO</b><ul>${b.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : v ? `<div class="block ok">Cleared — ${bandBadge(v)}</div>` : ''; };
      ['input', 'change'].forEach(ev => f.addEventListener(ev, upd)); upd(); },
    onSubmit: x => { const v = vendor(x.vendor); if (!v) return 'Choose a vendor.'; const b = blockers(v); if (b.length) { log('PO blocked by system — ' + b[0], v.code); save(); return 'Blocked: ' + b[0] + '. The attempt has been logged.'; }
      if (!x.desc.trim()) return 'Describe the item or service.'; const qty = +x.qty, rate = +x.rate; if (!(qty > 0 && rate > 0)) return 'Enter quantity and rate.';
      const p = { id: nextId('PO'), vendorId: v.id, date: isoToday(), desc: x.desc.trim(), qty, rate, amount: qty * rate, status: 'Pending approval', raisedBy: R().name, approvedBy: null, expected: x.exp || D.addDays(7) };
      S.pos.push(p); log('Raised purchase order ' + inr(p.amount), p.id); return { toast: p.id + ' sent for ' + poLevel(p.amount).lvl + ' approval' }; } });
};
A.approvePO = d => { const p = po(d.id); if (!canApprovePO(p)) return; const b = blockers(vendor(p.vendorId)); if (b.length) { toast('Vendor is now blocked: ' + b[0]); return; } p.status = 'Approved'; p.approvedBy = R().name; log('Approved purchase order', p.id); save(); refresh(); toast(p.id + ' approved and sent to vendor'); };
A.rejectPO = d => { const p = po(d.id); p.status = 'Rejected'; log('Rejected purchase order', p.id); save(); refresh(); toast(p.id + ' rejected'); };

A.newGRN = d => { const p = po(d.id), v = vendor(p.vendorId), med = v.category === 'pharma' || v.category === 'device';
  modal('Record goods receipt — ' + p.id, `<p><b>${esc(v.name)}</b> · ${esc(p.desc)} · ordered ${p.qty}</p>
    <div class="two"><label class="f">Quantity received<input name="rec" type="number" min="0" value="${p.qty}"></label><label class="f">Rejected at inspection<input name="rej" type="number" min="0" value="0"></label></div>
    <div class="two"><label class="f">Received on<input name="date" type="date" value="${isoToday()}"></label>${med ? '<label class="f">Shelf life remaining (months)<input name="shelf" type="number" min="0" value="18"></label>' : ''}</div>`,
  { submit: 'Save GRN', onSubmit: x => { const rec = +x.rec, rej = +x.rej; if (rec <= 0) return 'Enter the quantity received.'; if (rej > rec) return 'Rejected cannot exceed received.'; if (rec > p.qty) return 'Received is more than ordered — raise an amendment first.';
    const g = { id: nextId('GRN'), poId: p.id, date: x.date || isoToday(), qtyReceived: rec, qtyRejected: rej, onTime: (x.date || isoToday()) <= p.expected, shelfLifeMonths: med ? +x.shelf : null, by: R().name };
    S.grns.push(g); p.status = 'Received'; log('Recorded goods receipt for ' + p.id, g.id);
    const l = latest(v); if (l) { if (!g.onTime) l.delivery = Math.max(0, l.delivery - 2); if (rej) l.quality = Math.max(0, l.quality - Math.min(5, Math.ceil(rej / rec * 100))); }
    return { toast: g.id + ' saved' + (med && +x.shelf < 6 ? ' — short shelf life flagged' : '') + (!g.onTime ? ' — late delivery recorded' : '') }; } }); };

A.newInvoice = d => { const p = po(d.id), v = vendor(p.vendorId), g = grnFor(p.id);
  modal('Enter invoice for ' + p.id, `<p><b>${esc(v.name)}</b> · PO rate ${inr(p.rate)} · accepted qty ${g.qtyReceived - g.qtyRejected}</p>
    <div class="two"><label class="f">Vendor invoice number<input name="num" required></label><label class="f">Invoice date<input name="date" type="date" value="${isoToday()}"></label></div>
    <div class="two"><label class="f">Quantity billed<input name="qty" type="number" value="${g.qtyReceived - g.qtyRejected}"></label><label class="f">Rate billed (₹)<input name="rate" type="number" value="${p.rate}"></label></div>
    <label class="f">E-invoice IRN ${v.turnoverAbove5cr ? '(required)' : '(not required)'}<input name="irn" placeholder="64-character IRN"></label>`,
  { submit: 'Save invoice', onSubmit: x => { if (!x.num.trim()) return 'Enter the invoice number.'; const i = { id: nextId('INV'), poId: p.id, vendorId: v.id, number: x.num.trim(), date: x.date, qty: +x.qty, rate: +x.rate, irn: x.irn.trim(), status: 'Entered', paidOn: null };
    S.invoices.push(i); p.status = 'Invoiced'; log('Entered invoice ' + i.number, i.id); const m = matchOf(i); return { toast: m.ok ? 'Invoice matched PO and GRN' : 'Invoice on hold — ' + m.reasons[0] }; } }); };
A.fixInvoice = d => { const i = S.invoices.find(x => x.id === d.id), m = matchOf(i), p = po(i.poId);
  modal('Resolve hold — ' + i.id, `<div class="block bad"><ul>${m.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
    <p class="sub">In practice: ask the vendor for a credit note or revised invoice, then record it here.</p>
    <div class="two"><label class="f">Corrected quantity<input name="qty" type="number" value="${i.qty}"></label><label class="f">Corrected rate (₹)<input name="rate" type="number" value="${i.rate}"></label></div>
    <label class="f">E-invoice IRN<input name="irn" value="${esc(i.irn)}" placeholder="IRN from the revised e-invoice"></label><p class="sub">PO rate is ${inr(p.rate)}.</p>`,
  { submit: 'Save correction', onSubmit: x => { i.qty = +x.qty; i.rate = +x.rate; i.irn = x.irn.trim(); log('Recorded credit note / revised invoice', i.id); const r = matchOf(i); return { toast: r.ok ? 'Now matched — ready to prepare payment' : 'Still on hold — ' + r.reasons[0] }; } }); };
A.preparePay = d => { const i = S.invoices.find(x => x.id === d.id); if (!matchOf(i).ok) return; i.status = 'Prepared'; log('Prepared payment', i.id); save(); refresh(); toast('Payment prepared — waiting for finance approval'); };
A.approvePay = d => { const i = S.invoices.find(x => x.id === d.id); if (!matchOf(i).ok || invAmount(i) > R().payLimit) return; i.status = 'Paid'; i.paidOn = isoToday(); const p = po(i.poId); if (p) p.status = 'Closed'; log('Approved and released payment ' + inr(invAmount(i)), i.id); save(); refresh(); toast('Paid — would post to Tally as a payment voucher'); };

A.newIncident = () => { const proc = S.vendors.filter(v => v.handlesPersonalData);
  modal('Log a privacy incident', `<label class="f">Vendor involved<select name="v"><option value="">Internal / none</option>${proc.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select></label>
    <label class="f">What happened (no patient names)<input name="t" required></label><div class="two"><label class="f">Records affected<input name="n" type="number" min="0" value="1"></label><label class="f">HIS reference<input name="ref" placeholder="HIS-EVT-…"></label></div>`,
  { submit: 'Log incident', onSubmit: x => { if (!x.t.trim()) return 'Describe what happened.'; const inc = { id: 'INC-' + String(S.incidents.length + 1).padStart(3, '0'), vendorId: x.v || null, title: x.t.trim(), detected: new Date().toISOString(), records: +x.n, hisRef: x.ref || '—', boardIntimated: false, reportFiled: false, individualsNotified: false, closed: false };
    S.incidents.unshift(inc); log('Logged privacy incident', inc.id); if (x.v) { const l = latest(vendor(x.v)); if (l) l.critical = true; } return { toast: '72-hour clock started for ' + inc.id }; } }); };
A.incStep = d => { const x = S.incidents.find(i => i.id === d.id); x[d.f] = true; if (x.boardIntimated && x.reportFiled && x.individualsNotified) x.closed = true; log({ boardIntimated: 'Intimated Data Protection Board', reportFiled: 'Filed detailed report', individualsNotified: 'Notified affected individuals' }[d.f], x.id); save(); refresh(); };
A.dpa = d => { const v = vendor(d.id); const p = v.dpa || {};
  modal('Data processing addendum — ' + v.name, `<label class="f">Signed on<input type="date" name="date" value="${p.date || isoToday()}"></label><label class="f">Data hosting location<input name="host" value="${esc(p.hosting && p.hosting !== 'Not stated' ? p.hosting : 'India')}"></label><label class="f">Sub-processors<input name="sub" value="${esc(p.subprocessors && p.subprocessors !== 'Not provided' ? p.subprocessors : '')}"></label><label class="check"><input type="checkbox" name="rev" checked> Security questionnaire and evidence reviewed today</label>`,
  { submit: 'Save', onSubmit: x => { if (!x.host.trim()) return 'Record where the data is hosted.'; v.dpa = Object.assign({}, p, { signed: true, date: x.date, hosting: x.host, subprocessors: x.sub, lastReview: x.rev ? isoToday() : p.lastReview, risk: p.risk || 'High' }); log('Recorded signed data processing addendum', v.code);
    if (v.status === 'Pending verification' && v.docs.every(z => z.verified)) { v.status = 'Pending approval'; log('Moved to committee approval', v.code); } return { toast: 'Addendum recorded' }; } }); };

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.closest('#modal') && b.dataset.act !== 'closeModal') return;
  e.preventDefault(); const f = A[b.dataset.act]; if (f) f(b.dataset, b);
});
document.addEventListener('input', e => {
  if (e.target.id === 'vq') { ui.vq = e.target.value; const pos = e.target.selectionStart; draw(); const n = $('#vq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'vcat') { ui.vcat = e.target.value; draw(); }
  if (id === 'vstatus') { ui.vstatus = e.target.value; draw(); }
  if (id === 'scat') { ui.scat = e.target.value; draw(); }
  if (id === 'nabhV') { ui.nabhVendor = e.target.value; draw(); }
});
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

/* ---------- router ---------- */
function current() { return location.hash.slice(1) || 'dashboard'; }
function draw() {
  const h = current();
  const html = h.startsWith('vendor-') ? V.vendor(h.slice(7)) : (V[h] || V.dashboard)();
  $('#view').innerHTML = html;
  document.querySelectorAll('#view table.stack').forEach(t => { const hd = [...t.querySelectorAll('thead th')].map(th => th.textContent); t.querySelectorAll('tbody tr').forEach(r => [...r.cells].forEach((c, i) => { if (hd[i]) c.dataset.l = hd[i]; })); });
  renderNav(h);
}
function refresh() { if (!role) return renderLogin(); if (!$('#view')) renderShell(); draw(); }
window.addEventListener('hashchange', () => { if (!role) return; const s = $('#side'); if (s) s.classList.remove('open'); draw(); window.scrollTo(0, 0); });

load(); autoSuspend(); save();
if (role) { renderShell(); refresh(); } else renderLogin();
}
