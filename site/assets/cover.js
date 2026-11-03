/* 封面繪製 — 首頁、書目頁共用 */

export const hexToRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export function motif(kind, accent) {
  const a = hexToRgba(accent, 0.55);
  const b = hexToRgba(accent, 0.14);
  const stroke = `fill="none" stroke="${a}" stroke-width="1"`;

  if (kind === 'wave') {
    return `<svg viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice">
      ${[0, 1, 2, 3, 4, 5, 6].map((i) =>
        `<circle cx="150" cy="${330 + i * 26}" r="${60 + i * 26}" ${stroke} stroke-opacity="${0.5 - i * 0.055}"/>`
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
  return `<svg viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice">
    <circle cx="196" cy="118" r="76" fill="${hexToRgba(accent, 0.16)}"/>
    <circle cx="196" cy="118" r="76" fill="none" stroke="${hexToRgba(accent, 0.34)}" stroke-width="1"/>
    <circle cx="196" cy="118" r="96" fill="none" stroke="${hexToRgba(accent, 0.12)}" stroke-width="1"/>
    <path d="M0 300 Q 75 268 150 300 T 300 300" fill="none" stroke="${hexToRgba(accent, 0.2)}" stroke-width="1"/>
    <path d="M0 326 Q 75 294 150 326 T 300 326" fill="none" stroke="${hexToRgba(accent, 0.13)}" stroke-width="1"/>
  </svg>`;
}

export function coverHTML(book) {
  const c = book.cover || {};
  return `
  <div class="cover" style="--from:${c.from};--to:${c.to};--accent-soft:${hexToRgba(c.accent || '#d4a24c', 0.16)};--accent-line:${hexToRgba(c.accent || '#d4a24c', 0.45)}">
    <span class="cover__frame"></span>
    <span class="cover__motif">${motif(c.motif, c.accent || '#d4a24c')}</span>
    <span class="cover__veil"></span>
    <span class="cover__mark">YODOKU</span>
    <span class="cover__title">${book.title}</span>
    <span class="cover__sub">${book.subtitle || ''}</span>
    <span class="cover__author">${book.author || ''}</span>
  </div>`;
}
