/* Lifely 2.0 – Prototyp. Eine Frage pro Woche, Wegweiser, Mein Kreis, Notfallpaket.
   Alles bleibt auf dem Gerät (localStorage). Kein Konto, kein Server. */
const $app = document.getElementById('app');
const DAY = 864e5, WEEK = 7 * DAY;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const fmt = (ts) => new Date(ts).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
const months = (ts) => (Date.now() - ts) / (30.4 * DAY);

/* ---------- Zustand ---------- */
const KEY = 'lifely2';
const blank = () => ({ setup: false, name: '', size: 'normal', lang: 'de', start: Date.now(), qi: 0, qSince: Date.now(),
  answers: {}, skipped: [], guide: {}, papiere: '', coach: [], kreis: [], lastExport: 0, changed: 0 });
let S = (() => { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY))); } catch { return blank(); } })();
const save = (changed = true) => { if (changed) S.changed = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const applySize = () => (document.documentElement.dataset.size = S.size);
const g = (id) => (S.guide[id] = S.guide[id] || {});

/* ---------- Hilfsfunktionen ---------- */
let toastT;
function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 5500); t.onclick = () => (t.hidden = true);
}
function sheet(html, onClick) {
  const el = document.createElement('div'); el.className = 'backdrop';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) return el.remove(); onClick?.(e, el); });
  document.body.appendChild(el); el.querySelector('button, a, input')?.focus();
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') el.remove(); });
  addEventListener('hashchange', () => el.remove(), { once: true });
  return el;
}
const confirmSheet = (title, text, ok) => new Promise(res => sheet(`<h2>${esc(title)}</h2><p class="lead">${esc(text)}</p>
  <div class="stack"><button class="btn danger" data-ok>${esc(ok)}</button><button class="btn ghost" data-close>Abbrechen</button></div>`,
  (e, el) => { if (e.target.closest('[data-ok]')) { el.remove(); res(true); } }));
const back = (to, label) => `<button class="back" data-go="${to}">${svg('back')}${esc(label)}</button>`;
const initial = (n) => (n || '?').trim()[0]?.toUpperCase() || '?';
const phoneIntl = (p) => { const d = String(p || '').replace(/[^\d+]/g, ''); return d.startsWith('+') ? d.slice(1) : d.startsWith('00') ? d.slice(2) : d.startsWith('0') ? '41' + d.slice(1) : d; };

/* ---------- Wochenfrage ---------- */
const Q = () => QUESTIONS[S.qi];
const answered = (n) => !!S.answers[n];
function advanceWeek() { // neue Woche: nächste Frage, sobald die alte beantwortet oder übersprungen ist
  const q = Q();
  if (q && (answered(q.n) || S.skipped.includes(q.n)) && Date.now() - S.qSince >= WEEK && S.qi < QUESTIONS.length - 1) { S.qi++; S.qSince = Date.now(); save(false); }
}
function nextQuestionNow() { if (S.qi < QUESTIONS.length - 1) { S.qi++; S.qSince = Date.now(); save(false); } }

/* ---------- Wegweiser-Status ---------- */
const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;
function status(item, src = S) {
  const d = src.guide?.[item.id] || {};
  if (item.person) return d.person ? (d.informed ? ['ok', 'Geregelt', `${d.person} · informiert ✓`] : ['warn', 'Offen', `${d.person} · noch nicht informiert`]) : ['warn', 'Offen', 'Noch niemand bestimmt'];
  if (item.list) {
    const it = d.items || [];
    if (it.length) return ['ok', 'Geregelt', `${plural(it.length, item.unit)}: ${it.map(x => x.name).join(', ')}`];
    return d.none ? ['ok', 'Geregelt', 'Keine vorhanden'] : ['warn', 'Offen', 'Noch nichts eingetragen'];
  }
  if (d.has !== 'ja') return ['warn', 'Offen', d.has === 'nein' ? (item.coach ? 'Noch nicht vorhanden · Coach starten' : 'Noch nicht vorhanden') : 'Noch nicht erfasst'];
  const where = d.where || src.papiere;
  if (!where) return ['warn', 'Offen', 'Fundort fehlt'];
  if (item.review && d.checked && months(d.checked) > item.review) return ['due', 'Prüfen', `Zuletzt geprüft ${new Date(d.checked).getFullYear()}`];
  return ['ok', 'Geregelt', `Original: ${where}${d.copy ? ' · Kopie: ' + d.copy : ''}`];
}
const guideDone = () => GUIDE.filter(i => status(i)[0] === 'ok').length;

/* ---------- Wegweiser-Formulare (im Wegweiser und direkt in der Wochenfrage) ---------- */
const docForm = (item, d) => `<fieldset class="field"><legend>Gibt es das bei Ihnen?</legend><div class="seg" role="group">${[['ja', 'Ja'], ['nein', 'Nein'], ['?', 'Weiss nicht']].map(([v, l]) => `<button type="button" data-has="${v}" aria-pressed="${d.has === v}">${l}</button>`).join('')}</div></fieldset>
  <div class="docmore stack" ${d.has === 'ja' ? '' : 'hidden'}>
    <label class="field">Wo liegt das Original?<input class="in" id="where" value="${esc(d.where || '')}" placeholder="${esc(S.papiere || 'z. B. blauer Ordner')}"></label>
    <label class="field">Wer hat eine Kopie? <span class="opt">(freiwillig)</span><input class="in" id="copy" value="${esc(d.copy || '')}" placeholder="z. B. Hausarzt, Anna"></label>
    <label class="field">Wer weiss Bescheid? <span class="opt">(freiwillig)</span><input class="in" id="who" value="${esc(d.who || '')}" placeholder="z. B. Anna"></label>
  </div>
  ${item.coach ? `<p class="note docnein" ${d.has === 'nein' ? '' : 'hidden'}>${svg('pen')}<span>Kein Problem. Der Vorsorgeauftrag-Coach zeigt Ihnen Schritt für Schritt, wie es geht.</span></p>` : ''}`;
function bindDoc(root, d) {
  let has = d.has;
  root.querySelectorAll('[data-has]').forEach(b => b.onclick = () => {
    has = b.dataset.has; root.querySelectorAll('[data-has]').forEach(x => x.setAttribute('aria-pressed', x === b));
    root.querySelector('.docmore').hidden = has !== 'ja';
    const n = root.querySelector('.docnein'); if (n) n.hidden = has !== 'nein';
  });
  return () => ({ has, where: root.querySelector('#where').value.trim(), copy: root.querySelector('#copy').value.trim(), who: root.querySelector('#who').value.trim() });
}
function listBlock(item, d) {
  const L = item.list, items = d.items || [];
  return `<div class="list">${items.map((x, i) => `<div class="row"><span class="ico">${svg(item.icon)}</span><span class="m"><b>${esc(x.name)}</b><small>${esc(x.type)}${x.note ? ' · ' + esc(x.note) : ''}</small></span><button type="button" class="iconbtn" data-del="${i}" aria-label="${esc(x.name)} entfernen">${svg('trash')}</button></div>`).join('')}</div>
  ${item.id === 'konten' ? `<p class="note warn">${svg('lock')}<span>Nur <b>wo</b> Sie Konten haben. Nie Kontonummern, Passwörter oder PINs.</span></p>` : ''}
  <div class="card mint addbox stack"><b>${items.length ? 'Weitere hinzufügen' : 'Ersten Eintrag hinzufügen'}</b>
    <label class="field">Art<select class="in" id="ltype">${L.types.map(t => `<option>${t}</option>`).join('')}</select></label>
    <label class="field">${L.name[0]}<input class="in" id="lname" placeholder="${L.name[1]}"></label>
    <label class="field">${L.note[0]} <span class="opt">(freiwillig)</span><input class="in" id="lnote" placeholder="${L.note[1]}"></label>
    <button type="button" class="btn primary" id="ladd">${svg('plus')}Hinzufügen</button></div>
  ${!items.length ? `<label class="row switch"><span class="m"><b>Ich habe keine</b><small>Dann gilt dieser Punkt als erledigt.</small></span><input type="checkbox" id="lnone" ${d.none ? 'checked' : ''}><span class="sw" aria-hidden="true"></span></label>` : ''}`;
}
function bindList(root, item, d) {
  const box = root.querySelector('#lb');
  const redraw = (focus) => { box.innerHTML = listBlock(item, d); bindList(root, item, d); if (focus) box.querySelector('#lname').focus(); };
  box.querySelector('#ladd').onclick = () => {
    const name = box.querySelector('#lname').value.trim(); if (!name) return toast(`Bitte «${item.list.name[0]}» ausfüllen.`);
    (d.items = d.items || []).push({ type: box.querySelector('#ltype').value, name, note: box.querySelector('#lnote').value.trim() });
    d.none = false; save(); toast(`${name} hinzugefügt`); redraw(true);
  };
  box.querySelectorAll('#lname, #lnote').forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); box.querySelector('#ladd').click(); } }));
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { d.items.splice(+b.dataset.del, 1); save(); redraw(); });
  box.querySelector('#lnone')?.addEventListener('change', (e) => { d.none = e.target.checked; save(); });
}
const docSummary = (d) => d.has === 'ja' ? `Ja · Original: ${d.where || S.papiere || 'Fundort fehlt'}` : d.has === 'nein' ? 'Nein, noch nicht vorhanden' : 'Weiss nicht';

