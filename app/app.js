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
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2800);
}
function sheet(html, onClick) {
  const el = document.createElement('div'); el.className = 'backdrop';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-close]')) return el.remove(); onClick?.(e, el); });
  document.body.appendChild(el); el.querySelector('button, a, input')?.focus();
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
function status(item) {
  const d = S.guide[item.id] || {};
  if (item.person) return d.person ? (d.informed ? ['ok', 'Geregelt', `${d.person} · informiert ✓`] : ['warn', 'Offen', `${d.person} · noch nicht informiert`]) : ['warn', 'Offen', 'Noch niemand bestimmt'];
  if (d.has !== 'ja') return ['warn', 'Offen', d.has === 'nein' ? (item.coach ? 'Noch nicht vorhanden · Coach starten' : 'Noch nicht vorhanden') : 'Noch nicht erfasst'];
  const where = d.where || S.papiere;
  if (!where) return ['warn', 'Offen', 'Fundort fehlt'];
  if (item.review && d.checked && months(d.checked) > item.review) return ['due', 'Prüfen', `Zuletzt geprüft ${new Date(d.checked).getFullYear()}`];
  return ['ok', 'Geregelt', `Original: ${where}${d.copy ? ' · Kopie: ' + d.copy : ''}`];
}
const guideDone = () => GUIDE.filter(i => status(i)[0] === 'ok').length;

