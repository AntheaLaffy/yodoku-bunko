/* 夜読文庫 — library shelf */

const KEY_PROGRESS = 'yodoku.progress';
const KEY_GATE = 'yodoku.gate';

const $ = (s, r = document) => r.querySelector(s);

const hexToRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const load = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; }
};

const fmtWords = (n) =>
  n >= 10000 ? `${(n / 10000).toFixed(1)} 萬字` : `${n.toLocaleString()} 字`;

const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

/* ---------- cover art ---------- */

function motif(kind, accent) {
  const a = hexToRgba(accent, 0.55);
  const b = hexToRgba(accent, 0.14);
  const common = `fill="none" stroke="${a}" stroke-width="1"`;

  if (kind === 'wave') {
    return `<svg viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice">
      ${[0, 1, 2, 3, 4, 5, 6].map((i) =>
        `<circle cx="150" cy="${330 + i * 26}" r="${60 + i * 26}" ${common} stroke-opacity="${0.5 - i * 0.055}"/>`
      ).join('')}
      <circle cx="150" cy="70" r="34" fill="${b}"/>
    </svg>`;
  }
  if (kind === 'blade') {
    return `<svg viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice">
      ${Array.from({ length: 9 }, (_, i) =>
        `<line x1="${-40 + i * 46}" y1="440" x2="${120 + i * 46}" y2="-20" stroke="${hexToRgba(accent, 0.16)}" stroke-width="1"/>`
      ).join('')}
      <circle cx="228" cy="96" r="42" fill="${b}"/>
    </svg>`;
  }
  if (kind === 'petal') {
    return `<svg viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice">
      <circle cx="210" cy="90" r="58" fill="${b}"/>
      ${Array.from({ length: 16 }, (_, i) => {
        const x = 30 + ((i * 71) % 250);
        const y = 40 + ((i * 137) % 340);
        return `<ellipse cx="${x}" cy="${y}" rx="7" ry="3.4" fill="${hexToRgba(accent, 0.3)}" transform="rotate(${(i * 47) % 180} ${x} ${y})"/>`;
      }).join('')}
    </svg>`;
  }
  // moon
  return `<svg viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice">
    <circle cx="196" cy="118" r="76" fill="${hexToRgba(accent, 0.16)}"/>
    <circle cx="196" cy="118" r="76" fill="none" stroke="${hexToRgba(accent, 0.34)}" stroke-width="1"/>
    <circle cx="196" cy="118" r="96" fill="none" stroke="${hexToRgba(accent, 0.12)}" stroke-width="1"/>
    <path d="M0 300 Q 75 268 150 300 T 300 300" fill="none" stroke="${hexToRgba(accent, 0.2)}" stroke-width="1"/>
    <path d="M0 326 Q 75 294 150 326 T 300 326" fill="none" stroke="${hexToRgba(accent, 0.13)}" stroke-width="1"/>
  </svg>`;
}

const coverHTML = (c, book) => `
  <div class="cover" style="--from:${c.from};--to:${c.to};--accent-soft:${hexToRgba(c.accent, 0.16)};--accent-line:${hexToRgba(c.accent, 0.45)}">
    <span class="cover__frame"></span>
    <span class="cover__motif">${motif(c.motif, c.accent)}</span>
    <span class="cover__veil"></span>
    <span class="cover__mark">YODOKU</span>
    <span class="cover__title">${book.title}</span>
    <span class="cover__sub">${book.subtitle || ''}</span>
    <span class="cover__author">${book.author || ''}</span>
  </div>`;

const href = (b, ch) => `read.html?b=${encodeURIComponent(b.slug)}${ch != null ? `&ch=${ch}` : ''}`;

/* ---------- 网格卡（多书时） ---------- */

function card(book, i, progress) {
  const p = progress[book.slug];
  const el = document.createElement('article');
  el.className = 'book';
  el.style.animationDelay = `${Math.min(i * 70, 500)}ms`;
  el.dataset.search = [book.title, book.subtitle, book.author, ...(book.tags || [])].join(' ').toLowerCase();

  const pct = p ? Math.min(1, (p.max + 1) / book.stats.chapters) : 0;

  el.innerHTML = `
    <a class="book__coverwrap" href="${href(book, p ? p.ch : null)}" aria-label="${book.title}">
      ${coverHTML(book.cover, book)}
    </a>
    <div class="book__body">
      <h3><a class="book__title" href="${href(book, p ? p.ch : null)}">${book.title}</a></h3>
      <p class="byline">${book.author ? `${book.author} 著` : ''}${book.author ? ' · ' : ''}<span class="tr">如月風鈴 譯</span></p>
      <div class="book__tags">${(book.tags || []).map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      <div class="book__foot">
        ${p
          ? `<span class="resume">續讀 · 第 ${p.ch + 1} 話</span>`
          : `<span>${book.stats.chapters} 話 · ${fmtWords(book.stats.words)}</span>`}
        ${book.epub
          ? `<a class="book__epub" href="${book.epub}" download title="下載 EPUB">EPUB</a>`
          : `<span>${book.stats.minutes} 分鐘</span>`}
      </div>
      <div class="pbar"><i style="transform:scaleX(${pct})"></i></div>
    </div>`;
  return el;
}