/* ---------- Mein Kreis ---------- */
const dueIn = (p) => Math.max(p.snooze || 0, (p.last || 0) + p.rhythm * DAY) - Date.now();
const dueList = () => S.kreis.filter(p => dueIn(p) <= 0).sort((a, b) => dueIn(a) - dueIn(b));
const rhythmLabel = (d) => (RHYTHMS.find(r => r[0] === d) || RHYTHMS[0])[1];
function topicFor(p) {
  const last = [...QUESTIONS].slice(0, S.qi + 1).reverse().find(q => (q.type === 'm' || q.type === 'w') && answered(q.n));
  if (last) return `Erzählen Sie ${p.name} von Ihrer Antwort auf «${last.text}»`;
  return `Fragen Sie ${p.name}: «${TOPICS[(p.name.length + S.qi) % TOPICS.length]}»`;
}
function contactButtons(p, small) {
  if (!p.phone) return `<button class="btn ghost" data-go="person/${p.id}">${svg('phone')}Telefonnummer ergänzen</button>`;
  const intl = phoneIntl(p.phone);
  const text = encodeURIComponent(`Hallo ${p.name}, ich habe gerade an dich gedacht. Hast du bald Zeit für einen Schwatz?`);
  return `<div class="actions3 ${small ? 'small' : ''}">
    <a class="btn primary" href="tel:${esc(p.phone)}" data-contact="${p.id}">${svg('phone')}Anrufen</a>
    <a class="btn ghost" href="https://wa.me/${intl}?text=${text}" target="_blank" rel="noopener" data-contact="${p.id}">${svg('chat')}WhatsApp</a>
    <a class="btn ghost" href="sms:${esc(p.phone)}?&body=${text}" data-contact="${p.id}">${svg('mail')}SMS</a></div>`;
}
function markContact(id) {
  const p = S.kreis.find(x => x.id === id); if (!p) return;
  p.last = Date.now(); p.snooze = 0; save(false);
  setTimeout(() => { toast(`Schön! Nächste Erinnerung in ${{ 7: 'einer Woche', 14: '2 Wochen', 30: 'einem Monat' }[p.rhythm] || 'einer Woche'}.`); render(); }, 600);
}
function dueCard(p) {
  return `<div class="card sun kreis-due">
    <p class="eb">Mein Kreis · heute</p>
    <p class="qt small">Heute wäre ein schöner Tag, ${esc(p.name)} anzurufen.</p>
    <p class="idea"><b>Gesprächsidee:</b> ${esc(topicFor(p))}</p>
    ${contactButtons(p)}
    <div class="later"><button class="link" data-snooze="${p.id}" data-days="1">Später</button> · <button class="link" data-snooze="${p.id}" data-days="7">Diese Woche nicht</button></div>
  </div>`;
}

/* ---------- Navigation ---------- */
const routes = {};
const TAB = { heute: 'heute', frage: 'heute', kreis: 'heute', person: 'heute', wegweiser: 'wegweiser', unterlage: 'wegweiser', coach: 'wegweiser',
  assistent: 'assistent', geschichte: 'geschichte', notfall: 'notfall', paket: 'notfall', oeffnen: 'notfall', ansicht: 'notfall', profil: 'heute', sicherheit: 'heute' };
