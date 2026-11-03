/* 夜読文庫 — 書目頁（簡介 + 目錄 + 續讀） */

import { coverHTML } from './cover.js';

const KEY_PROGRESS = 'yodoku.progress';
const $ = (s, r = document) => r.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const fmtWords = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1)} 萬字` : `${n.toLocaleString()} 字`);
const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

const slug = new URLSearchParams(location.search).get('b');

async function boot() {
  if (!slug) return (location.href = 'index.html');

  const data = await fetch('data/books.json').then((r) => r.json());
  const book = (data.books || []).find((b) => b.slug === slug);
  if (!book) {
    $('#bookpage').innerHTML = '<div class="empty">找不到這本書</div>';
    return;
  }

  document.title = `${book.title} · 夜読文庫`;

  const p = load(KEY_PROGRESS, {})[slug];
  const total = book.stats.chapters;
  const done = p ? Math.min(total, p.max + 1) : 0;
  const pct = p ? Math.min(1, done / total) : 0;
  const at = p ? Math.min(p.ch, total - 1) : 0;

  const ctaLabel = p ? (p.pct > 0.85 ? `繼續閱讀 · 第 ${at + 1} 話` : `繼續閱讀 · 第 ${at + 1} 話`) : '開始閱讀';
  const readHref = `read.html?b=${encodeURIComponent(slug)}&ch=${at}`;

  const chapters = book.chapters.map((c, i) => {
    const read = p && i <= p.max;
    const current = p && i === p.ch;
    return `
      <li class="chapitem${read ? ' read' : ''}${current ? ' current' : ''}">
        <a href="read.html?b=${encodeURIComponent(slug)}&ch=${i}">
          <span class="no">${String(i + 1).padStart(2, '0')}</span>
          <span class="tt">${c.title}</span>
          <span class="meta">${c.minutes} 分鐘</span>
          <span class="dot"></span>
        </a>
      </li>`;
  }).join('');

  $('#bookpage').innerHTML = `
    <section class="bhero">
      <div class="bhero__cover">${coverHTML(book)}</div>
      <div class="bhero__info">
        <div class="kicker">${book.publisher ? `${book.publisher} · ` : ''}${total} 話 · ${fmtWords(book.stats.words)}</div>
        <h1>${book.title}</h1>
        <p class="bsub">${book.subtitle || ''}</p>
        <p class="byline">${book.author ? `${book.author} 著 · ` : ''}<span class="tr">非官方中譯</span></p>
        <div class="book__tags">${(book.tags || []).map((t) => `<span class="tag">${t}</span>`).join('')}</div>

        <div class="bhero__actions">
          <a class="btn btn--gold" href="${readHref}">${ctaLabel}</a>
          ${book.epub ? `<a class="btn btn--ghost" href="${book.epub}" download>下載 EPUB${book.epubSize ? ` · ${fmtSize(book.epubSize)}` : ''}</a>` : ''}
        </div>

        <div class="bprog">
          <div class="bprog__line"><i style="transform:scaleX(${pct})"></i></div>
          <div class="bprog__text">${p ? `已讀 ${done} / ${total} 話 · ${Math.round(pct * 100)}%` : `尚未開始 · 共 ${total} 話`}</div>
        </div>
      </div>
    </section>

    ${book.synopsis ? `
    <section class="bsection bsyn">
      <h2>簡介</h2>
      <p>${book.synopsis}</p>
    </section>` : ''}

    <section class="bsection btoc">
      <h2>目錄 <em>${total}</em></h2>
      <ol class="chaplist">${chapters}</ol>
    </section>

    <p class="bnav"><a class="foot-link" href="index.html">← 回到書架</a></p>
  `;
}

boot().catch((e) => {
  console.error(e);
  $('#bookpage').innerHTML = '<div class="empty">書目加載失敗</div>';
});