/* ---------- Mein Kreis ---------- */
const dueIn = (p) => Math.max(p.snooze || 0, (p.last || 0) + p.rhythm * DAY) - Date.now();
const dueList = () => S.kreis.filter(p => dueIn(p) <= 0).sort((a, b) => dueIn(a) - dueIn(b));
const rhythmLabel = (d) => (RHYTHMS.find(r => r[0] === d) || RHYTHMS[0])[1];
function topicFor(p) {
  const last = [...QUESTIONS].slice(0, S.qi + 1).reverse().find(q => (q.type === 'm' || q.type === 'w') && answered(q.n));
  if (last) return `Erzählen Sie ${p.name} von Ihrer Antwort auf «${last.text}»`;
  const q = QUESTIONS.slice(0, S.qi + 1).reverse().find(q => q.type === 'm');
  return q ? `Fragen Sie ${p.name}: «${q.text.replace('Ihr', 'dein').replace('Sie', 'du')}»` : TOPICS[p.name.length % TOPICS.length];
}
function contactButtons(p, small) {
  const intl = phoneIntl(p.phone);
  const text = encodeURIComponent(`Hallo ${p.name}, ich habe gerade an dich gedacht. Hast du bald Zeit für einen Schwatz?`);
  return `<div class="actions3 ${small ? 'small' : ''}">
    <a class="btn primary" href="tel:${esc(p.phone)}" data-contact="${p.id}">${svg('phone')}Anrufen</a>
    <a class="btn ghost" href="https://wa.me/${intl}?text=${text}" target="_blank" rel="noopener" data-contact="${p.id}">${svg('video')}WhatsApp</a>
    <a class="btn ghost" href="sms:${esc(p.phone)}?&body=${text}" data-contact="${p.id}">${svg('chat')}SMS</a></div>`;
}
function markContact(id) {
  const p = S.kreis.find(x => x.id === id); if (!p) return;
  p.last = Date.now(); p.snooze = 0; save(false);
  setTimeout(() => toast(`Schön! Nächste Erinnerung ${rhythmLabel(p.rhythm) === 'jede Woche' ? 'in einer Woche' : rhythmLabel(p.rhythm)}.`), 400);
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
  let [name, arg] = location.hash.slice(1).split('/');
  if (!S.setup && name !== 'setup' && name !== 'ansicht' && name !== 'oeffnen') name = 'setup';
  if (!routes[name]) name = S.setup ? 'heute' : 'setup';
  advanceWeek();
  const tab = TAB[name];
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
let setupData = {};
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
    <li>${svg('shield')}<span><b>Notfallpaket.</b> Für den Ernstfall eine verschlüsselte Datei, die nur Ihre Vertrauensperson mit dem Passwort öffnet.</span></li>
    <li>${svg('heart')}<span><b>Kein Rechtsdokument.</b> Lifely ist ein Wegweiser und ersetzt keine Beratung.</span></li></ul>
    <div class="bottom"><button class="btn primary" id="finish">Einverstanden, erste Frage ansehen</button></div>`;
  $app.innerHTML = `<section class="screen setup">${head}${body}</section>`;
  const $ = (s) => $app.querySelector(s);
  $('#together')?.addEventListener('click', () => { setupData.together = true; go('setup/1'); });
  $('#demo')?.addEventListener('click', () => { loadDemo(); go('heute'); toast('Demo geladen: Sie sehen Lifely mit Margrits Beispieldaten.'); });
  $app.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { S.size = b.dataset.size; applySize(); save(false); render(); });
  $('#f')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (step === 2) { const n = $('#name').value.trim(); if (!n) return toast('Bitte geben Sie Ihren Vornamen ein.'); S.name = n; save(); go('setup/3'); }
    if (step === 3) { setupData.hname = $('#hname').value.trim(); setupData.hrel = $('#hrel').value; setupData.hphone = $('#hphone').value.trim(); go('setup/4'); }
  });
  $('#finish')?.addEventListener('click', () => {
    if (setupData.hname && !S.kreis.some(p => p.name === setupData.hname)) S.kreis.push({ id: 'p' + Date.now(), name: setupData.hname, rel: setupData.hrel, phone: setupData.hphone, rhythm: 7, last: Date.now(), trust: true });
    S.setup = true; S.start = S.qSince = Date.now(); save(); go('frage');
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
        <p class="tiny">Die nächste Frage kommt in ${days} ${days === 1 ? 'Tag' : 'Tagen'}.</p>${S.qi < 51 ? '<button class="link" id="nextq">Nächste Frage schon jetzt</button>' : ''}</div>`}
    ${due.length ? dueCard(due[0]) : ''}
    <button class="card plain" data-go="wegweiser"><div class="spread"><b>Wegweiser</b><span class="teal">${gd} von 6 geregelt</span></div>
      <div class="bar"><i style="width:${Math.round(gd / 6 * 100)}%"></i></div><p class="tiny">${next ? `Als Nächstes: ${next.name}, ${status(next)[2].toLowerCase()}` : 'Alles geregelt. Einmal im Jahr prüfen.'}</p></button>
    ${checks.map(i => `<button class="row" data-go="unterlage/${i.id}"><span class="ico coral">${svg('bell')}</span><span class="m"><b>${i.name} prüfen</b><small>Zuletzt geprüft vor über ${i.review / 12} Jahren</small></span></button>`).join('')}
    ${paketOld ? `<button class="row" data-go="paket"><span class="ico coral">${svg('lock')}</span><span class="m"><b>Notfallpaket erneuern</b><small>Seit dem letzten Mal hat sich etwas geändert</small></span></button>` : ''}
    <button class="row" data-go="kreis"><span class="ico">${svg('people')}</span><span class="m"><b>Mein Kreis</b><small>${S.kreis.length ? S.kreis.map(p => esc(p.name)).join(' · ') : 'Menschen, die Ihnen wichtig sind'}</small></span>${due.length ? `<span class="chip warn">${due.length}</span>` : svg('chev', 'chev')}</button>
  </section>`;
  $app.querySelector('#nextq')?.addEventListener('click', () => { nextQuestionNow(); render(); });
};

/* ---------- Antwort geben ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
routes.frage = (n) => {
  const q = n ? QUESTIONS[+n - 1] : Q(); if (!q) return go('heute');
  const a = S.answers[q.n] || {};
  const toggle = { f: ['Fundort im Wegweiser eintragen?', 'Dann weiss Ihre Vertrauensperson, wo alles liegt.'], v: ['Als Vertretungsperson eintragen?', 'Danach hilft Ihnen der Coach beim Vorsorgeauftrag.'], k: ['Danach «Mein Kreis» öffnen?', 'Dort hinterlegen Sie die Person mit Telefonnummer.'] }[q.type];
  $app.innerHTML = `<section class="screen answer">
    <div class="top">${back('heute', 'Woche ' + q.n)}</div>
    <p class="eb">Frage der Woche</p>
    <h1 class="qt big">${esc(q.text)}</h1>
    ${SR ? `<div class="micwrap"><button class="mic" id="mic" aria-pressed="false" aria-label="Antwort sprechen">${svg('mic')}</button>
      <p class="center"><b id="micLabel">Tippen und sprechen</b></p><p class="tiny center">oder schreiben Sie Ihre Antwort</p></div>` : `<p class="tiny">Tipp: Mit dem Mikrofon auf der Tastatur können Sie die Antwort auch sprechen.</p>`}
    <textarea class="in" id="txt" rows="5" placeholder="Ihre Antwort …">${esc(a.text || '')}</textarea>
    ${toggle ? `<label class="row switch"><span class="m"><b>${toggle[0]}</b><small>${toggle[1]}</small></span><input type="checkbox" id="tog" checked><span class="sw" aria-hidden="true"></span></label>` : ''}
    ${q.type === 'w' ? '<p class="tiny">Diese Antwort kommt auf Ihre Gesprächskarte «Das ist mir wichtig». Sie ist keine Verfügung.</p>' : ''}
    <div class="bottom"><button class="btn primary" id="save">Antwort speichern</button>
      <button class="btn ghost" id="skip">${answered(q.n) ? 'Zurück ohne Änderung' : 'Diese Frage überspringen'}</button></div>
  </section>`;
  const txt = $app.querySelector('#txt');
  if (SR) {
    let rec = null; const mic = $app.querySelector('#mic'), lab = $app.querySelector('#micLabel');
    mic.onclick = () => {
      if (rec) return rec.stop();
      rec = new SR(); rec.lang = 'de-CH'; rec.interimResults = false; rec.continuous = true;
      const base = txt.value ? txt.value.trim() + ' ' : '';
      let said = '';
      rec.onresult = (e) => { said = [...e.results].map(r => r[0].transcript).join(' '); txt.value = base + said; };
      rec.onend = () => { rec = null; mic.setAttribute('aria-pressed', 'false'); lab.textContent = 'Tippen und sprechen'; };
      rec.onerror = () => toast('Die Spracheingabe hat nicht geklappt. Sie können auch schreiben.');
      rec.start(); mic.setAttribute('aria-pressed', 'true'); lab.textContent = 'Ich höre zu … zum Beenden tippen';
    };
  }
  $app.querySelector('#skip').onclick = () => { if (!answered(q.n) && !S.skipped.includes(q.n)) { S.skipped.push(q.n); save(false); } go('heute'); };
  $app.querySelector('#save').onclick = () => {
    const text = txt.value.trim(); if (!text) return toast('Bitte sprechen oder schreiben Sie eine Antwort, oder überspringen Sie die Frage.');
    S.answers[q.n] = { text, ts: Date.now() };
    const on = $app.querySelector('#tog')?.checked;
    let then = 'heute';
    if (q.type === 'f' && on) {
      if (q.target === 'papiere') S.papiere = text.slice(0, 80);
      else Object.assign(g(q.target), { has: 'ja', where: text.slice(0, 80), checked: g(q.target).checked || Date.now() });
    }
    if (q.type === 'v' && on) { g('vertretung').person = text.split(/[,.\n]/)[0].slice(0, 40); then = 'coach'; }
    if (q.type === 'k' && on) then = 'kreis';
    save(); toast('Gespeichert. Danke!'); go(then);
  };
};

/* ---------- Wegweiser ---------- */
routes.wegweiser = () => {
  const gd = guideDone();
  $app.innerHTML = `<section class="screen"><h1>Wegweiser</h1><p class="lead">Was ist geregelt, wo liegt das Original, wer weiss Bescheid?</p>
    <div class="card mint"><div class="spread"><b>${gd} von 6 geregelt</b><span class="teal">${Math.round(gd / 6 * 100)} %</span></div><div class="bar"><i style="width:${Math.round(gd / 6 * 100)}%"></i></div></div>
    <div class="list">${GUIDE.map(i => { const [cls, label, sub] = status(i); return `<button class="row" data-go="unterlage/${i.id}"><span class="ico ${cls === 'warn' ? 'sun' : ''}">${svg(i.icon)}</span><span class="m"><b>${i.name}</b><small>${esc(sub)}</small></span><span class="chip ${cls}">${label}</span></button>`; }).join('')}</div>
    ${S.papiere ? `<p class="tiny">Ihre Papiere allgemein: ${esc(S.papiere)}</p>` : ''}
    <p class="tiny">Lifely ist ein Wegweiser, kein Aufbewahrungsort. Die Originale und die Rechte bleiben, wo sie sind.</p></section>`;
};
routes.unterlage = (id) => {
  const item = GUIDE.find(i => i.id === id); if (!item) return go('wegweiser');
  const d = g(id);
  const segHas = `<div class="seg" role="group" aria-label="Vorhanden?">${[['ja', 'Ja'], ['nein', 'Nein'], ['?', 'Weiss nicht']].map(([v, l]) => `<button type="button" data-has="${v}" aria-pressed="${d.has === v}">${l}</button>`).join('')}</div>`;
  $app.innerHTML = `<section class="screen"><div class="top">${back('wegweiser', 'Wegweiser')}</div>
    <h1>${item.name}</h1><p class="lead">${item.hint}</p>
    <form id="f" class="stack">
    ${item.person ? `<label class="field">Wer ist es?<input class="in" id="person" value="${esc(d.person || '')}" placeholder="z. B. Anna Muster, Tochter"></label>
      <label class="row switch"><span class="m"><b>Die Person ist informiert</b><small>Sie weiss, dass sie im Ernstfall gefragt ist.</small></span><input type="checkbox" id="informed" ${d.informed ? 'checked' : ''}><span class="sw" aria-hidden="true"></span></label>`
    : `<fieldset class="field"><legend>Gibt es das bei Ihnen?</legend>${segHas}</fieldset>
      <label class="field">Wo liegt das Original?<input class="in" id="where" value="${esc(d.where || '')}" placeholder="${esc(S.papiere || 'z. B. Schrank links, blauer Ordner')}"></label>
      <label class="field">Wer hat eine Kopie? <span class="opt">(freiwillig)</span><input class="in" id="copy" value="${esc(d.copy || '')}" placeholder="z. B. Hausarzt, Anna"></label>
      <label class="field">Wer weiss Bescheid? <span class="opt">(freiwillig)</span><input class="in" id="who" value="${esc(d.who || '')}" placeholder="z. B. Anna"></label>
      ${id === 'konten' ? `<p class="note warn">${svg('lock')}<span>Tragen Sie nur ein, <b>wo</b> Sie Konten haben. Nie Passwörter oder PINs.</span></p>` : ''}
      ${d.checked ? `<p class="tiny">Zuletzt geprüft: ${fmt(d.checked)}</p>` : ''}`}
    <div class="bottom"><button class="btn primary">Speichern</button>
      ${!item.person ? '<button type="button" class="btn ghost" id="checked">Heute geprüft</button>' : ''}
      ${item.coach ? `<button type="button" class="btn ghost" data-go="coach">${svg('pen')}Vorsorgeauftrag-Coach</button>` : ''}</div>
    </form></section>`;
  let has = d.has;
  $app.querySelectorAll('[data-has]').forEach(b => b.onclick = () => { has = b.dataset.has; $app.querySelectorAll('[data-has]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  const $ = (s) => $app.querySelector(s);
  const collect = () => item.person ? { person: $('#person').value.trim(), informed: $('#informed').checked }
    : { has, where: $('#where').value.trim(), copy: $('#copy').value.trim(), who: $('#who').value.trim() };
  $('#f').addEventListener('submit', (e) => { e.preventDefault(); const c = collect(); if (c.has === 'ja' && !d.checked) c.checked = Date.now(); Object.assign(d, c); save(); toast('Gespeichert'); go('wegweiser'); });
  $('#checked')?.addEventListener('click', () => { Object.assign(d, collect(), { checked: Date.now() }); if (!d.has) d.has = 'ja'; save(); toast('Danke! Lifely erinnert Sie wieder.'); go('wegweiser'); });
};

/* ---------- Vorsorgeauftrag-Coach ---------- */
routes.coach = () => {
  const cur = COACH.findIndex((_, i) => !S.coach[i]);
  const who = S.guide.vertretung?.person;
  $app.innerHTML = `<section class="screen"><div class="top">${back('wegweiser', 'Wegweiser')}</div>
    <h1>Vorsorgeauftrag</h1><p class="lead">Schritt für Schritt. Sie können jederzeit pausieren.</p>
    <ol class="tl">${COACH.map(([t, s], i) => `<li class="${S.coach[i] ? 'done' : i === cur ? 'cur' : ''}"><button class="dot" data-step="${i}" aria-label="Schritt ${i + 1} ${S.coach[i] ? 'als offen markieren' : 'als erledigt markieren'}">${S.coach[i] ? '✓' : i + 1}</button>
      <div><b>${t}</b>${i === 0 && who ? `<small>${esc(who)}</small>` : ''}${i === cur || (i === 2 && !S.coach[2] && cur === 2) ? `<p class="note sunbg">${s}</p>` : `<small>${S.coach[i] ? 'Erledigt' : s.split('.')[0]}</small>`}</div></li>`).join('')}</ol>
    <p class="tiny">Lifely erstellt kein Rechtsdokument. Die genauen Regeln zu prüfen: Art. 360 ff. ZGB, KESB Ihres Kantons.</p>
    ${cur >= 0 ? `<div class="bottom"><button class="btn primary" data-step="${cur}">Schritt ${cur + 1} erledigt</button></div>` : '<p class="note">Alle Schritte erledigt. Lifely erinnert Sie jährlich.</p>'}
  </section>`;
  $app.querySelectorAll('[data-step]').forEach(b => b.onclick = () => {
    const i = +b.dataset.step; S.coach[i] = !S.coach[i];
    if (S.coach.filter(Boolean).length >= 4) Object.assign(g('vorsorgeauftrag'), { has: 'ja', checked: g('vorsorgeauftrag').checked || Date.now() });
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
  $app.innerHTML = `<section class="screen"><div class="top">${back('kreis', 'Mein Kreis')}</div>
    <h1>${isNew ? 'Person hinzufügen' : esc(p.name)}</h1>
    ${!isNew ? `<p class="idea"><b>Gesprächsidee:</b> ${esc(topicFor(p))}</p>${contactButtons(p)}` : ''}
    <form id="f" class="stack" style="margin-top:18px">
      <label class="field">Name<input class="in" id="name" value="${esc(p.name)}" placeholder="z. B. Anna" required></label>
      <label class="field">Beziehung<select class="in" id="rel">${RELATIONS.map(r => `<option ${p.rel === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label class="field">Telefon<input class="in" id="phone" inputmode="tel" value="${esc(p.phone)}" placeholder="z. B. 079 123 45 67"></label>
      <fieldset class="field"><legend>Wie oft möchten Sie sich melden?</legend><div class="seg">${RHYTHMS.map(([d, l]) => `<button type="button" data-r="${d}" aria-pressed="${p.rhythm === d}">${l}</button>`).join('')}</div></fieldset>
      <label class="row switch"><span class="m"><b>Vertrauensperson</b><small>Weiss im Ernstfall Bescheid und steht auf dem Notfallblatt.</small></span><input type="checkbox" id="trust" ${p.trust ? 'checked' : ''}><span class="sw" aria-hidden="true"></span></label>
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
  $('#del')?.addEventListener('click', async () => { if (await confirmSheet(`${p.name} entfernen?`, 'Die Person verschwindet aus Mein Kreis und vom Notfallblatt.', 'Ja, entfernen')) { S.kreis = S.kreis.filter(x => x !== p); save(); go('kreis'); } });
};
function downloadICS(p) {
  const d = new Date(Date.now() + DAY); d.setHours(10, 0, 0, 0);
  const dt = d.toISOString().replace(/[-:]/g, '').slice(0, 15);
  const rule = p.rhythm === 7 ? 'FREQ=WEEKLY' : p.rhythm === 14 ? 'FREQ=WEEKLY;INTERVAL=2' : 'FREQ=MONTHLY';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lifely//DE', 'BEGIN:VEVENT', `UID:${p.id}@lifely`, `DTSTAMP:${dt}Z`, `DTSTART:${dt}`, `RRULE:${rule}`,
    `SUMMARY:${p.name} anrufen`, 'DESCRIPTION:Ein kurzes Hallo freut die meisten mehr\\, als man denkt.', 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${p.name} anrufen`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  download(new Blob([ics], { type: 'text/calendar' }), `${p.name} anrufen.ics`);
  toast('Der Termin wird geöffnet. Bestätigen Sie ihn im Kalender.');
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* ---------- Meine Geschichte ---------- */
let histTab = 'antworten';
routes.geschichte = () => {
  const list = QUESTIONS.filter(q => answered(q.n) && (histTab === 'antworten' ? q.type !== 'w' : q.type === 'w')).reverse();
  $app.innerHTML = `<section class="screen"><h1>Meine Geschichte</h1><p class="lead">Ihre Antworten, Ihre Wünsche. Nur auf diesem Gerät.</p>
    <div class="seg"><button data-t="antworten" aria-pressed="${histTab === 'antworten'}">Antworten</button><button data-t="wichtig" aria-pressed="${histTab === 'wichtig'}">Das ist mir wichtig</button></div>
    ${histTab === 'wichtig' ? '<p class="tiny">Eine Gesprächsgrundlage für Familie und Hausarzt. Ausdrücklich keine Verfügung.</p>' : ''}
    <div class="list">${list.map(q => `<div class="card plain"><p class="eb teal">Woche ${q.n}</p><p class="qs">${esc(q.text)}</p><p class="ans">${esc(S.answers[q.n].text)}</p>
      <div class="mini"><button class="link" data-go="frage/${q.n}">Bearbeiten</button>${navigator.share ? ` · <button class="link" data-share="${q.n}">Teilen</button>` : ''}</div></div>`).join('') || `<div class="empty">${svg('book')}<p><b>Noch nichts hier.</b><br>Jede beantwortete Wochenfrage kommt hierher.</p></div>`}</div>
    ${list.length ? `<div class="card mint spread"><div><b>${histTab === 'antworten' ? 'Büchlein als PDF' : 'Gesprächskarte'}</b><p class="tiny">${list.length} Antworten · zum Ausdrucken oder Verschenken</p></div><button class="btn small primary" id="print">Erstellen</button></div>` : ''}
  </section>`;
  $app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { histTab = b.dataset.t; render(); });
  $app.querySelectorAll('[data-share]').forEach(b => b.onclick = async () => {
    const q = QUESTIONS[+b.dataset.share - 1];
    if (await confirmSheet('Antwort teilen?', 'Sie wählen gleich, mit wem. Lifely schickt nichts von selbst.', 'Ja, teilen')) navigator.share({ text: `${q.text}\n\n${S.answers[q.n].text}\n\n– ${S.name}` }).catch(() => {});
  });
  $app.querySelector('#print')?.addEventListener('click', () => printDoc(histTab === 'antworten' ? bookHTML() : cardHTML()));
};
const bookHTML = () => `<h1>Meine Geschichte</h1><p class="sub">${esc(S.name)} · erzählt mit Lifely · ${fmt(Date.now())}</p>
  ${QUESTIONS.filter(q => answered(q.n) && q.type !== 'w').map(q => `<h2>${esc(q.text)}</h2><p>${esc(S.answers[q.n].text).replace(/\n/g, '<br>')}</p>`).join('')}`;
const cardHTML = () => `<h1>Das ist mir wichtig</h1><p class="sub">${esc(S.name)} · ${fmt(Date.now())} · Gesprächsgrundlage, keine Verfügung</p>
  ${QUESTIONS.filter(q => answered(q.n) && q.type === 'w').map(q => `<h2>${esc(q.text)}</h2><p>${esc(S.answers[q.n].text).replace(/\n/g, '<br>')}</p>`).join('')}`;
function printDoc(html) { const el = document.getElementById('print'); el.innerHTML = html; window.print(); }

/* ---------- Assistent ---------- */
const chat = [];
routes.assistent = () => {
  $app.innerHTML = `<section class="screen"><div class="ahead"><span class="orb big">${svg('spark')}</span><div><h1>Ihr Assistent</h1><p class="tiny">Einfache Antworten, auf Deutsch</p></div></div>
    <div class="chat" id="chat"><div class="bub bot">Grüezi${S.name ? ' ' + esc(S.name) : ''}! Was möchten Sie wissen?</div>
    ${chat.map(m => `<div class="bub ${m.me ? 'me' : 'bot'}">${m.html}</div>`).join('')}</div>
    ${chat.length ? '' : `<div class="chips">${KB.slice(0, 5).map((k, i) => `<button class="chip" data-kb="${i}">${esc(k.q)}</button>`).join('')}</div>`}
    <form class="composer" id="ask"><input id="q" placeholder="Ihre Frage …" aria-label="Ihre Frage" autocomplete="off"><button aria-label="Frage senden">${svg('send')}</button></form>
    <p class="tiny">Antworten aus einer geprüften Wissensbasis. Keine Rechts- oder Arztberatung. Nichts verlässt Ihr Gerät.</p></section>`;
  const ask = (text) => {
    const lc = text.toLowerCase();
    const hit = KB.map(k => ({ k, s: k.keys.filter(w => lc.includes(w)).length + (k.q === text ? 9 : 0) })).sort((a, b) => b.s - a.s)[0];
    const html = hit.s ? hit.k.a + (hit.k.go ? `<br><button class="link" data-go="${hit.k.go}">Passenden Bereich öffnen</button>` : '')
      : 'Dazu weiss ich noch nichts. Versuchen Sie Stichworte wie <b>Patientenverfügung</b>, <b>Vorsorgeauftrag</b>, <b>Testament</b> oder <b>Todesfall</b>.';
    chat.push({ me: true, html: esc(text) }, { me: false, html }); render();
  };
  $app.querySelectorAll('[data-kb]').forEach(b => b.onclick = () => ask(KB[+b.dataset.kb].q));
  $app.querySelector('#ask').addEventListener('submit', (e) => { e.preventDefault(); const v = $app.querySelector('#q').value.trim(); if (v) ask(v); });
  if (chat.length) $app.querySelector('#chat').lastElementChild.scrollIntoView({ block: 'center' });
};

/* ---------- Notfall ---------- */
const trusted = () => S.kreis.filter(p => p.trust);
routes.notfall = () => {
  const old = S.lastExport && S.changed > S.lastExport;
  $app.innerHTML = `<section class="screen"><h1>Im Ernstfall</h1><p class="lead">Damit Ihre Vertrauensperson alles findet.</p>
    <div class="card dark"><div class="spread left">${svg('lock')}<b>Notfallpaket</b></div>
      <p class="tiny light">Eine verschlüsselte Datei mit Ihrem Wegweiser. Das Passwort steht nur auf dem Notfallblatt.</p>
      <button class="btn white" data-go="paket">Notfallpaket ${S.lastExport ? 'neu ' : ''}erstellen</button>
      <p class="tiny light center">${S.lastExport ? `Zuletzt erstellt: ${fmt(S.lastExport)}${old ? ' · seither geändert' : ''}` : 'Noch nicht erstellt'}</p></div>
    <button class="row" id="sheetBtn"><span class="ico">${svg('file')}</span><span class="m"><b>Notfallblatt drucken</b><small>Fundorte, Kontakte, Hilfsnummern</small></span></button>
    <button class="row" data-go="kreis"><span class="ico">${svg('people')}</span><span class="m"><b>Vertrauenspersonen</b><small>${trusted().map(p => esc(p.name)).join(' · ') || 'Noch niemand, in «Mein Kreis» festlegen'}</small></span><span class="chip">${trusted().length}</span></button>
    <button class="row" data-go="ansicht"><span class="ico coral">${svg('eye')}</span><span class="m"><b>Das sehen Angehörige</b><small>Vorschau der Notfall-Ansicht</small></span></button>
    <button class="row" data-go="oeffnen"><span class="ico">${svg('folder')}</span><span class="m"><b>Notfallpaket öffnen</b><small>Für Angehörige oder ein neues Gerät</small></span></button>
    <p class="note">${svg('shield')}<span>Lifely ist ein Wegweiser. Die Originale und die Rechte bleiben, wo sie sind. Eine Vertrauensperson in Lifely hat keine erbrechtliche Stellung.</span></p>
  </section>`;
  $app.querySelector('#sheetBtn').onclick = () => printDoc(sheetHTML());
};
const WORDS = ['Apfel', 'Berg', 'Sonne', 'Fluss', 'Garten', 'Brücke', 'Wolke', 'Linde', 'Kirsche', 'Laterne', 'Rose', 'Schwan', 'Bahnhof', 'Glocke', 'Kastanie', 'Ofen', 'Biene', 'Hafen', 'Meise', 'Tanne', 'Mühle', 'Stern', 'Fenster', 'Insel'];
const passphrase = () => { const r = crypto.getRandomValues(new Uint32Array(5)); return [0, 1, 2, 3].map(i => WORDS[r[i] % WORDS.length]).join('-') + '-' + (10 + r[4] % 90); };
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function keyFrom(pw, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
let lastPw = '';
routes.paket = () => {
  lastPw = passphrase();
  $app.innerHTML = `<section class="screen"><div class="top">${back('notfall', 'Notfall')}</div>
    <h1>Notfallpaket erstellen</h1><p class="lead">Lifely verschlüsselt Ihren Wegweiser, Ihren Kreis und Ihre Antworten in eine Datei.</p>
    <ol class="steps"><li>Datei speichern und Ihrer Vertrauensperson geben, z. B. per E-Mail oder USB-Stick.</li><li>Das <b>Notfallblatt drucken</b>. Nur darauf steht das Passwort.</li><li>Blatt an einem sicheren Ort aufbewahren und sagen, wo es liegt.</li></ol>
    <div class="card sun"><p class="eb">Ihr Passwort</p><p class="pw">${lastPw}</p><p class="tiny">Es wird nirgends in Lifely gespeichert.</p></div>
    <div class="bottom"><button class="btn primary" id="make">${svg('lock')}Notfallpaket speichern</button><button class="btn ghost" id="sheetBtn">${svg('file')}Notfallblatt mit Passwort drucken</button></div>
  </section>`;
  $app.querySelector('#make').onclick = async () => {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await keyFrom(lastPw, salt);
      const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(S)));
      download(new Blob([JSON.stringify({ lifely: 1, created: Date.now(), salt: b64(salt), iv: b64(iv), data: b64(data) })], { type: 'application/json' }), `Lifely-Notfallpaket-${S.name || 'Lifely'}.lifely`);
      S.lastExport = Date.now(); save(false); toast('Notfallpaket gespeichert. Drucken Sie jetzt das Notfallblatt.');
    } catch { toast('Das hat nicht geklappt. Bitte nochmals versuchen.'); }
  };
  $app.querySelector('#sheetBtn').onclick = () => printDoc(sheetHTML(lastPw));
};
let opened = null; // entschlüsseltes Paket (nur im Speicher, nur lesend)
routes.oeffnen = () => {
  $app.innerHTML = `<section class="screen"><div class="top">${back(S.setup ? 'notfall' : 'setup', 'Zurück')}</div>
    <h1>Notfallpaket öffnen</h1><p class="lead">Wählen Sie die Datei und geben Sie das Passwort vom Notfallblatt ein.</p>
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
    } catch { toast('Passwort oder Datei stimmt nicht. Bitte genau so eingeben, wie es auf dem Blatt steht.'); }
  });
};
routes.ansicht = (src) => {
  const D = src === 'paket' && opened ? opened : S;
  const ans = (type) => QUESTIONS.filter(q => q.type === type && D.answers?.[q.n]);
  const st = (i) => { const keep = S; S = Object.assign(blank(), D); const r = status(i); S = keep; return r; };
  $app.innerHTML = `<section class="screen"><div class="top">${back(src === 'paket' ? (S.setup ? 'notfall' : 'setup') : 'notfall', 'Zurück')}</div>
    <div class="card dark"><p class="eb light">${src === 'paket' ? 'Notfallpaket geöffnet' : 'Vorschau'} · nur lesen</p><h1 class="light">Was ${esc(D.name || 'die Person')} hinterlegt hat</h1></div>
    ${ans('w').length ? `<h2>Das ist mir wichtig</h2>${ans('w').map(q => `<div class="card plain"><p class="qs">${esc(q.text)}</p><p class="ans">${esc(D.answers[q.n].text)}</p></div>`).join('')}` : ''}
    <h2>Wichtige Kontakte</h2><div class="list">${(D.kreis || []).filter(p => p.trust).map(p => `<a class="row" href="tel:${esc(p.phone)}"><span class="ico av">${esc(initial(p.name))}</span><span class="m"><b>${esc(p.name)}</b><small>${esc(p.rel || '')} · ${esc(p.phone || 'keine Nummer')}</small></span></a>`).join('') || '<p class="tiny">Keine Vertrauenspersonen hinterlegt.</p>'}
    ${ans('p').map(q => `<div class="card plain"><p class="qs">${esc(q.text)}</p><p class="ans">${esc(D.answers[q.n].text)}</p></div>`).join('')}</div>
    <h2>Wegweiser</h2><div class="list">${GUIDE.map(i => { const [c, l, s] = st(i); return `<div class="row"><span class="ico">${svg(i.icon)}</span><span class="m"><b>${i.name}</b><small>${esc(s)}</small></span><span class="chip ${c}">${l}</span></div>`; }).join('')}</div>
    <h2>Was jetzt zu tun ist</h2><p class="tiny">Orientierung, im Einzelfall zu prüfen.</p>
    <ol class="steps"><li><b>Im Spital:</b> Patientenverfügung und Vorsorgeauftrag holen (Fundort oben), Hausarzt informieren.</li><li><b>Im Todesfall:</b> Todesbescheinigung durch Arzt oder Ärztin.</li><li>Innert 2 Tagen beim Zivilstandsamt melden (oft übernimmt dies Spital oder Bestatter).</li><li>Bestattungsunternehmen kontaktieren, Wünsche beachten.</li><li>Testament sofort der zuständigen Behörde einreichen.</li><li>Banken, AHV, Pensionskasse und Versicherungen informieren.</li></ol>
    <h2>Beratung und Hilfe</h2><div class="list">${HELP.map(h => `<a class="row" href="tel:${h.tel}"><span class="ico ${h.urgent ? 'coral' : ''}">${svg('phone')}</span><span class="m"><b>${h.n} · ${h.name}</b><small>${h.sub}</small></span></a>`).join('')}</div>
    ${src === 'paket' && opened ? '<div class="bottom"><button class="btn ghost" id="restore">Auf diesem Gerät übernehmen</button></div>' : ''}
  </section>`;
  $app.querySelector('#restore')?.addEventListener('click', async () => {
    if (await confirmSheet('Daten übernehmen?', 'Die Daten aus dem Notfallpaket ersetzen alles, was auf diesem Gerät in Lifely gespeichert ist.', 'Ja, übernehmen')) { S = Object.assign(blank(), opened); save(false); applySize(); toast('Übernommen.'); go('heute'); }
  });
};
function sheetHTML(pw) {
  const tr = trusted();
  return `<h1>Notfallblatt</h1><p class="sub">${esc(S.name)} · Stand ${fmt(Date.now())} · Lifely</p>
  ${pw ? `<div class="box"><b>Passwort für das Notfallpaket:</b><br><span class="pwp">${pw}</span><br><small>Die Datei «Lifely-Notfallpaket» öffnen Sie unter lifely → Notfall → «Notfallpaket öffnen».</small></div>` : ''}
  <h2>Wo liegt was?</h2><table>${GUIDE.map(i => { const d = S.guide[i.id] || {}; return `<tr><td><b>${i.name}</b></td><td>${i.person ? esc(d.person || '–') : d.has === 'ja' ? esc(d.where || S.papiere || 'Fundort fehlt') + (d.copy ? ' · Kopie: ' + esc(d.copy) : '') : d.has === 'nein' ? 'nicht vorhanden' : '–'}</td></tr>`; }).join('')}</table>
  <h2>Vertrauenspersonen</h2><table>${tr.map(p => `<tr><td><b>${esc(p.name)}</b> (${esc(p.rel || '')})</td><td>${esc(p.phone || '')}</td></tr>`).join('') || '<tr><td>–</td></tr>'}</table>
  <h2>Hilfe</h2><table>${HELP.map(h => `<tr><td><b>${h.n}</b></td><td>${h.name}</td></tr>`).join('')}</table>
  <p class="sub">Lifely ist ein Wegweiser und kein Rechtsdokument. Originale bleiben am genannten Ort.</p>`;
}

/* ---------- Profil und Sicherheit ---------- */
routes.profil = () => {
  $app.innerHTML = `<section class="screen"><div class="top">${back('heute', 'Heute')}</div>
    <div class="prof"><span class="avatar big">${esc(initial(S.name))}</span><div><h1>${esc(S.name)}</h1><p class="tiny">Seit ${fmt(S.start)} · Woche ${S.qi + 1} von 52</p></div></div>
    <h2>Schriftgrösse</h2>${sizeSeg()}
    <h2>Einstellungen</h2><div class="list">
      <button class="row" data-go="sicherheit"><span class="ico">${svg('shield')}</span><span class="m"><b>Sicherheit auf einen Blick</b><small>Wo liegen die Daten, was wird nie gespeichert</small></span>${svg('chev', 'chev')}</button>
      <div class="row"><span class="ico">${svg('globe')}</span><span class="m"><b>Sprache</b><small>Deutsch · Français, Italiano, English folgen</small></span></div>
      <button class="row" id="name"><span class="ico">${svg('pen')}</span><span class="m"><b>Name ändern</b><small>${esc(S.name)}</small></span>${svg('chev', 'chev')}</button>
    </div>
    <div class="stack" style="margin-top:22px"><button class="btn ghost" id="demo">Demo mit Margrit laden</button><button class="btn danger" id="wipe">Alle Daten löschen</button></div>
    <p class="tiny center">Lifely 2.0 · Prototyp einer Projektarbeit der BFH (Modul EBDS)</p></section>`;
  $app.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { S.size = b.dataset.size; applySize(); save(false); render(); });
  $app.querySelector('#name').onclick = () => { const n = prompt('Wie dürfen wir Sie ansprechen?', S.name); if (n?.trim()) { S.name = n.trim(); save(); render(); } };
  $app.querySelector('#demo').onclick = async () => { if (await confirmSheet('Demo laden?', 'Ihre eigenen Eingaben werden durch Margrits Beispieldaten ersetzt.', 'Demo laden')) { loadDemo(); go('heute'); } };
  $app.querySelector('#wipe').onclick = async () => { if (await confirmSheet('Alle Daten löschen?', 'Antworten, Wegweiser und Mein Kreis werden von diesem Gerät entfernt. Ein Notfallpaket bleibt, wo Sie es gespeichert haben.', 'Ja, alles löschen')) { localStorage.removeItem(KEY); S = blank(); applySize(); go('setup'); } };
};
routes.sicherheit = () => {
  $app.innerHTML = `<section class="screen"><div class="top">${back('profil', 'Profil')}</div><h1>Sicherheit auf einen Blick</h1>
    <ul class="checks"><li>${svg('phoneDev')}<span><b>Wo liegen die Daten?</b> Nur in diesem Browser auf diesem Gerät. Kein Konto, keine Cloud, kein Server.</span></li>
    <li>${svg('spark')}<span><b>Was geht an eine KI?</b> Nichts. Der Assistent antwortet aus einer Wissensbasis auf dem Gerät.</span></li>
    <li>${svg('lock')}<span><b>Was wird nie gespeichert?</b> Passwörter, PINs, Kontonummern. Lifely fragt nur, <i>wo</i> etwas ist.</span></li>
    <li>${svg('shield')}<span><b>Notfallpaket:</b> verschlüsselt (AES-256). Ohne das Passwort vom Notfallblatt kann niemand die Datei lesen.</span></li>
    <li>${svg('bell')}<span><b>Wichtig:</b> Wenn Sie die Browserdaten löschen, sind die Daten weg. Erstellen Sie darum regelmässig ein Notfallpaket.</span></li></ul></section>`;
};

/* ---------- Demo-Daten (Margrit) ---------- */
function loadDemo() {
  const now = Date.now();
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
      versicherungen: { has: 'ja', where: 'Schrank links, grüner Ordner', checked: now - 200 * DAY },
      konten: {},
    },
    coach: [true, true],
    kreis: [
      { id: 'p1', name: 'Anna', rel: 'Tochter', phone: '079 123 45 67', rhythm: 7, last: now - 8 * DAY, trust: true },
      { id: 'p2', name: 'Thomas', rel: 'Sohn', phone: '078 765 43 21', rhythm: 14, last: now - 3 * DAY, trust: true },
      { id: 'p3', name: 'Ruth', rel: 'Nachbar/in', phone: '031 123 45 67', rhythm: 30, last: now - 10 * DAY, trust: false },
    ],
    lastExport: now - 18 * DAY, changed: now - DAY, size: S.size,
  });
  save(false); applySize();
}

/* ---------- Start ---------- */
applySize();
if (new URLSearchParams(location.search).has('demo') && !S.setup) loadDemo();
render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