function go(path) { if (location.hash.slice(1) === path) render(); else location.hash = path; }
function render() {
  if (location.hash.slice(1) !== 'heute') { document.getElementById('tour')?.remove(); document.body.classList.remove('touring'); }
  let [name, arg] = location.hash.slice(1).split('/');
  if (!S.setup && name !== 'setup' && name !== 'ansicht' && name !== 'oeffnen') name = 'setup';
  if (!routes[name] || (name === 'setup' && S.setup)) name = S.setup ? 'heute' : 'setup';
  advanceWeek();
  const tab = S.setup ? TAB[name] : null;
  document.body.classList.toggle('has-tabs', !!tab);
  renderTabs(tab);
  routes[name](arg ? decodeURIComponent(arg) : undefined);
  window.scrollTo(0, 0);
  const h = $app.querySelector('h1'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}
addEventListener('hashchange', render);
function renderTabs(active) {
  let bar = document.getElementById('tabbar');
  if (!active) return bar?.remove();
  if (!bar) { bar = document.createElement('nav'); bar.id = 'tabbar'; bar.setAttribute('aria-label', 'Hauptnavigation'); document.body.appendChild(bar); }
  const t = (id, icon, label) => `<button data-go="${id}" ${active === id ? 'aria-current="page"' : ''}>${svg(icon)}<span>${label}</span></button>`;
  bar.innerHTML = t('heute', 'home', 'Heute') + t('wegweiser', 'pin', 'Wegweiser') +
    `<button class="mid" data-go="assistent" ${active === 'assistent' ? 'aria-current="page"' : ''}><span class="orb">${svg('spark')}</span><span>Assistent</span></button>` +
    t('geschichte', 'book', 'Geschichte') + t('notfall', 'sos', 'Notfall');
}
document.addEventListener('click', (e) => {
  const gTo = e.target.closest('[data-go]'); if (gTo) { e.preventDefault(); return go(gTo.dataset.go); }
  const c = e.target.closest('[data-contact]'); if (c) markContact(c.dataset.contact);
  const sn = e.target.closest('[data-snooze]');
  if (sn) { const p = S.kreis.find(x => x.id === sn.dataset.snooze); p.snooze = Date.now() + sn.dataset.days * DAY; save(false); toast(sn.dataset.days === '1' ? 'Gut, morgen wieder.' : 'Gut, nächste Woche wieder.'); render(); }
});

/* ---------- Einrichten (zu zweit) ---------- */
const setupData = (S.draft = S.draft || {});
routes.setup = (step = '0') => {
  step = +step;
  const steps = 5;
  const head = step ? `<div class="top">${back('setup/' + (step - 1), 'Zurück')}<span class="muted">Schritt ${step} von ${steps}</span></div><div class="dots">${Array.from({ length: steps }, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('')}</div>` : '';
  let body = '';
  if (step === 0) body = `<div class="welcome">
      <div class="wm big"><img src="logo.svg" alt="">Lifely</div>
      <div class="pair"><span class="av sun">?</span><span class="av mint">${svg('heart')}</span></div>
      <h1 class="center">Eine Frage pro Woche. Und im Ernstfall weiss jemand Bescheid.</h1>
      <p class="lead center">Sie erzählen in fünf Minuten pro Woche, was Ihnen wichtig ist. Lifely ordnet daraus Ihren Wegweiser für den Ernstfall.</p>
      <div class="note">${svg('lock')}<span>Alles bleibt auf diesem Gerät. Kein Konto, keine Werbung, gratis.</span></div>
      <div class="stack"><button class="btn primary" data-go="setup/1">Los geht's</button>
      <button class="btn ghost" id="together">Mit jemandem zusammen einrichten</button>
      <button class="link" id="demo">Beispiel ansehen (Demo mit Margrit)</button></div>
      <p class="fine center">Prototyp einer Projektarbeit der BFH · bitte nur Testdaten</p></div>`;
  if (step === 1) body = `<h1>Welche Sprache möchten Sie?</h1><div class="stack" role="radiogroup">
      ${[['de', 'Deutsch'], ['fr', 'Français'], ['it', 'Italiano'], ['en', 'English']].map(([id, l]) => `<button class="choice" role="radio" aria-checked="${S.lang === id}" data-lang="${id}" ${id !== 'de' ? 'disabled' : ''}>${l}${id !== 'de' ? '<small>folgt bald</small>' : ''}</button>`).join('')}
    </div><div class="bottom"><button class="btn primary" data-go="setup/2">Weiter</button></div>`;
  if (step === 2) body = `<h1>Wie dürfen wir Sie ansprechen?</h1><p class="lead">Ihr Vorname genügt.</p>
    <form id="f" class="stack"><label class="field">Vorname<input class="in" id="name" autocomplete="given-name" value="${esc(S.name)}" placeholder="z. B. Margrit"></label>
    <div class="bottom"><button class="btn primary">Weiter</button></div></form>`;
  if (step === 3) body = `<h1>Wer hilft Ihnen dabei?</h1><p class="lead">Zum Beispiel Ihre Tochter oder Ihr Sohn. Diese Person kommt in «Mein Kreis» und weiss im Ernstfall Bescheid.</p>
    <form id="f" class="stack"><label class="field">Name<input class="in" id="hname" value="${esc(setupData.hname || '')}" placeholder="z. B. Anna"></label>
    <label class="field">Beziehung<select class="in" id="hrel">${RELATIONS.map(r => `<option ${setupData.hrel === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <label class="field">Telefon <span class="opt">(freiwillig)</span><input class="in" id="hphone" inputmode="tel" value="${esc(setupData.hphone || '')}" placeholder="z. B. 079 123 45 67"></label>
    <div class="bottom"><button class="btn primary">Weiter</button><button type="button" class="btn ghost" data-go="setup/4">Überspringen</button></div></form>`;
  if (step === 4) body = `<h1>Wie gut können Sie diesen Text lesen?</h1><p class="lead">Wählen Sie die Schrift, die für Sie angenehm ist.</p>
    ${sizeSeg()}<div class="bottom"><button class="btn primary" data-go="setup/5">Weiter</button></div>`;
  if (step === 5) body = `<h1>Ihre Daten bleiben bei Ihnen</h1>
    <ul class="checks"><li>${svg('phoneDev')}<span><b>Nur auf diesem Gerät.</b> Kein Konto, keine Cloud, kein Server.</span></li>
    <li>${svg('lock')}<span><b>Keine Passwörter.</b> Lifely fragt nie nach PINs oder Zugangsdaten.</span></li>
    <li>${svg('shield')}<span><b>Notfallpaket.</b> Für den Ernstfall eine verschlüsselte Datei, die nur Ihre Vertrauensperson mit dem Passwort öffnen kann.</span></li>
    <li>${svg('heart')}<span><b>Kein Rechtsdokument.</b> Lifely ist ein Wegweiser und ersetzt keine Beratung.</span></li></ul>
    <div class="bottom"><button class="btn primary" id="finish">Einverstanden, erste Frage ansehen</button></div>`;
  const tip = setupData.together && step >= 2 && step <= 4 ? `<p class="note">${svg('people')}<span><b>Tipp für Angehörige:</b> Lassen Sie Ihre Mutter oder Ihren Vater selbst tippen. Sie helfen nur, wenn nötig.</span></p>` : '';
  $app.innerHTML = `<section class="screen setup">${head}${body}${tip}</section>`;
  const $ = (s) => $app.querySelector(s);
  $('#together')?.addEventListener('click', () => { setupData.together = true; save(false); go('setup/1'); });
  $('#demo')?.addEventListener('click', () => { loadDemo(); go('heute'); toast('Demo geladen: Sie sehen Lifely mit Margrits Beispieldaten.'); });
  $app.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { S.size = b.dataset.size; applySize(); save(false); render(); });
  $('#f')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step === 2) { const n = $('#name').value.trim(); if (!n) return toast('Bitte geben Sie Ihren Vornamen ein.'); S.name = n; save(); go('setup/3'); }
    if (step === 3) { setupData.hname = $('#hname').value.trim(); setupData.hrel = $('#hrel').value; setupData.hphone = $('#hphone').value.trim(); save(false); go('setup/4'); }
  });
  $('#finish')?.addEventListener('click', () => {
    if (setupData.hname && !S.kreis.some(p => p.name === setupData.hname)) S.kreis.push({ id: 'p' + Date.now(), name: setupData.hname, rel: setupData.hrel, phone: setupData.hphone, rhythm: 7, last: Date.now(), trust: true });
    delete S.draft; S.setup = true; S.tourDone = false; S.start = S.qSince = Date.now(); save(); go('heute');
  });
};
const sizeSeg = () => `<div class="seg" role="group" aria-label="Schriftgrösse">${[['normal', 'Normal'], ['gross', 'Gross'], ['sehr-gross', 'Sehr gross']].map(([v, l]) => `<button data-size="${v}" aria-pressed="${S.size === v}">${l}</button>`).join('')}</div>`;

/* ---------- Heute ---------- */
routes.heute = () => {
  const q = Q(), done = answered(q.n) || S.skipped.includes(q.n);
  const days = Math.max(1, Math.ceil((S.qSince + WEEK - Date.now()) / DAY));
  const due = dueList(), gd = guideDone();
  const next = GUIDE.find(i => status(i)[0] !== 'ok');
  const checks = GUIDE.filter(i => status(i)[0] === 'due');
  const hour = new Date().getHours(), hi = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Grüezi' : 'Guten Abend';
  const paketOld = S.lastExport && S.changed > S.lastExport;
  $app.innerHTML = `<section class="screen">
    <div class="top"><div class="wm"><img src="logo.svg" alt="">Lifely</div><button class="avatar" data-go="profil" aria-label="Profil und Einstellungen">${esc(initial(S.name))}</button></div>
    <h1 class="hello">${hi}, ${esc(S.name)}</h1><p class="lead">Schön, dass Sie da sind.</p>
    ${!done ? `<div class="card sun"><p class="eb">Frage der Woche · ${q.n} von 52</p><p class="qt">${esc(q.text)}</p>
        <button class="btn primary" data-go="frage">${svg('mic')}Antworten</button><p class="tiny center">ca. 5 Minuten · jederzeit überspringen</p></div>`
      : `<div class="card sun done"><p class="eb">Frage der Woche · ${q.n} von 52</p><p class="qt small">Diese Woche erledigt ${svg('check', 'okc')}</p>
        <p class="tiny">${S.qi >= QUESTIONS.length - 1 ? 'Sie haben alle 52 Fragen beantwortet. Danke!' : `Die nächste Frage kommt in ${days} ${days === 1 ? 'Tag' : 'Tagen'}.`}</p>${S.qi < 51 ? '<button class="link" id="nextq">Nächste Frage schon jetzt</button>' : ''}</div>`}
    ${due.length ? dueCard(due[0]) : ''}
    <button class="card plain" data-go="wegweiser"><div class="spread"><b>Wegweiser</b><span class="teal">${gd} von ${GUIDE.length} geregelt</span></div>
      <div class="bar"><i style="width:${Math.round(gd / GUIDE.length * 100)}%"></i></div><p class="tiny">${next ? `Als Nächstes: ${next.name} – ${status(next)[2]}` : 'Alles geregelt. Einmal im Jahr prüfen.'}</p></button>
    ${checks.map(i => `<button class="row" data-go="unterlage/${i.id}"><span class="ico coral">${svg('bell')}</span><span class="m"><b>${i.name} prüfen</b><small>Zuletzt geprüft vor über ${i.review / 12} Jahren</small></span></button>`).join('')}
    ${paketOld ? `<button class="row" data-go="paket/1"><span class="ico coral">${svg('lock')}</span><span class="m"><b>Notfallpaket erneuern</b><small>Seit dem letzten Mal hat sich etwas geändert</small></span></button>` : ''}
    <button class="row" data-go="kreis"><span class="ico">${svg('people')}</span><span class="m"><b>Mein Kreis</b><small>${S.kreis.length ? S.kreis.map(p => esc(p.name)).join(' · ') : 'Menschen, die Ihnen wichtig sind'}</small></span>${due.length ? `<span class="chip warn">${due.length}</span>` : svg('chev', 'chev')}</button>
  </section>`;
  $app.querySelector('#nextq')?.addEventListener('click', () => { nextQuestionNow(); render(); });
  if (!S.tourDone && !document.getElementById('tour')) setTimeout(() => startTour(0), 350);
};

/* ---------- Antwort geben ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
routes.frage = (n) => {
  const q = n ? QUESTIONS[+n - 1] : Q(); if (!q) return go('heute');
  const a = S.answers[q.n] || {};
  const item = (q.type === 'l' || q.type === 'f') ? GUIDE.find(i => i.id === q.target) : null; // füllt den Wegweiser direkt
  const toggle = { f: ['Im Wegweiser eintragen?', 'Dann weiss Ihre Vertrauensperson, wo Ihre Papiere liegen.'], v: ['Im Wegweiser eintragen?', 'Danach hilft Ihnen der Coach beim Vorsorgeauftrag.'], k: ['Danach «Mein Kreis» öffnen?', 'Dort hinterlegen Sie die Person mit Telefonnummer.'] }[q.type];
  let body;
  if (item?.list) body = `<p class="tag-wg">${svg('pin')}Kommt direkt in Ihren Wegweiser</p><p class="lead">Tragen Sie alles ein, was Ihnen einfällt. Später können Sie im Wegweiser jederzeit ergänzen.</p><div id="lb">${listBlock(item, g(item.id))}</div>`;
  else if (item) body = `<p class="tag-wg">${svg('pin')}Kommt direkt in Ihren Wegweiser</p><div class="stack" id="doc">${docForm(item, g(item.id))}</div>`;
  else body = `${SR ? `<div class="micwrap"><button class="mic" id="mic" aria-pressed="false" aria-label="Antwort sprechen">${svg('mic')}</button>
      <p class="center"><b id="micLabel">Tippen und sprechen</b></p><p class="tiny center">oder schreiben Sie Ihre Antwort</p></div>` : `<p class="tiny">Tipp: Mit dem Mikrofon auf der Tastatur können Sie die Antwort auch sprechen.</p>`}
    <textarea class="in" id="txt" rows="5" placeholder="Ihre Antwort …">${esc(a.text || '')}</textarea>
    ${q.type === 'v' ? `<label class="field" style="margin-top:14px">Name der Person <span class="opt">(für den Wegweiser)</span><input class="in" id="vname" value="${esc(S.guide.vertretung?.person || '')}" placeholder="z. B. Anna Muster"></label>` : ''}
    ${toggle ? `<label class="row switch"><span class="m"><b>${toggle[0]}</b><small>${toggle[1]}</small></span><input type="checkbox" id="tog" checked><span class="sw" aria-hidden="true"></span></label>` : ''}
    ${q.type === 'w' ? '<p class="tiny">Diese Antwort kommt auf Ihre Gesprächskarte «Das ist mir wichtig». Sie ist keine Verfügung.</p>' : ''}`;
  $app.innerHTML = `<section class="screen answer">
    <div class="top">${back('heute', 'Woche ' + q.n)}</div>
    <p class="eb">Frage der Woche</p>
    <h1 class="qt big">${esc(q.text)}</h1>
    ${body}
    <div class="bottom"><button class="btn primary" id="save">${item ? 'Fertig' : 'Antwort speichern'}</button>
      <button class="btn ghost" id="skip">${answered(q.n) ? 'Zurück ohne Änderung' : 'Diese Frage überspringen'}</button></div>
  </section>`;
  const txt = $app.querySelector('#txt');
  if (SR && txt) {
    let rec = null; const mic = $app.querySelector('#mic'), lab = $app.querySelector('#micLabel');
    mic.onclick = () => {
      if (rec) return rec.stop();
      rec = new SR(); rec.lang = 'de-CH'; rec.interimResults = false; rec.continuous = true;
      const base = txt.value ? txt.value.trim() + ' ' : '';
      rec.onresult = (e) => { txt.value = base + [...e.results].map(r => r[0].transcript).join(' '); };
      rec.onend = () => { rec = null; mic.setAttribute('aria-pressed', 'false'); lab.textContent = 'Tippen und sprechen'; };
      rec.onerror = () => toast('Die Spracheingabe hat nicht geklappt. Sie können auch schreiben.');
      rec.start(); mic.setAttribute('aria-pressed', 'true'); lab.textContent = 'Ich höre zu … zum Beenden tippen';
    };
  }
  if (item?.list) bindList($app, item, g(item.id));
  const collect = item && !item.list ? bindDoc($app.querySelector('#doc'), g(item.id)) : null;
  $app.querySelector('#skip').onclick = () => { if (q.n === Q().n && !answered(q.n) && !S.skipped.includes(q.n)) { S.skipped.push(q.n); save(false); } go('heute'); };
  $app.querySelector('#save').onclick = () => {
    let then = 'heute';
    if (item?.list) {
      const d = g(item.id); if (!d.items?.length && !d.none) return toast('Fügen Sie mindestens einen Eintrag hinzu oder wählen Sie «Ich habe keine».');
      S.answers[q.n] = { text: status(item)[2], ts: Date.now() };
    } else if (item) {
      const c = collect(); if (!c.has) return toast('Bitte wählen Sie Ja, Nein oder Weiss nicht.');
      const d = g(item.id); Object.assign(d, c); if (c.has === 'ja') d.checked = Date.now(); // beantwortet = geprüft
      S.answers[q.n] = { text: docSummary(d), ts: Date.now() };
      if (item.coach && c.has === 'nein') then = 'coach';
    } else {
      const text = txt.value.trim(); if (!text) return toast('Bitte sprechen oder schreiben Sie eine Antwort, oder überspringen Sie die Frage.');
      S.answers[q.n] = { text, ts: Date.now() };
      const on = $app.querySelector('#tog')?.checked;
      if (q.type === 'f' && on) S.papiere = text.slice(0, 80);
      const vname = $app.querySelector('#vname')?.value.trim();
      if (q.type === 'v' && on && vname) { g('vertretung').person = vname; then = 'coach'; }
      if (q.type === 'k' && on) then = 'kreis';
    }
    save(); toast(item ? `Im Wegweiser eingetragen: jetzt ${guideDone()} von ${GUIDE.length} geregelt.` : 'Gespeichert. Danke!'); go(then);
  };
};

/* ---------- Wegweiser ---------- */
routes.wegweiser = () => {
  const gd = guideDone(), all = GUIDE.length, pct = Math.round(gd / all * 100);
  $app.innerHTML = `<section class="screen"><h1>Wegweiser</h1><p class="lead">Was ist geregelt, wo liegt das Original, wer weiss Bescheid? Die Wochenfragen füllen ihn nach und nach, Sie können aber jederzeit selbst ergänzen.</p>
    <div class="card mint"><div class="spread"><b>${gd} von ${all} geregelt</b><span class="teal">${pct} %</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="list">${GUIDE.map(i => { const [cls, label, sub] = status(i); return `<button class="row" data-go="unterlage/${i.id}"><span class="ico ${cls === 'warn' ? 'sun' : ''}">${svg(i.icon)}</span><span class="m"><b>${i.name}</b><small>${esc(sub)}</small></span><span class="chip ${cls}">${label}</span></button>`; }).join('')}</div>
    ${S.papiere ? `<p class="tiny">Ihre Papiere allgemein: ${esc(S.papiere)}</p>` : ''}
    <p class="tiny">Lifely ist ein Wegweiser, kein Aufbewahrungsort. Die Originale und die Rechte bleiben, wo sie sind.</p></section>`;
};
routes.unterlage = (id) => {
  const item = GUIDE.find(i => i.id === id); if (!item) return go('wegweiser');
  const d = g(id);
  let form;
  if (item.person) form = `<label class="field">Wer ist es?<input class="in" id="person" value="${esc(d.person || '')}" placeholder="z. B. Anna Muster, Tochter"></label>
      ${!d.person && trusted().length ? `<div class="chips">${trusted().map(p => `<button type="button" class="chip" data-take="${esc(p.name)}">${esc(p.name)} übernehmen</button>`).join('')}</div>` : ''}
      <label class="row switch"><span class="m"><b>Die Person ist informiert</b><small>Sie weiss, dass sie im Ernstfall gefragt ist.</small></span><input type="checkbox" id="informed" ${d.informed ? 'checked' : ''}><span class="sw" aria-hidden="true"></span></label>`;
  else if (item.list) form = `<div id="lb">${listBlock(item, d)}</div>`;
  else form = `<div class="stack" id="doc">${docForm(item, d)}</div>${d.checked ? `<p class="tiny">Zuletzt geprüft: ${fmt(d.checked)}</p>` : ''}`;
  $app.innerHTML = `<section class="screen"><div class="top">${back('wegweiser', 'Wegweiser')}</div>
    <h1>${item.name}</h1><p class="lead">${item.hint}</p>
    <form id="f" class="stack">${form}
    <div class="bottom">${item.list ? '<button type="button" class="btn primary" data-go="wegweiser">Fertig</button>' : '<button class="btn primary">Speichern</button>'}
      ${!item.person && !item.list ? '<button type="button" class="btn ghost" id="checked">Heute geprüft, alles stimmt</button>' : ''}
      ${item.coach ? `<button type="button" class="btn ghost" data-go="coach">${svg('pen')}Vorsorgeauftrag-Coach</button>` : ''}</div>
    </form></section>`;
  const $ = (s) => $app.querySelector(s);
  if (item.list) return bindList($app, item, d);
  $app.querySelectorAll('[data-take]').forEach(b => b.onclick = () => { $('#person').value = b.dataset.take; });
  const collect = item.person ? () => ({ person: $('#person').value.trim(), informed: $('#informed').checked }) : bindDoc($('#doc'), d);
  $('#f').addEventListener('submit', (e) => {
    e.preventDefault(); const c = collect();
    if (!item.person && !c.has) return toast('Bitte wählen Sie Ja, Nein oder Weiss nicht.');
    if (c.has === 'ja') c.checked = Date.now(); Object.assign(d, c); save(); toast('Gespeichert'); go('wegweiser');
  });
  $('#checked')?.addEventListener('click', () => {
    const c = collect(); if (c.has !== 'ja' || !(c.where || S.papiere)) return toast('Bitte zuerst «Ja» wählen und eintragen, wo das Original liegt.');
    Object.assign(d, c, { checked: Date.now() }); save(); toast('Danke! Als geprüft eingetragen.'); go('wegweiser');
  });
};

/* ---------- Vorsorgeauftrag-Coach ---------- */
routes.coach = () => {
  const cur = COACH.findIndex((_, i) => !S.coach[i]);
  const who = S.guide.vertretung?.person;
  $app.innerHTML = `<section class="screen"><div class="top">${back('wegweiser', 'Wegweiser')}</div>
    <h1>Vorsorgeauftrag</h1><p class="lead">Schritt für Schritt. Sie können jederzeit pausieren.</p>
    <ol class="tl">${COACH.map(([t, s], i) => `<li class="${S.coach[i] ? 'done' : i === cur ? 'cur' : ''}"><button class="dot" data-step="${i}" aria-label="Schritt ${i + 1} ${S.coach[i] ? 'als offen markieren' : 'als erledigt markieren'}">${S.coach[i] ? '✓' : i + 1}</button>
      <div><b>${t}</b>${i === 0 && who ? `<small>${esc(who)}</small>` : ''}${i === cur || (i === 2 && !S.coach[2] && cur === 2) ? `<p class="note sunbg">${s}</p>` : `<small>${S.coach[i] ? 'Erledigt' : s.split('.')[0]}</small>`}</div></li>`).join('')}</ol>
    <p class="tiny">Lifely erstellt kein Rechtsdokument. Beratung gibt es bei Pro Senectute oder der Erwachsenenschutzbehörde (KESB) Ihres Kantons.</p>
    ${cur >= 0 ? `<div class="bottom"><button class="btn primary" data-step="${cur}">Schritt ${cur + 1} erledigt</button></div>` : '<p class="note">Alle Schritte erledigt. Lifely erinnert Sie jährlich.</p>'}
  </section>`;
  $app.querySelectorAll('[data-step]').forEach(b => b.onclick = () => {
    const i = +b.dataset.step; S.coach[i] = !S.coach[i];
    const va = g('vorsorgeauftrag');
    if (S.coach[2]) { if (va.has !== 'ja') Object.assign(va, { has: 'ja', byCoach: true, checked: Date.now() }); }
    else if (va.byCoach) { va.has = 'nein'; delete va.byCoach; }
    save(); render();
  });
};

/* ---------- Mein Kreis ---------- */
routes.kreis = () => {
  const due = dueList();
  $app.innerHTML = `<section class="screen"><div class="top">${back('heute', 'Heute')}</div>
    <h1>Mein Kreis</h1><p class="lead">Die Menschen, die Ihnen wichtig sind. Lifely erinnert Sie sanft, sich zu melden.</p>
    ${due.length ? dueCard(due[0]) : S.kreis.length ? `<div class="card mint"><p><b>Für heute ist alles gut.</b></p><p class="tiny">Ein kurzes Hallo freut die meisten mehr, als man denkt.</p></div>` : ''}
    <div class="list">${S.kreis.map(p => { const d = Math.ceil(dueIn(p) / DAY); return `<button class="row" data-go="person/${p.id}"><span class="ico av">${esc(initial(p.name))}</span><span class="m"><b>${esc(p.name)}${p.rel ? ', ' + esc(p.rel) : ''}</b><small>${rhythmLabel(p.rhythm)} · ${d <= 0 ? 'heute' : d === 1 ? 'morgen' : 'in ' + d + ' Tagen'}${p.trust ? ' · Vertrauensperson' : ''}</small></span>${svg('chev', 'chev')}</button>`; }).join('')}</div>
    ${S.kreis.length < 5 ? `<button class="btn ghost" data-go="person/neu">${svg('plus')}Person hinzufügen</button>` : '<p class="tiny">Höchstens fünf Personen, damit es überschaubar bleibt.</p>'}
    <h2>Reden tut gut</h2><p class="tiny">Wenn gerade niemand erreichbar ist:</p>
    <div class="list">${HELP.map(h => `<a class="row" href="tel:${h.tel}"><span class="ico ${h.urgent ? 'coral' : ''}">${svg('phone')}</span><span class="m"><b>${h.n} · ${h.name}</b><small>${h.sub}</small></span></a>`).join('')}</div>
  </section>`;
};
routes.person = (id) => {
  const isNew = id === 'neu';
  const p = isNew ? { id: 'p' + Date.now(), name: '', rel: 'Tochter', phone: '', rhythm: 7, last: Date.now(), trust: false } : S.kreis.find(x => x.id === id);
  if (!p) return go('kreis');
  if (isNew && S.kreis.length >= 5) { toast('Höchstens fünf Personen, damit es überschaubar bleibt.'); return go('kreis'); }
  $app.innerHTML = `<section class="screen"><div class="top">${back('kreis', 'Mein Kreis')}</div>
    <h1>${isNew ? 'Person hinzufügen' : esc(p.name)}</h1>
    ${!isNew ? `<p class="idea"><b>Gesprächsidee:</b> ${esc(topicFor(p))}</p>${contactButtons(p)}` : ''}
    <form id="f" class="stack" style="margin-top:18px">
      <label class="field">Name<input class="in" id="name" value="${esc(p.name)}" placeholder="z. B. Anna" required></label>
      <label class="field">Beziehung<select class="in" id="rel">${RELATIONS.map(r => `<option ${p.rel === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label class="field">Telefon<input class="in" id="phone" inputmode="tel" value="${esc(p.phone)}" placeholder="z. B. 079 123 45 67"></label>
      <fieldset class="field"><legend>Wie oft möchten Sie sich melden?</legend><div class="seg">${RHYTHMS.map(([d, l]) => `<button type="button" data-r="${d}" aria-pressed="${p.rhythm === d}">${l}</button>`).join('')}</div></fieldset>
      <label class="row switch"><span class="m"><b>Vertrauensperson</b><small>Weiss im Ernstfall Bescheid und steht im Notfallpaket.</small></span><input type="checkbox" id="trust" ${p.trust ? 'checked' : ''}><span class="sw" aria-hidden="true"></span></label>
      <div class="bottom"><button class="btn primary">Speichern</button>
      ${!isNew ? `<button type="button" class="btn ghost" id="ics">${svg('bell')}Als Termin in den Kalender</button><button type="button" class="btn danger" id="del">Aus Mein Kreis entfernen</button>` : ''}</div>
    </form></section>`;
  let rhythm = p.rhythm;
  $app.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { rhythm = +b.dataset.r; $app.querySelectorAll('[data-r]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  const $ = (s) => $app.querySelector(s);
  $('#f').addEventListener('submit', (e) => {
    e.preventDefault(); const name = $('#name').value.trim(); if (!name) return toast('Bitte einen Namen eingeben.');
    Object.assign(p, { name, rel: $('#rel').value, phone: $('#phone').value.trim(), rhythm, trust: $('#trust').checked });
    if (isNew) S.kreis.push(p); save(); toast(isNew ? `${name} ist jetzt in Ihrem Kreis.` : 'Gespeichert'); go('kreis');
  });
  $('#ics')?.addEventListener('click', () => downloadICS(p));
  $('#del')?.addEventListener('click', async () => { if (await confirmSheet(`${p.name} entfernen?`, 'Die Person verschwindet aus Mein Kreis.', 'Ja, entfernen')) { S.kreis = S.kreis.filter(x => x !== p); save(); go('kreis'); } });
};
function downloadICS(p) {
  const d = new Date(Date.now() + DAY); d.setHours(10, 0, 0, 0);
  const z = (n) => String(n).padStart(2, '0');
  const local = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}T100000`; // Ortszeit 10:00
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const rule = p.rhythm === 7 ? 'FREQ=WEEKLY' : p.rhythm === 14 ? 'FREQ=WEEKLY;INTERVAL=2' : 'FREQ=MONTHLY';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lifely//DE', 'BEGIN:VEVENT', `UID:${p.id}-${Date.now()}@lifely`, `DTSTAMP:${stamp}`, `DTSTART:${local}`, 'DURATION:PT15M', `RRULE:${rule}`,
    `SUMMARY:${p.name} anrufen`, 'DESCRIPTION:Ein kurzes Hallo freut die meisten mehr\\, als man denkt.', 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${p.name} anrufen`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  download(new Blob([ics], { type: 'text/calendar' }), `${p.name} anrufen.ics`);
  toast('Der Termin wird geöffnet. Bestätigen Sie ihn im Kalender.');
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* ---------- Meine Geschichte ---------- */
let histTab = 'antworten';
routes.geschichte = () => {
  const list = QUESTIONS.filter(q => answered(q.n) && (histTab === 'antworten' ? !['w', 'l'].includes(q.type) && !(q.type === 'f' && q.target !== 'papiere') : q.type === 'w')).reverse();
  $app.innerHTML = `<section class="screen"><h1>Meine Geschichte</h1><p class="lead">Ihre Antworten, Ihre Wünsche. Nur auf diesem Gerät.</p>
    <div class="seg"><button data-t="antworten" aria-pressed="${histTab === 'antworten'}">Antworten</button><button data-t="wichtig" aria-pressed="${histTab === 'wichtig'}">Das ist mir wichtig</button></div>
    ${histTab === 'wichtig' ? '<p class="tiny">Eine Gesprächsgrundlage für Familie und Hausarzt. Ausdrücklich keine Verfügung.</p>' : ''}
    <div class="list">${list.map(q => `<div class="card plain"><p class="eb teal">Woche ${q.n}</p><p class="qs">${esc(q.text)}</p><p class="ans">${esc(S.answers[q.n].text)}</p>
      <div class="mini"><button class="link" data-go="frage/${q.n}">Bearbeiten</button>${navigator.share ? ` · <button class="link" data-share="${q.n}">Teilen</button>` : ''}</div></div>`).join('') || `<div class="empty">${svg('book')}<p><b>Noch nichts hier.</b><br>Jede beantwortete Wochenfrage kommt hierher.</p></div>`}</div>
    ${list.length ? `<div class="card mint spread"><div><b>${histTab === 'antworten' ? 'Büchlein als PDF' : 'Gesprächskarte'}</b><p class="tiny">${(n => n === 1 ? '1 Antwort' : n + ' Antworten')(histTab === 'antworten' ? QUESTIONS.filter(q => answered(q.n) && q.type === 'm').length : list.length)} · im nächsten Fenster «Als PDF sichern» oder «Drucken» wählen</p></div><button class="btn small primary" id="printBtn">Erstellen</button></div>` : ''}
  </section>`;
  $app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { histTab = b.dataset.t; render(); });
  $app.querySelectorAll('[data-share]').forEach(b => b.onclick = async () => {
    const q = QUESTIONS[+b.dataset.share - 1];
    if (await confirmSheet('Antwort teilen?', 'Sie wählen gleich, mit wem. Lifely schickt nichts von selbst.', 'Ja, teilen')) navigator.share({ text: `${q.text}\n\n${S.answers[q.n].text}\n\n– ${S.name}` }).catch(() => {});
  });
  $app.querySelector('#printBtn')?.addEventListener('click', () => printDoc(histTab === 'antworten' ? bookHTML() : cardHTML()));
};
const bookHTML = () => `<h1>Meine Geschichte</h1><p class="sub">${esc(S.name)} · erzählt mit Lifely · ${fmt(Date.now())}</p>
  ${QUESTIONS.filter(q => answered(q.n) && q.type === 'm').map(q => `<h2>${esc(q.text)}</h2><p>${esc(S.answers[q.n].text).replace(/\n/g, '<br>')}</p>`).join('')}`;
const cardHTML = () => `<h1>Das ist mir wichtig</h1><p class="sub">${esc(S.name)} · ${fmt(Date.now())} · Gesprächsgrundlage, keine Verfügung</p>
  ${QUESTIONS.filter(q => answered(q.n) && q.type === 'w').map(q => `<h2>${esc(q.text)}</h2><p>${esc(S.answers[q.n].text).replace(/\n/g, '<br>')}</p>`).join('')}`;
function printDoc(html) { const el = document.getElementById('print'); el.innerHTML = html; window.print(); }

/* ---------- Assistent ---------- */
const chat = [];
routes.assistent = () => {
  $app.innerHTML = `<section class="screen"><div class="ahead"><span class="orb big">${svg('spark')}</span><div><h1>Ihr Assistent</h1><p class="tiny">Einfache Antworten, auf Deutsch</p></div></div>
    <div class="chat" id="chat"><div class="bub bot">Grüezi${S.name ? ' ' + esc(S.name) : ''}! Was möchten Sie wissen?</div>
    ${chat.map(m => `<div class="bub ${m.me ? 'me' : 'bot'}">${m.html}</div>`).join('')}</div>
    <div class="chips">${KB.map((k, i) => chat.some(m => m.q === i) ? '' : `<button class="chip" data-kb="${i}">${esc(k.q)}</button>`).join('')}</div>
    <form class="composer" id="ask"><input id="q" placeholder="Ihre Frage …" aria-label="Ihre Frage" autocomplete="off"><button aria-label="Frage senden">${svg('send')}</button></form>
    <p class="tiny">Antworten aus einer geprüften Wissensbasis. Keine Rechts- oder Arztberatung. Nichts verlässt Ihr Gerät.</p></section>`;
  const ask = (text) => {
    const lc = text.toLowerCase();
    const hit = KB.map((k, i) => ({ k, i, s: k.keys.filter(w => new RegExp('(^|[^a-zäöü])' + w).test(lc)).length + (k.q === text ? 9 : 0) })).sort((a, b) => b.s - a.s)[0];
    const html = hit.s ? hit.k.a + (hit.k.go ? `<br><button class="link" data-go="${hit.k.go}">Passenden Bereich öffnen</button>` : '')
      : 'Dazu weiss ich noch nichts. Versuchen Sie Stichworte wie <b>Patientenverfügung</b>, <b>Vorsorgeauftrag</b>, <b>Testament</b> oder <b>Todesfall</b>.';
    chat.push({ me: true, html: esc(text), q: hit.s ? hit.i : -1 }, { me: false, html }); render();
    setTimeout(() => $app.querySelector('#q')?.focus({ preventScroll: true }), 50);
  };
  $app.querySelectorAll('[data-kb]').forEach(b => b.onclick = () => ask(KB[+b.dataset.kb].q));
  $app.querySelector('#ask').addEventListener('submit', (e) => { e.preventDefault(); const v = $app.querySelector('#q').value.trim(); if (v) ask(v); });
  if (chat.length) $app.querySelector('#chat').lastElementChild.scrollIntoView({ block: 'center' });
};

/* ---------- Notfall: ein einziger Ablauf «Notfallpaket erstellen» ---------- */
const trusted = () => S.kreis.filter(p => p.trust);
routes.notfall = () => {
  const old = S.lastExport && S.changed > S.lastExport;
  $app.innerHTML = `<section class="screen"><h1>Im Ernstfall</h1><p class="lead">Damit Ihre Vertrauensperson alles findet.</p>
    <div class="card dark"><div class="spread left">${svg('lock')}<b>Notfallpaket</b></div>
      <p class="tiny light">Eine verschlüsselte Datei mit allem, was Ihre Vertrauensperson im Ernstfall braucht: Wegweiser, Kontakte und Ihre Wünsche.</p>
      <button class="btn white" data-go="paket/1">Notfallpaket ${S.lastExport ? 'neu ' : ''}erstellen</button>
      <p class="tiny light center">${S.lastExport ? `Zuletzt erstellt: ${fmt(S.lastExport)}${old ? ' · seither geändert, bitte neu erstellen' : ''}` : 'Noch nicht erstellt'}</p></div>
    <button class="row" data-go="kreis"><span class="ico">${svg('people')}</span><span class="m"><b>Vertrauenspersonen</b><small>${trusted().map(p => esc(p.name)).join(' · ') || 'Noch niemand, in «Mein Kreis» festlegen'}</small></span><span class="chip">${trusted().length}</span></button>
    <button class="row" data-go="ansicht"><span class="ico coral">${svg('eye')}</span><span class="m"><b>Das sieht Ihre Vertrauensperson</b><small>Vorschau, nur lesen</small></span></button>
    <p class="note">${svg('shield')}<span>Lifely ist ein Wegweiser. Die Originale und die Rechte bleiben, wo sie sind. Eine Vertrauensperson erbt dadurch nichts und bekommt keine rechtliche Vollmacht.</span></p>
    <p class="center"><button class="link" data-go="oeffnen">Sie haben ein Notfallpaket bekommen? Hier öffnen</button></p>
  </section>`;
};
const WORDS = ['Apfel', 'Berg', 'Sonne', 'Fluss', 'Garten', 'Brücke', 'Wolke', 'Linde', 'Kirsche', 'Laterne', 'Rose', 'Schwan', 'Bahnhof', 'Glocke', 'Kastanie', 'Ofen', 'Biene', 'Hafen', 'Meise', 'Tanne', 'Mühle', 'Stern', 'Fenster', 'Insel'];
const passphrase = () => { const pool = [...WORDS], out = []; const r = crypto.getRandomValues(new Uint32Array(5));
  for (let i = 0; i < 4; i++) out.push(pool.splice(r[i] % pool.length, 1)[0]); return out.join('-') + '-' + (10 + r[4] % 90); };
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function keyFrom(pw, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
function missingList() { // was vor dem Erstellen noch fehlt
  const m = GUIDE.filter(i => status(i)[0] !== 'ok').map(i => ({ go: 'unterlage/' + i.id, t: i.name, s: status(i)[2] }));
  if (!trusted().length) m.push({ go: 'kreis', t: 'Vertrauensperson', s: 'Noch niemand in «Mein Kreis» als Vertrauensperson markiert' });
  return m;
}
let lastPw = (() => { try { return sessionStorage.getItem('lifely2pw') || ''; } catch { return ''; } })();
const keepPw = () => { try { lastPw ? sessionStorage.setItem('lifely2pw', lastPw) : sessionStorage.removeItem('lifely2pw'); } catch {} };
routes.paket = (step = '1') => {
  const dots = `<div class="dots">${[1, 2, 3].map(i => `<i class="${i <= +step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (step === '1') {
    const m = missingList();
    body = `<h1>Ist alles erfasst?</h1>
      ${m.length ? `<p class="lead">Diese Punkte sind noch offen. Sie können sie jetzt ergänzen oder das Paket trotzdem erstellen und später erneuern.</p>
        <div class="list">${m.map(x => `<button class="row" data-go="${x.go}"><span class="ico sun">${svg('bell')}</span><span class="m"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span>${svg('chev', 'chev')}</button>`).join('')}</div>`
      : `<div class="card mint"><p><b>${svg('check', 'okc')} Alles erfasst.</b></p><p class="tiny">Ihr Wegweiser ist vollständig und Ihre Vertrauensperson ist bestimmt.</p></div>`}
      <div class="bottom"><button class="btn primary" id="next">${m.length ? 'Trotzdem weiter' : 'Weiter'}</button></div>`;
  }
  if (step === '2') {
    if (!lastPw) { lastPw = passphrase(); keepPw(); }
    body = `<h1>Ihr Passwort</h1><p class="lead">Die Datei ist verschlossen. Ihre Vertrauensperson braucht dieses Passwort, um sie zu öffnen.</p>
      <div class="card sun"><p class="pw" id="pw">${lastPw.split('-').join('-<wbr>')}</p><div class="stack"><button class="btn primary" id="copy">${svg('copy')}Passwort kopieren</button>
        ${trusted().filter(p => p.phone).slice(0, 2).map(p => `<a class="btn ghost" href="sms:${esc(p.phone)}?&body=${encodeURIComponent('Passwort für mein Lifely-Notfallpaket: ' + lastPw)}">${svg('mail')}Per SMS an ${esc(p.name)}</a>`).join('')}</div></div>
      <p class="note">${svg('lock')}<span>Geben Sie das Passwort Ihrer Vertrauensperson <b>getrennt von der Datei</b>, zum Beispiel per SMS oder auf einem Zettel. Lifely speichert es nicht.</span></p>
      <div class="bottom"><button class="btn primary" id="next">Weiter</button></div>`;
  }
  if (step === '3') body = `<h1>Notfallpaket senden</h1><p class="lead">Auf dem Handy können Sie die Datei direkt an Ihre Vertrauensperson schicken, zum Beispiel per E-Mail oder WhatsApp. Am Computer wird sie gespeichert.</p>
      <div class="bottom"><button class="btn primary" id="make">${svg('lock')}Notfallpaket senden oder speichern</button></div>
      <div id="done" hidden><div class="card mint"><p><b>${svg('check', 'okc')} Fertig!</b></p><p class="tiny">Datei gespeichert. Ihre Vertrauensperson braucht die Datei und das Passwort.</p></div>
      <div class="bottom"><button class="btn ghost" data-go="notfall">Zurück zum Notfall-Bereich</button></div></div>`;
  $app.innerHTML = `<section class="screen"><div class="top">${back(step === '1' ? 'notfall' : 'paket/' + (step - 1), 'Zurück')}<span class="muted">Schritt ${step} von 3</span></div>${dots}${body}</section>`;
  if (step === '1') { lastPw = ''; keepPw(); }
  $app.querySelector('#next')?.addEventListener('click', () => go('paket/' + (+step + 1)));
  $app.querySelector('#copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(lastPw); toast('Passwort kopiert. Fügen Sie es z. B. in eine SMS ein.'); }
    catch { toast('Bitte schreiben Sie das Passwort ab oder halten Sie den Finger darauf und wählen Sie «Kopieren».'); }
  });
  $app.querySelector('#make')?.addEventListener('click', async (e) => {
    if (!lastPw) { toast('Bitte notieren Sie zuerst das Passwort.'); return go('paket/2'); }
    e.target.disabled = true;
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await keyFrom(lastPw, salt);
      const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(S)));
      const blob = new Blob([JSON.stringify({ lifely: 1, created: Date.now(), salt: b64(salt), iv: b64(iv), data: b64(data) })], { type: 'application/octet-stream' });
      const fname = `Lifely-Notfallpaket-${S.name || 'Lifely'}.lifely`, file = new File([blob], fname, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Lifely-Notfallpaket' }); } catch (err) { if (err.name !== 'AbortError') download(blob, fname); } }
      else download(blob, fname);
      S.lastExport = Date.now(); save(false);
      e.target.closest('.bottom').hidden = true; $app.querySelector('#done').hidden = false;
    } catch { e.target.disabled = false; toast('Das hat nicht geklappt. Bitte nochmals versuchen.'); }
  });
};
let opened = null; // entschlüsseltes Paket (nur im Speicher, nur lesend)
routes.oeffnen = () => {
  $app.innerHTML = `<section class="screen"><div class="top">${back(S.setup ? 'notfall' : 'setup', 'Zurück')}</div>
    <h1>Notfallpaket öffnen</h1><p class="lead">Wählen Sie die Datei und geben Sie das Passwort ein, das Sie bekommen haben.</p>
    <form id="f" class="stack"><label class="field">Datei<input class="in" type="file" id="file" accept=".lifely,application/json"></label>
    <label class="field">Passwort<input class="in" id="pw" autocomplete="off" placeholder="z. B. Apfel-Berg-Sonne-Fluss-42"></label>
    <div class="bottom"><button class="btn primary">${svg('lock')}Öffnen</button></div></form>
    <p class="tiny">Die Datei wird nur auf diesem Gerät geöffnet. Nichts wird gesendet.</p></section>`;
  $app.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = $app.querySelector('#file').files[0], pw = $app.querySelector('#pw').value.trim();
    if (!f || !pw) return toast('Bitte Datei und Passwort angeben.');
    try {
      const p = JSON.parse(await f.text());
      const key = await keyFrom(pw, unb64(p.salt));
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, key, unb64(p.data));
      opened = JSON.parse(new TextDecoder().decode(plain)); go('ansicht/paket');
    } catch { toast('Passwort oder Datei stimmt nicht. Bitte genau so eingeben, wie Sie es bekommen haben.'); }
  });
};
routes.ansicht = (src) => {
  const D = src === 'paket' && opened ? opened : S;
  const ans = (type) => QUESTIONS.filter(q => q.type === type && D.answers?.[q.n]);
  $app.innerHTML = `<section class="screen"><div class="top">${back(src === 'paket' ? (S.setup ? 'notfall' : 'setup') : 'notfall', 'Zurück')}</div>
    <div class="card dark"><p class="eb light">${src === 'paket' ? 'Notfallpaket geöffnet' : 'Vorschau'} · nur lesen</p><h1 class="light">Was ${esc(D.name || 'die Person')} hinterlegt hat</h1></div>
    ${ans('w').length ? `<h2>Das ist mir wichtig</h2>${ans('w').map(q => `<div class="card plain"><p class="qs">${esc(q.text)}</p><p class="ans">${esc(D.answers[q.n].text)}</p></div>`).join('')}` : ''}
    <h2>Wichtige Kontakte</h2><div class="list">${(D.kreis || []).filter(p => p.trust).map(p => `<a class="row" href="tel:${esc(p.phone)}"><span class="ico av">${esc(initial(p.name))}</span><span class="m"><b>${esc(p.name)}</b><small>${esc(p.rel || '')} · ${esc(p.phone || 'keine Nummer')}</small></span></a>`).join('') || '<p class="tiny">Keine Vertrauenspersonen hinterlegt.</p>'}
    ${ans('p').map(q => `<div class="card plain"><p class="qs">${esc(q.text)}</p><p class="ans">${esc(D.answers[q.n].text)}</p></div>`).join('')}</div>
    <h2>Wegweiser</h2><div class="list">${GUIDE.map(i => { const [c, l, s] = status(i, D); const items = i.list ? (D.guide?.[i.id]?.items || []) : [];
      return `<div class="row top-al"><span class="ico">${svg(i.icon)}</span><span class="m"><b>${i.name}</b><small>${esc(i.list && items.length ? plural(items.length, i.unit) : s)}</small>${items.map(x => `<small class="item">${esc(x.type)}: <b>${esc(x.name)}</b>${x.note ? ' · ' + esc(x.note) : ''}</small>`).join('')}</span><span class="chip ${c}">${l}</span></div>`; }).join('')}</div>
    <h2>Was jetzt zu tun ist</h2><p class="tiny">Orientierung, im Einzelfall zu prüfen.</p>
    <ol class="steps"><li><b>Im Spital:</b> Patientenverfügung und Vorsorgeauftrag holen (Fundort oben), Hausarzt informieren.</li><li><b>Im Todesfall:</b> Todesbescheinigung durch Arzt oder Ärztin.</li><li>Innert 2 Tagen beim Zivilstandsamt melden (oft übernimmt dies Spital oder Bestatter).</li><li>Bestattungsunternehmen kontaktieren, Wünsche beachten.</li><li>Testament sofort der zuständigen Behörde einreichen.</li><li>Banken, AHV, Pensionskasse und Versicherungen informieren, Verträge und Abos kündigen (Liste oben).</li></ol>
    <h2>Beratung und Hilfe</h2><div class="list">${HELP.map(h => `<a class="row" href="tel:${h.tel}"><span class="ico ${h.urgent ? 'coral' : ''}">${svg('phone')}</span><span class="m"><b>${h.n} · ${h.name}</b><small>${h.sub}</small></span></a>`).join('')}</div>
    ${src === 'paket' && opened ? '<div class="bottom"><button class="btn ghost" id="restore">Auf diesem Gerät übernehmen</button></div>' : ''}
  </section>`;
  $app.querySelector('#restore')?.addEventListener('click', async () => {
    if (await confirmSheet('Daten übernehmen?', 'Die Daten aus dem Notfallpaket ersetzen alles, was auf diesem Gerät in Lifely gespeichert ist.', 'Ja, übernehmen')) { S = Object.assign(blank(), opened); save(false); applySize(); toast('Übernommen.'); go('heute'); }
  });
};

