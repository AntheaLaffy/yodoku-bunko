/* 夜読文庫 — reader */

const KEY_PREFS = 'yodoku.prefs';
const KEY_PROGRESS = 'yodoku.progress';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const load = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
};

const params = new URLSearchParams(location.search);
const slug = params.get('b');

const state = {
  book: null,
  ch: Math.max(0, parseInt(params.get('ch') ?? '0', 10) || 0),
  cache: new Map(),
  restorePct: 0,
  saved: false
};

/* ============================================================
   prefs
   ============================================================ */

const defaults = { fs: 1.1, lh: 2.05, ff: 'kai', theme: 'night' };
let prefs = { ...defaults, ...load(KEY_PREFS, {}) };
if (prefs.ff === 'serif') prefs.ff = 'kai';
if (prefs.ff === 'sans') prefs.ff = 'hei';

function applyPrefs() {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.style.setProperty('--fs', `${prefs.fs}rem`);
  root.style.setProperty('--lh', prefs.lh);
  $('#fsVal').textContent = `${Math.round((prefs.fs / 1.1) * 100)}%`;
  $('#chBody')?.setAttribute('data-font', prefs.ff);
  $$('#lhSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.lh === +prefs.lh));
  $$('#ffSeg button').forEach((b) => b.classList.toggle('on', b.dataset.ff === prefs.ff));
  $$('#sw .sw').forEach((b) => b.classList.toggle('on', b.dataset.t === prefs.theme));
  $('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
  localStorage.setItem(KEY_PREFS, JSON.stringify(prefs));
}

/* ============================================================
   progress
   ============================================================ */

function saveProgress(pct = currentPct()) {
  if (!state.book) return;
  const all = load(KEY_PROGRESS, {});
  const prev = all[slug] || {};
  all[slug] = {
    ch: state.ch,
    pct: Math.round(pct * 1000) / 1000,
    max: Math.max(prev.max ?? 0, state.ch),
    at: Date.now()
  };
  localStorage.setItem(KEY_PROGRESS, JSON.stringify(all));
}

function currentPct() {
  const h = document.documentElement.scrollHeight - innerHeight;
  return h > 0 ? Math.min(1, Math.max(0, scrollY / h)) : 0;
}

/* ============================================================
   data
   ============================================================ */

async function getJSON(url) {
  if (!state.cache.has(url)) {
    state.cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    }));
  }
  return state.cache.get(url);
}

const chapterURL = (id) => `data/books/${slug}/${id}.json`;

/* ============================================================
   render
   ============================================================ */

function emptyPage(msg) {
  $('#page').innerHTML = `<div class="loading">${msg}</div>`;
}

async function render() {
  const book = state.book;
  const list = book.chapters;
  state.ch = Math.min(Math.max(0, state.ch), list.length - 1);
  const meta = list[state.ch];

  let ch;
  try {
    ch = await getJSON(chapterURL(meta.id));
  } catch {
    emptyPage('章節加載失敗');
    return;
  }

  const prev = list[state.ch - 1];
  const next = list[state.ch + 1];
  const no = String(state.ch + 1).padStart(2, '0');

  const page = $('#page');
  page.style.animation = 'none';
  page.innerHTML = `
    <header class="chead">
      <div class="chead__no">CH. ${no} / ${String(list.length).padStart(2, '0')}</div>
      <h1>${ch.title}</h1>
      <div class="chead__meta">${ch.words.toLocaleString()} 字 · 約 ${meta.minutes} 分鐘</div>
    </header>
    <div class="body" id="chBody" data-font="${prefs.ff}">${ch.html}</div>
    <div class="cend">❖</div>
    <nav class="cnav">
      <a class="cnav__btn ${prev ? '' : 'disabled'}" href="#" data-go="${state.ch - 1}">${prev ? '← ' + prev.title : '已是開篇'}</a>
      <button class="cnav__mid" id="midToc" title="目錄">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </button>
      <a class="cnav__btn ${next ? '' : 'disabled'}" href="#" data-go="${state.ch + 1}">${next ? next.title + ' →' : '已至終章'}</a>
    </nav>
    <div class="footnote">
      ${book.title}${book.subtitle ? `　${book.subtitle}` : ''}<br />
      ${book.author ? `${book.author} 著　` : ''}非官方中譯<br />
      ${book.epub ? `<a class="foot-link" href="${book.epub}" download>下載 EPUB${book.epubSize ? `（${(book.epubSize / 1024).toFixed(0)} KB）` : ''}</a> · ` : ''}
      <a class="foot-link" href="assets/fonts/OFL.txt" target="_blank" rel="noopener">字體 · 霞鹜文楷 LXGW WenKai（OFL 1.1）</a>
    </div>
  `;
  void page.offsetWidth;
  page.style.animation = '';

  $('#hbTitle').textContent = book.title;
  $('#hbCh').textContent = ch.title;
  document.title = `${ch.title} · ${book.title}`;

  // toc active
  $$('.tocitem').forEach((el, i) => {
    el.classList.toggle('active', i === state.ch);
    el.classList.toggle('read', i < state.ch || i <= (load(KEY_PROGRESS, {})[slug]?.max ?? -1));
  });
  $('#dList').querySelector('.tocitem.active')?.scrollIntoView({ block: 'center' });

  // nav
  $$('[data-go]').forEach((el) => {
    el.onclick = (e) => {
      e.preventDefault();
      goTo(+el.dataset.go);
    };
  });
  $('#midToc').onclick = openToc;

  // position
  if (state.restorePct > 0.01) {
    const pct = state.restorePct;
    state.restorePct = 0;
    requestAnimationFrame(() => {
      const h = document.documentElement.scrollHeight - innerHeight;
      scrollTo({ top: h * pct, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    });
  } else {
    scrollTo({ top: 0 });
  }

  history.replaceState({ ch: state.ch }, '', `?b=${encodeURIComponent(slug)}&ch=${state.ch}`);
  saveProgress(0);
  updateBar();

  // preload next
  if (next) getJSON(chapterURL(next.id)).catch(() => {});
}

function goTo(i, push = true) {
  if (!state.book || i < 0 || i >= state.book.chapters.length) return;
  state.ch = i;
  state.restorePct = 0;
  if (push) history.pushState({ ch: i }, '', `?b=${encodeURIComponent(slug)}&ch=${i}`);
  render();
  window.scrollTo({ top: 0 });
}

/* ============================================================
   chrome
   ============================================================ */

function updateBar() {
  $('#progress').style.transform = `scaleX(${currentPct()})`;
}

let lastY = 0;
let ticking = false;
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveProgress(); }, 700);
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY;
    const head = $('#rhead');
    head.classList.toggle('scrolled', y > 20);
    if (y > 320 && y > lastY + 6) head.classList.add('hide');
    else if (y < lastY - 6 || y < 160) head.classList.remove('hide');
    lastY = y;
    updateBar();
    scheduleSave();
    ticking = false;
  });
}

