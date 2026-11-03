/* 夜読文庫 — 書架（只放封面，資訊都在書目頁） */

import { coverHTML } from './cover.js';

const KEY_PROGRESS = 'yodoku.progress';
const KEY_GATE = 'yodoku.gate';

const $ = (s, r = document) => r.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const fmtWords = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1)} 萬字` : `${n.toLocaleString()} 字`);

const bookHref = (b) => `book.html?b=${encodeURIComponent(b.slug)}`;

function card(book, i, progress) {
  const p = progress[book.slug];
  const el = document.createElement('article');
  el.className = 'book';
  el.style.animationDelay = `${Math.min(i * 70, 500)}ms`;
  el.dataset.search = [book.title, book.subtitle, book.author, ...(book.tags || [])].join(' ').toLowerCase();

  const pct = p ? Math.min(1, (p.max + 1) / book.stats.chapters) : 0;

  el.innerHTML = `
    <a class="book__coverwrap" href="${bookHref(book)}" aria-label="${book.title}">
      ${coverHTML(book)}
    </a>
    <div class="book__body">
      <h3><a class="book__title" href="${bookHref(book)}">${book.title}</a></h3>
      <p class="book__sub">${book.subtitle || ''}</p>
      <div class="book__foot">
        <span>${book.stats.chapters} 話 · ${fmtWords(book.stats.words)}</span>
        ${p ? `<span class="resume">續讀 ${p.ch + 1}</span>` : ''}
      </div>
      <div class="pbar"><i style="transform:scaleX(${pct})"></i></div>
    </div>`;
  return el;
}

async function boot() {
  const data = await fetch('data/books.json').then((r) => r.json());
  const site = data.site || {};
  const books = data.books || [];

  document.title = site.title || '夜読文庫';
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
    $('#cfBuilt').textContent =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}　靜態生成`;
  }

  const progress = load(KEY_PROGRESS, {});
  const shelf = $('#shelf');
  shelf.innerHTML = '';
  shelf.classList.toggle('solo', books.length === 1);
  books.forEach((b, i) => shelf.append(card(b, i, progress)));

  // 標籤
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

/* 18+ 門口 */
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