/* ---------- Rundgang: kurzes Intro nach dem Einrichten (Scheinwerfer auf jeden Bereich) ---------- */
const TOUR = [
  { t: 'Willkommen, {name}!', p: 'Ein kurzer Rundgang zeigt Ihnen, wo was ist. Er dauert etwa eine Minute.' },
  { sel: '#app .card.sun', t: 'Frage der Woche', p: 'Jede Woche eine einfache Frage. Antworten Sie sprechend oder schreibend, in etwa fünf Minuten. Überspringen geht immer.' },
  { sel: '#app button.card[data-go="wegweiser"]', t: 'Ihr Wegweiser', p: 'Zeigt, was geregelt ist, wo die Originale liegen und wer Bescheid weiss. Die Wochenfragen füllen ihn nach und nach.' },
  { sel: '#app button.row[data-go="kreis"]', t: 'Mein Kreis', p: 'Die Menschen, die Ihnen wichtig sind. Lifely erinnert Sie sanft, sich zu melden, und schlägt ein Gesprächsthema vor.' },
  { sel: '#tabbar [data-go="assistent"]', t: 'Der Assistent', p: 'Fragen zu Patientenverfügung, Testament oder Todesfall? Hier gibt es einfache Antworten.' },
  { sel: '#tabbar [data-go="geschichte"]', t: 'Meine Geschichte', p: 'Hier sammeln sich Ihre Antworten. Daraus entsteht ein Büchlein zum Ausdrucken oder Verschenken.' },
  { sel: '#tabbar [data-go="notfall"]', t: 'Im Ernstfall', p: 'Mit einem Knopf erstellen Sie ein verschlüsseltes Notfallpaket für Ihre Vertrauensperson. Haben Sie selbst eines bekommen, öffnen Sie es ebenfalls hier.' },
  { sel: '#app .avatar', t: 'Ihre Einstellungen', p: 'Schriftgrösse, Sicherheit und diesen Rundgang finden Sie hier.' },
];
function endTour(next) { document.getElementById('tour')?.remove(); document.body.classList.remove('touring'); removeEventListener('resize', placeTour); S.tourDone = true; save(false); if (next) go(next); }
let tourStep = 0;
function startTour(i = 0) {
  if (location.hash.slice(1) !== 'heute') { go('heute'); return setTimeout(() => startTour(i), 120); }
  tourStep = i; document.body.classList.add('touring');
  let el = document.getElementById('tour');
  if (!el) {
    el = document.createElement('div'); el.id = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tourT');
    el.innerHTML = '<div class="spot"></div><div class="tip"></div>';
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-tnext]')) return tourStep < TOUR.length - 1 ? startTour(tourStep + 1) : endTour('frage');
      if (e.target.closest('[data-tback]')) return startTour(tourStep - 1);
      if (e.target.closest('[data-tskip]')) return endTour();
    });
    const onKey = (e) => { if (e.key === 'Escape' && document.getElementById('tour')) { endTour(); removeEventListener('keydown', onKey); } };
    addEventListener('keydown', onKey);
    document.body.appendChild(el); addEventListener('resize', placeTour);
  }
  const s = TOUR[i], last = i === TOUR.length - 1;
  el.querySelector('.tip').innerHTML = `${s.sel ? '' : `<img class="tlogo" src="logo.svg" alt="">`}
    <p class="tstep">${i ? `Schritt ${i} von ${TOUR.length - 1}` : 'Rundgang'}</p>
    <h2 id="tourT">${esc(s.t.replace('{name}', S.name))}</h2><p>${esc(s.p)}</p>
    <div class="tdots" aria-hidden="true">${TOUR.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="tbtns">${i ? '<button class="btn ghost" data-tback>Zurück</button>' : '<button class="btn ghost" data-tskip>Überspringen</button>'}
      <button class="btn primary" data-tnext>${last ? 'Erste Frage ansehen' : i ? 'Weiter' : 'Rundgang starten'}</button></div>
    ${i && !last ? '<button class="link tskip" data-tskip>Rundgang beenden</button>' : ''}`;
  const target = s.sel && document.querySelector(s.sel);
  if (target && !target.closest('#tabbar')) target.scrollIntoView({ block: 'center' });
  requestAnimationFrame(placeTour);
  el.querySelector('[data-tnext]').focus();
}
function placeTour() {
  const el = document.getElementById('tour'); if (!el) return;
  const s = TOUR[tourStep], spot = el.querySelector('.spot'), tip = el.querySelector('.tip');
  const target = s.sel && document.querySelector(s.sel);
  el.classList.toggle('center', !target);
  if (!target) { spot.style.cssText = ''; tip.style.cssText = ''; return; }
  let r = target.getBoundingClientRect(); const pad = 8;
  const tw = Math.min(360, innerWidth - 24), th = tip.offsetHeight;
  let top, h = r.height;
  if (r.bottom + pad + 14 + th < innerHeight) top = r.bottom + pad + 14;
  else if (r.top - pad - 14 - th > 0) top = r.top - pad - 14 - th;
  else { // passt weder oben noch unten: Ziel nach oben schieben, Karte unten, Scheinwerfer nur auf den sichtbaren Teil
    if (!target.closest('#tabbar')) { scrollBy(0, r.top - 16); r = target.getBoundingClientRect(); }
    top = innerHeight - th - 12; h = Math.max(40, Math.min(r.height, top - r.top - 2 * pad - 6));
  }
  Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: h + pad * 2 + 'px' });
  Object.assign(tip.style, { width: tw + 'px', left: Math.min(Math.max(12, r.left + r.width / 2 - tw / 2), innerWidth - tw - 12) + 'px', top: top + 'px' });
}