/* ---------- 主视觉卡（少书时） ---------- */

function featureCard(book, progress) {
  const p = progress[book.slug];
  const el = document.createElement('article');
  el.className = 'book feature';
  el.dataset.search = [book.title, book.subtitle, book.author, ...(book.tags || [])].join(' ').toLowerCase();

  const cta = p ? `繼續閱讀 · 第 ${p.ch + 1} 話` : '開始閱讀';
  const pct = p ? Math.min(1, (p.max + 1) / book.stats.chapters) : 0;

  el.innerHTML = `
    <a class="book__coverwrap" href="${href(book, p ? p.ch : null)}" aria-label="${book.title}">
      ${coverHTML(book.cover, book)}
    </a>
    <div class="feature__body">
      <div class="kicker">${book.publisher || '單行本'} · ${book.stats.chapters} 話</div>
      <h2><a class="book__title" href="${href(book, p ? p.ch : null)}">${book.title}</a></h2>
      <p class="feature__sub">${book.subtitle || ''}</p>
      <p class="byline">${book.author ? `${book.author} 著` : ''}${book.author ? ' · ' : ''}<span class="tr">如月風鈴 譯</span></p>
      <p class="feature__syn">${book.synopsis || ''}</p>
      <div class="book__tags">${(book.tags || []).map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      <div class="feature__actions">
        <a class="btn btn--gold" href="${href(book, p ? p.ch : null)}">${cta}</a>
        ${book.epub ? `<a class="btn btn--ghost" href="${book.epub}" download>下載 EPUB${book.epubSize ? ` · ${fmtSize(book.epubSize)}` : ''}</a>` : ''}
        <span class="feature__meta">${(book.stats.words / 10000).toFixed(1)} 萬字 · 約 ${book.stats.minutes} 分鐘</span>
      </div>
      <div class="pbar"><i style="transform:scaleX(${pct})"></i></div>
    </div>`;
  return el;
}

/* ---------- boot ---------- */

async function boot() {
  const res = await fetch('data/books.json');
  const data = await res.json();
  const site = data.site || {};
  const books = data.books || [];

  document.title = `${site.title || '夜読文庫'} · 如月風鈴`;
  $('#siteTitle').textContent = site.title || '夜読文庫';
  $('#siteEn').textContent = site.titleEn || '';
  $('#siteSub').textContent = site.subtitle || '';
  if (site.footer) $('#footNote').textContent = site.footer;

  const totalCh = books.reduce((s, b) => s + b.stats.chapters, 0);
  const totalWords = books.reduce((s, b) => s + b.stats.words, 0);
  $('#statBooks').textContent = books.length;
  $('#statChapters').textContent = totalCh;
  $('#statWords').textContent = totalWords >= 10000 ? (totalWords / 10000).toFixed(1) + '萬' : totalWords;
  $('#cfBooks').textContent = `${books.length} 部作品 · ${totalCh} 章`;

  const built = data.generatedAt || books.find((b) => b.builtAt)?.builtAt;
  if (built) {
    const d = new Date(built);
    $('#cfBuilt').textContent = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}\n靜態生成`;
  }

  const progress = load(KEY_PROGRESS, {});
  const shelf = $('#shelf');
  shelf.innerHTML = '';

  if (books.length === 1) {
    shelf.classList.add('solo');
    shelf.append(featureCard(books[0], progress));
  } else {
    books.forEach((b, i) => shelf.append(card(b, i, progress)));
  }

  // tags
  const tagSet = [...new Set(books.flatMap((b) => b.tags || []))];
  const tagBar = $('#tags');
  tagSet.forEach((t) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = t;
    btn.onclick = () => {
      const on = btn.classList.contains('on');
      [...tagBar.children].forEach((c) => c.classList.remove('on'));
      if (!on) btn.classList.add('on');
      apply();
    };
    tagBar.append(btn);
  });

  const q = $('#q');
  const apply = () => {
    const term = q.value.trim().toLowerCase();
    const tag = tagBar.querySelector('.chip.on')?.textContent;
    let n = 0;
    [...shelf.children].forEach((el) => {
      const hit = (!term || el.dataset.search.includes(term)) && (!tag || el.dataset.search.includes(tag.toLowerCase()));
      el.style.display = hit ? '' : 'none';
      if (hit) n++;
    });
    let empty = shelf.querySelector('.empty');
    if (!n) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'empty';
        empty.style.gridColumn = '1/-1';
        empty.textContent = '空 卷';
        shelf.append(empty);
      }
    } else empty?.remove();
  };
  q.addEventListener('input', apply);
}

/* ---------- gate ---------- */

function gate() {
  const el = $('#gate');
  if (localStorage.getItem(KEY_GATE) === '1') return;
  el.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#gateYes').onclick = () => {
    localStorage.setItem(KEY_GATE, '1');
    el.hidden = true;
    document.body.style.overflow = '';
  };
  $('#gateNo').onclick = () => { location.replace('https://www.google.com'); };
}

gate();
boot().catch((e) => {
  console.error(e);
  $('#shelf').innerHTML = '<div class="empty" style="grid-column:1/-1">書架加載失敗</div>';
});
