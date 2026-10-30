/* Lifely 2.0 – Landingpage: Animationen (Einblenden, Story, Wortfarbe beim Scrollen, Zähler). Ohne Bibliotheken. */
document.documentElement.classList.add('js');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Wörter einzeln einpacken (für Überschrift und Aussage), Spans wie .grad bleiben erhalten
function splitWords(el) {
  let i = 0;
  const walk = (node) => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) return frag.append(part);
        const w = document.createElement('span'); w.className = 'w'; w.style.setProperty('--i', i++); w.textContent = part; frag.append(w);
      });
      n.replaceWith(frag);
    } else walk(n);
  });
  walk(el);
  return $$('.w', el);
}

// Navigation bekommt beim Scrollen eine Linie
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// Hero: Wörter und Hinweise einblenden
const h1 = $('.split-words');
splitWords(h1);
requestAnimationFrame(() => setTimeout(() => { h1.classList.add('go'); $('.hero-art').classList.add('go'); }, 60));

// Einblenden beim Scrollen
const io = new IntersectionObserver((entries) => entries.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  e.target.dispatchEvent(new CustomEvent('seen'));
  io.unobserve(e.target);
}), { threshold: .18, rootMargin: '0px 0px -40px 0px' });
$$('.rv').forEach(el => io.observe(el));
const steps = $('.steps');
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { steps.classList.add('go'); o.disconnect(); } }, { threshold: .3 }).observe(steps);

// Story im Hero-Handy: Bilder wechseln wie bei einer Instagram-Story
(() => {
  const box = $('#story'), imgs = $$('img', box), bars = $$('.story-bars i', box);
  const DUR = 4200; let i = 0, t;
  const show = (n) => {
    i = (n + imgs.length) % imgs.length;
    imgs.forEach((im, k) => im.classList.toggle('on', k === i));
    bars.forEach((b, k) => { b.classList.remove('run'); b.classList.toggle('done', k < i); });
    void box.offsetWidth; // Animation neu starten
    bars[i].style.setProperty('--dur', DUR + 'ms'); bars[i].classList.add('run');
    clearTimeout(t); if (!calm) t = setTimeout(() => show(i + 1), DUR);
  };
  // Antippen: links zurück, rechts weiter
  box.addEventListener('click', (e) => { const r = box.getBoundingClientRect(); show(e.clientX - r.left < r.width / 3 ? i - 1 : i + 1); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(t); else show(i); });
  show(0);
})();

// Aussage: Wörter färben sich beim Scrollen ein
(() => {
  const el = $('#fill'); const words = splitWords(el);
  words.forEach(w => { if (/^(Frage|Bescheid|Wegweiser)/.test(w.textContent)) w.classList.add('hl'); });
  if (calm) return words.forEach(w => w.classList.add('lit'));
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = el.getBoundingClientRect(), vh = innerHeight;
    const p = Math.min(1, Math.max(0, (vh * .85 - r.top) / (r.height + vh * .35)));
    const n = Math.round(p * words.length);
    words.forEach((w, k) => w.classList.toggle('lit', k < n));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

// Zahlen hochzählen
const countUp = (el, to, fmt = (v) => v, ms = 1400) => {
  if (calm) return fmt(to);
  const t0 = performance.now();
  const step = (now) => { const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3); fmt(Math.round(to * e)); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
};
$$('.count').forEach(b => {
  const to = +b.dataset.to; b.textContent = calm ? to : 0;
  b.closest('.rv').addEventListener('seen', () => countUp(b, to, v => (b.textContent = v), 1100));
});
// Fortschrittsring
const ring = $('#ring');
ring.closest('.rv').addEventListener('seen', () => countUp(ring, +ring.dataset.to, v => { ring.style.setProperty('--p', v); $('#ringNum').textContent = v + ' %'; }, 1800));

// Fragen: weich auf- und zuklappen
$$('details').forEach(d => {
  const s = $('summary', d), a = $('.ans', d);
  s.addEventListener('click', (e) => {
    if (calm || !a.animate) return;
    e.preventDefault();
    if (d.open) {
      a.animate([{ height: a.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 280, easing: 'ease' }).onfinish = () => (d.open = false);
    } else {
      d.open = true;
      a.animate([{ height: '0px', opacity: 0 }, { height: a.offsetHeight + 'px', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  });
});

// Kontaktformular: im Prototyp nicht verbunden, zeigt nur eine Bestätigung
const form = $('#kontakt-form');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  form.hidden = true; $('#kontakt-ok').hidden = false;
});