/* ---------- Profil und Sicherheit ---------- */
routes.profil = () => {
  $app.innerHTML = `<section class="screen"><div class="top">${back('heute', 'Heute')}</div>
    <div class="prof"><span class="avatar big">${esc(initial(S.name))}</span><div><h1>${esc(S.name)}</h1><p class="tiny">Seit ${fmt(S.start)} · Woche ${S.qi + 1} von 52</p></div></div>
    <h2>Schriftgrösse</h2>${sizeSeg()}
    <h2>Einstellungen</h2><div class="list">
      <button class="row" data-go="sicherheit"><span class="ico">${svg('shield')}</span><span class="m"><b>Sicherheit auf einen Blick</b><small>Wo liegen die Daten, was wird nie gespeichert</small></span>${svg('chev', 'chev')}</button>
      <div class="row"><span class="ico">${svg('globe')}</span><span class="m"><b>Sprache</b><small>Deutsch · Français, Italiano, English folgen</small></span></div>
      <button class="row" id="tourAgain"><span class="ico">${svg('spark')}</span><span class="m"><b>Rundgang nochmals ansehen</b><small>Kurz erklärt, wo was ist</small></span>${svg('chev', 'chev')}</button>
      <button class="row" id="name"><span class="ico">${svg('pen')}</span><span class="m"><b>Name ändern</b><small>${esc(S.name)}</small></span>${svg('chev', 'chev')}</button>
    </div>
    <div class="stack" style="margin-top:22px"><button class="btn ghost" id="demo">Demo mit Margrit laden</button><button class="btn danger" id="wipe">Alle Daten löschen</button></div>
    <p class="tiny center">Lifely 2.0 · Prototyp einer Projektarbeit der BFH (Modul EBDS)</p></section>`;
  $app.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { S.size = b.dataset.size; applySize(); save(false); render(); });
  $app.querySelector('#tourAgain').onclick = () => startTour(0);
  $app.querySelector('#name').onclick = () => { const n = prompt('Wie dürfen wir Sie ansprechen?', S.name); if (n?.trim()) { S.name = n.trim(); save(); render(); } };
  $app.querySelector('#demo').onclick = async () => { if (await confirmSheet('Demo laden?', 'Ihre eigenen Eingaben werden durch Margrits Beispieldaten ersetzt.', 'Demo laden')) { loadDemo(); go('heute'); } };
  $app.querySelector('#wipe').onclick = async () => { if (await confirmSheet('Alle Daten löschen?', 'Antworten, Wegweiser und Mein Kreis werden von diesem Gerät entfernt. Ein Notfallpaket bleibt, wo Sie es gespeichert haben.', 'Ja, alles löschen')) { localStorage.removeItem(KEY); chat.length = 0; S = blank(); applySize(); go('setup'); } };
};
routes.sicherheit = () => {
  $app.innerHTML = `<section class="screen"><div class="top">${back('profil', 'Profil')}</div><h1>Sicherheit auf einen Blick</h1>
    <ul class="checks"><li>${svg('phoneDev')}<span><b>Wo liegen die Daten?</b> Nur in diesem Browser auf diesem Gerät. Kein Konto, keine Cloud, kein Server.</span></li>
    <li>${svg('spark')}<span><b>Was geht an eine KI?</b> Nichts. Der Assistent antwortet aus einer Wissensbasis auf dem Gerät.</span></li>
    <li>${svg('lock')}<span><b>Was wird nie gespeichert?</b> Passwörter, PINs, Kontonummern. Lifely fragt nur, <i>wo</i> etwas ist.</span></li>
    <li>${svg('shield')}<span><b>Notfallpaket:</b> sicher verschlüsselt. Ohne das Passwort kann niemand die Datei lesen.</span></li>
    <li>${svg('bell')}<span><b>Wichtig:</b> Wenn Sie die Browserdaten löschen, sind die Daten weg. Erstellen Sie darum regelmässig ein Notfallpaket und bewahren Sie das Passwort an einem sicheren Ort auf. Ohne Passwort lässt sich das Paket nicht mehr öffnen.</span></li></ul></section>`;
};