function openToc() {
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('show');
  $('#dList').querySelector('.tocitem.active')?.scrollIntoView({ block: 'center' });
}

function closeAll() {
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#scrim').classList.remove('show');
  $('#sheet').classList.remove('open');
  $('#sheet').setAttribute('aria-hidden', 'true');
  $('#btnFont').classList.remove('on');
}

function buildToc() {
  const book = state.book;
  const prog = load(KEY_PROGRESS, {})[slug];
  const max = prog?.max ?? -1;
  $('#dTitle').innerHTML = `<a href="book.html?b=${encodeURIComponent(slug)}">${book.title}</a>`;
  $('#dSub').innerHTML = `<span class="sl">${book.subtitle || ''}</span><span class="sm">${book.stats.chapters} 話 · ${(book.stats.words / 10000).toFixed(1)} 萬字</span>`;
  const box = $('#dList');
  box.innerHTML = '';
  book.chapters.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'tocitem' + (i <= max ? ' read' : '');
    b.innerHTML = `<span class="no">${String(i + 1).padStart(2, '0')}</span><span class="tt">${c.title}</span><span class="dot"></span>`;
    b.onclick = () => { closeAll(); goTo(i); };
    box.append(b);
  });
}

/* ============================================================
   events
   ============================================================ */

function bind() {
  $('#btnToc').onclick = openToc;
  $('#scrim').onclick = closeAll;

  $('#btnFont').onclick = () => {
    const s = $('#sheet');
    const open = !s.classList.contains('open');
    s.classList.toggle('open', open);
    s.setAttribute('aria-hidden', String(!open));
    $('#btnFont').classList.toggle('on', open);
  };

  $('#fsUp').onclick = () => { prefs.fs = Math.min(1.5, +(prefs.fs + 0.06).toFixed(2)); applyPrefs(); };
  $('#fsDown').onclick = () => { prefs.fs = Math.max(0.86, +(prefs.fs - 0.06).toFixed(2)); applyPrefs(); };
  $$('#lhSeg button').forEach((b) => (b.onclick = () => { prefs.lh = +b.dataset.lh; applyPrefs(); }));
  $$('#ffSeg button').forEach((b) => (b.onclick = () => { prefs.ff = b.dataset.ff; applyPrefs(); }));
  $$('#sw .sw').forEach((b) => (b.onclick = () => { prefs.theme = b.dataset.t; applyPrefs(); }));

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowRight' || k === 'j') goTo(state.ch + 1);
    else if (e.key === 'ArrowLeft' || k === 'k') goTo(state.ch - 1);
    else if (k === 'm') $('#drawer').classList.contains('open') ? closeAll() : openToc();
    else if (k === 't') { prefs.theme = { night: 'moon', moon: 'paper', paper: 'white', white: 'night' }[prefs.theme]; applyPrefs(); }
    else if (e.key === 'Escape') closeAll();
  });
  addEventListener('popstate', () => {
    const p = new URLSearchParams(location.search);
    state.ch = Math.max(0, parseInt(p.get('ch') ?? '0', 10) || 0);
    state.restorePct = 0;
    render();
  });
  addEventListener('beforeunload', () => saveProgress());
  addEventListener('pagehide', () => saveProgress());
  // save on tab hide / navigation through links
  addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); });
  $$('.rhead__back').forEach((a) => addEventListener('click', () => saveProgress()));
}

/* ============================================================
   boot
   ============================================================ */

async function boot() {
  applyPrefs();
  if (!slug) return (location.href = 'index.html');

  try {
    state.book = await getJSON(`data/books/${slug}/meta.json`);
  } catch {
    return emptyPage('找不到這本書');
  }

  const p = load(KEY_PROGRESS, {})[slug];
  if (!params.has('ch')) state.ch = p ? Math.min(p.ch, state.book.chapters.length - 1) : 0;

  const list = state.book.chapters;
  state.ch = Math.min(Math.max(0, state.ch), list.length - 1);
  if (p && p.ch === state.ch && p.pct > 0.01) state.restorePct = p.pct;

  const back = document.querySelector('.rhead__back');
  if (back) back.href = `book.html?b=${encodeURIComponent(slug)}`;

  buildToc();
  bind();
  await render();
  history.replaceState({ ch: state.ch }, '', `?b=${encodeURIComponent(slug)}&ch=${state.ch}`);
}

boot();
