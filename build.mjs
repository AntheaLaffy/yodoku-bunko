#!/usr/bin/env node
/**
 * build.mjs — turn content/*.md into the static library in dist/.
 * zero dependencies. run: node build.mjs
 */
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const SITE = path.join(ROOT, 'site');
const CONTENT = path.join(ROOT, 'content');

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** inline markdown: **bold**, *em*, ~~del~~, `code` */
function inline(raw) {
  let s = esc(raw);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s;
}

/** blank-line separated blocks -> <p>…</p>, with dialogue lines flagged */
function renderBody(lines) {
  const blocks = [];
  let buf = [];

  const flush = () => {
    if (!buf.length) return;
    const text = buf.join('').trim();
    buf = [];
    if (!text) return;
    const dialogue = /^[“"「『]/.test(text);
    blocks.push(`<p${dialogue ? ' class="say"' : ''}>${inline(text)}</p>`);
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) { flush(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); blocks.push('<hr>'); continue; }
    if (t.startsWith('### ')) { flush(); blocks.push(`<h3>${inline(t.slice(4))}</h3>`); continue; }
    if (t.startsWith('> ')) { flush(); blocks.push(`<blockquote>${inline(t.slice(2))}</blockquote>`); continue; }
    buf.push(t);
  }
  flush();
  return blocks.join('\n');
}

const cjk = (s) => (s.match(/[\u3400-\u9fff\u3040-\u30ff]/g) || []).length;
const latin = (s) => (s.match(/[A-Za-z0-9'’]+/g) || []).length;
const countWords = (s) => cjk(s) + latin(s);

async function buildBook(book) {
  const md = await readFile(path.join(CONTENT, book.file), 'utf8');
  const lines = md.split(/\r?\n/);

  const chapters = [];
  let current = null;
  let h1 = '';
  const preamble = [];

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    const h1m = line.match(/^#\s+(.+?)\s*$/);
    if (h2) {
      if (current) chapters.push(current);
      current = { title: h2[1], lines: [] };
      continue;
    }
    if (h1m && !h1 && !current) { h1 = h1m[1]; continue; }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  if (current) chapters.push(current);
  if (!chapters.length) chapters.push({ title: '正文', lines: preamble });

  const outDir = path.join(DIST, 'data', 'books', book.slug);
  await mkdir(outDir, { recursive: true });

  const list = [];
  let total = 0;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const id = `ch-${String(i + 1).padStart(2, '0')}`;
    const raw = ch.lines.join('\n');
    const words = countWords(raw);
    total += words;
    const html = renderBody(ch.lines);
    await writeFile(
      path.join(outDir, `${id}.json`),
      JSON.stringify({ id, index: i, title: ch.title, words, html })
    );
    list.push({ id, index: i, title: ch.title, words, minutes: Math.max(1, Math.round(words / 500)) });
  }

  const meta = {
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle || '',
    author: book.author || '',
    publisher: book.publisher || '',
    tags: book.tags || [],
    synopsis: book.synopsis || '',
    cover: book.cover || { from: '#2a2320', to: '#0b0908', accent: '#d4a24c', motif: 'moon' },
    sourceTitle: h1 || '',
    chapters: list,
    stats: { chapters: list.length, words: total, minutes: Math.max(1, Math.round(total / 500)) }
  };

  await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}

async function main() {
  const config = JSON.parse(await readFile(path.join(ROOT, 'books.config.json'), 'utf8'));

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // static assets
  await cp(SITE, DIST, { recursive: true });

  const metas = [];
  for (const book of config.books) {
    if (!existsSync(path.join(CONTENT, book.file))) {
      console.warn(`! missing content/${book.file} — skipped`);
      continue;
    }
    const meta = await buildBook(book);
    metas.push(meta);
    console.log(`✓ ${book.slug} — ${meta.stats.chapters} 章 / ${meta.stats.words} 字`);
  }

  const manifest = {
    site: config.site,
    generatedAt: new Date().toISOString(),
    books: metas
  };
  await writeFile(path.join(DIST, 'data', 'books.json'), JSON.stringify(manifest, null, 2));
  console.log(`✓ dist/ ready — ${metas.length} book(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