/* ---------- Demo-Daten (Margrit) ---------- */
function loadDemo() {
  const now = Date.now();
  chat.length = 0;
  S = Object.assign(blank(), {
    setup: true, name: 'Margrit', start: now - 22 * DAY, qi: 3, qSince: now - 2 * DAY,
    answers: {
      1: { text: 'Die Fahrt auf den Chasseral mit Vater. Wir haben oben Cervelats gebraten, und ich durfte das erste Mal die ganze Strecke selber laufen.', ts: now - 21 * DAY },
      2: { text: 'Der Duft vom Holzofen und das Klavier im Wohnzimmer. Mutter hat jeden Sonntag gespielt.', ts: now - 14 * DAY },
      3: { text: 'Omas Apfelkuchen mit Rahmguss. Das Rezept steht hinten im roten Kochbuch.', ts: now - 7 * DAY },
    },
    guide: {
      patvf: { has: 'ja', where: 'Schrank links, blauer Ordner', copy: 'Hausarzt', who: 'Anna', checked: now - 300 * DAY },
      vorsorgeauftrag: { has: 'nein' },
      testament: { has: 'ja', where: 'Notariat Bern', checked: now - 6 * 365 * DAY },
      vertretung: { person: 'Anna Muster', informed: true },
      versicherungen: { items: [{ type: 'Krankenkasse', name: 'CSS', note: 'grüner Ordner' }, { type: 'Haftpflicht & Hausrat', name: 'Mobiliar', note: 'grüner Ordner' }] },
      konten: { items: [{ type: 'Privatkonto', name: 'Berner Kantonalbank', note: 'Filiale Bümpliz' }, { type: 'Säule 3a', name: 'PostFinance', note: '' }] },
      vertraege: {},
    },
    coach: [true, true],
    kreis: [
      { id: 'p1', name: 'Anna', rel: 'Tochter', phone: '079 123 45 67', rhythm: 7, last: now - 8 * DAY, trust: true },
      { id: 'p2', name: 'Thomas', rel: 'Sohn', phone: '078 765 43 21', rhythm: 14, last: now - 3 * DAY, trust: true },
      { id: 'p3', name: 'Ruth', rel: 'Nachbar/in', phone: '031 123 45 67', rhythm: 30, last: now - 10 * DAY, trust: false },
    ],
    lastExport: now - 18 * DAY, changed: now - DAY, size: S.size, tourDone: true,
  });
  save(false); applySize();
}

/* ---------- Start ---------- */
applySize();
if (new URLSearchParams(location.search).has('demo') && !S.setup) loadDemo();
render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
