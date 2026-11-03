#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_epub — 把 dist/data 里已排好的章节打包成 EPUB 3。

输入是网站自己的构建产物（meta.json + ch-*.json），所以网页和电子书永远
是同一份正文、同一套断章，不会各排一遍。

产物：dist/download/<slug>.epub
依赖：Python 3.10+、Pillow（封面渲染）、zipfile（标准库）。
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import uuid
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
COVER_W, COVER_H = 1200, 1700


# ---------------------------------------------------------------- 工具

def hex_rgb(value: str) -> tuple[int, int, int]:
    v = value.lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def mixed(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def xhtml_para(fragment: str) -> str:
    """正文片段的 HTML -> 合法 XHTML"""
    out = fragment
    out = re.sub(r"<(hr|br|img)([^>]*?)(?<!/)>", r"<\1\2/>", out)
    return out


def find_font() -> Path | None:
    for candidate in (
        Path.home() / ".local/share/fonts/LXGWWenKai-Regular.ttf",
        Path("/usr/share/fonts/truetype/lxgw-wenkai/LXGWWenKai-Regular.ttf"),
        ROOT / ".cache/fonts/LXGWWenKai-Regular.ttf",
    ):
        if candidate.is_file():
            return candidate
    return None


# ---------------------------------------------------------------- 封面

def draw_cover(meta: dict, out: Path) -> None:
    cover = meta.get("cover") or {}
    c_from = hex_rgb(cover.get("from", "#2a2320"))
    c_to = hex_rgb(cover.get("to", "#0b0908"))
    accent = hex_rgb(cover.get("accent", "#d4a24c"))

    img = Image.new("RGB", (COVER_W, COVER_H), c_from)
    px = img.load()
    for y in range(COVER_H):
        t = y / (COVER_H - 1)
        row = mixed(c_from, c_to, t ** 0.85)
        for x in range(COVER_W):
            px[x, y] = row

    # 月晕
    glow = Image.new("RGB", (COVER_W, COVER_H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((COVER_W * 0.26, COVER_H * 0.06, COVER_W * 1.02, COVER_H * 0.52), fill=accent)
    glow = glow.filter(ImageFilter.GaussianBlur(180))
    img = Image.blend(img, Image.composite(glow, img, glow.convert("L").point(lambda v: int(v * 0.42))), 0.5)

    draw = ImageDraw.Draw(img, "RGBA")

    # 边框 + 月环
    draw.rounded_rectangle((40, 40, COVER_W - 40, COVER_H - 40), radius=6,
                           outline=(255, 255, 255, 34), width=2)
    draw.ellipse((COVER_W * 0.30, COVER_H * 0.10, COVER_W * 0.92, COVER_H * 0.52),
                 outline=accent + (60,), width=3)
    draw.ellipse((COVER_W * 0.34, COVER_H * 0.13, COVER_W * 0.88, COVER_H * 0.49),
                 outline=accent + (28,), width=2)

    font_path = find_font()
    title_font = ImageFont.truetype(str(font_path), 74) if font_path else ImageFont.load_default()
    sub_font = ImageFont.truetype(str(font_path), 30) if font_path else ImageFont.load_default()
    small_font = ImageFont.truetype(str(font_path), 26) if font_path else ImageFont.load_default()

    # 竖排书名
    title = meta.get("title", "")
    x = COVER_W - 118
    y = 120
    step = 96
    column = 0
    for i, ch in enumerate(title):
        if y + step > COVER_H - 300:
            column += 1
            y = 120
            x -= 96
        draw.text((x, y), ch, font=title_font, fill=(250, 245, 237, 255), anchor="ma")
        y += step

    # 副标题（竖排小字，靠左）
    sub = meta.get("subtitle", "")
    if sub:
        sx = x - 118
        sy = 150
        for ch in sub[:26]:
            if sy > COVER_H - 260:
                break
            draw.text((sx, sy), ch, font=sub_font, fill=(250, 245, 237, 168), anchor="ma")
            sy += 40

    # 底部：分隔线 + 文库名 + 作者
    draw.line((96, COVER_H - 196, COVER_W - 96, COVER_H - 196),
              fill=(250, 245, 237, 40), width=1)
    lx = 96
    for ch in "YODOKU BUNKO":
        draw.text((lx, COVER_H - 150), ch, font=small_font, fill=(250, 245, 237, 130))
        lx += draw.textlength(ch, font=small_font) + 6
    author = meta.get("author", "")
    if author:
        draw.text((COVER_W - 96, COVER_H - 150), author, font=sub_font,
                  fill=(250, 245, 237, 200), anchor="ra")

    # 朱印
    seal = Image.new("RGBA", (150, 150), (0, 0, 0, 0))
    sd = ImageDraw.Draw(seal)
    sd.rounded_rectangle((0, 0, 149, 149), radius=16, fill=(168, 60, 66, 235))
    if font_path:
        sf = ImageFont.truetype(str(font_path), 38)
        sd.text((75, 44), "夜", font=sf, fill=(250, 243, 235, 255), anchor="mm")
        sd.text((75, 100), "読", font=sf, fill=(250, 243, 235, 255), anchor="mm")
    seal = seal.rotate(-6, expand=True, resample=Image.BICUBIC)
    img.paste(seal, (96, COVER_H - 372), seal)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=90, optimize=True)


# ---------------------------------------------------------------- 组装

def xhtml_doc(title: str, body: str, depth: int = 1, extra_head: str = "") -> str:
    up = "../" * depth
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>{html.escape(title)}</title>
<link rel="stylesheet" type="text/css" href="{up}style.css"/>
{extra_head}</head>
<body>
{body}
</body>
</html>
"""


def build_epub(book_dir: Path, out: Path, css: str, font_files: list[Path]) -> dict:
    meta = json.loads((book_dir / "meta.json").read_text(encoding="utf-8"))
    chapters = []
    for ch in meta["chapters"]:
        data = json.loads((book_dir / f"{ch['id']}.json").read_text(encoding="utf-8"))
        chapters.append((ch, data))

    slug = meta["slug"]
    ident = "urn:uuid:" + str(uuid.uuid5(uuid.NAMESPACE_URL, "yodoku/" + slug))
    modified = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    tmp = out.with_suffix(".tmp")
    tmp.parent.mkdir(parents=True, exist_ok=True)

    cover_path = tmp.parent / f"_{slug}-cover.jpg"
    draw_cover(meta, cover_path)

    files: list[tuple[str, bytes]] = []

    # nav
    nav_items = "\n".join(
        f'      <li><a href="text/{idx + 1:02d}.xhtml">{html.escape(ch["title"])}</a></li>'
        for idx, (ch, _) in enumerate(chapters)
    )
    files.append(("OEBPS/nav.xhtml", xhtml_doc(
        "目錄",
        f"""<nav epub:type="toc" id="toc">
  <h1>目錄</h1>
  <ol>
{nav_items}
  </ol>
</nav>
<nav epub:type="landmarks" hidden="hidden">
  <ol>
    <li><a epub:type="cover" href="text/cover.xhtml">封面</a></li>
    <li><a epub:type="toc" href="nav.xhtml">目錄</a></li>
    <li><a epub:type="bodymatter" href="text/01.xhtml">正文</a></li>
  </ol>
</nav>""",
        depth=0,
    ).encode()))

    # 封面页
    files.append(("OEBPS/text/cover.xhtml", xhtml_doc(
        "封面",
        '<div class="cover-page"><img src="../images/cover.jpg" alt="封面"/></div>',
        ).encode()))

    # 扉页
    files.append(("OEBPS/text/titlepage.xhtml", xhtml_doc(
        meta["title"],
        f"""<section epub:type="titlepage" class="titlepage">
  <h1>{html.escape(meta["title"])}</h1>
  <p class="t-sub">{html.escape(meta.get("subtitle", ""))}</p>
  <p class="t-author">{html.escape(meta.get("author", ""))} 著</p>
  <p class="t-role">非官方中文譯本</p>
  <p class="t-imprint">夜読文庫</p>
</section>""",
        ).encode()))

    # 章节
    for idx, (ch, data) in enumerate(chapters):
        body = (
            f'<section epub:type="chapter" class="chapter">\n'
            f'<h1>{html.escape(ch["title"])}</h1>\n'
            f'{xhtml_para(data["html"])}\n'
            f"</section>"
        )
        files.append((f"OEBPS/text/{idx + 1:02d}.xhtml", xhtml_doc(ch["title"], body).encode()))

    # 版权页
    year = dt.date.today().year
    files.append(("OEBPS/text/colophon.xhtml", xhtml_doc(
        "版權",
        f"""<section epub:type="colophon" class="colophon">
  <h2>版權</h2>
  <p>《{html.escape(meta["title"])}》{html.escape(meta.get("subtitle", ""))}</p>
  <p>原著：{html.escape(meta.get("author", ""))}{("／" + html.escape(meta["publisher"])) if meta.get("publisher") else ""}</p>
  <p>譯文：非官方中文譯本</p>
  <p>本篇僅供私人閱讀，請支持正版。</p>
  <p>排版：霞鹜文楷 LXGW WenKai（SIL OFL 1.1）· 夜読文庫 · {year}</p>
</section>""",
        ).encode()))

    files.append(("OEBPS/style.css", css.encode()))
    files.append(("OEBPS/images/cover.jpg", cover_path.read_bytes()))
    for font in font_files:
        files.append((f"OEBPS/fonts/{font.name}", font.read_bytes()))

    # opf
    subjects = "\n".join(f'    <dc:subject>{html.escape(t)}</dc:subject>' for t in meta.get("tags", []))
    manifest = [
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '<item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>',
        '<item id="titlepage" href="text/titlepage.xhtml" media-type="application/xhtml+xml"/>',
        '<item id="colophon" href="text/colophon.xhtml" media-type="application/xhtml+xml"/>',
        '<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
        '<item id="css" href="style.css" media-type="text/css"/>',
    ]
    for font in font_files:
        manifest.append(
            f'<item id="font-{font.stem}" href="fonts/{font.name}" media-type="font/woff2"/>'
        )
    spine = ["cover", "titlepage", "nav"]
    for idx, _ in enumerate(chapters):
        manifest.append(
            f'<item id="ch{idx + 1}" href="text/{idx + 1:02d}.xhtml" media-type="application/xhtml+xml"/>'
        )
        spine.append(f"ch{idx + 1}")
    spine.append("colophon")

    manifest_xml = "\n    ".join(manifest)
    spine_xml = "\n    ".join(f'<itemref idref="{ref}"/>' for ref in spine)

    opf = f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">{ident}</dc:identifier>
    <dc:title>{html.escape(meta["title"])}{("　" + html.escape(meta["subtitle"])) if meta.get("subtitle") else ""}</dc:title>
    <dc:creator id="author">{html.escape(meta.get("author", ""))}</dc:creator>
    <meta refines="#author" property="role" scheme="marc:relators">aut</meta>
    <dc:contributor id="translator">非官方中文譯本</dc:contributor>
    <meta refines="#translator" property="role" scheme="marc:relators">trl</meta>
    <dc:language>zh-CN</dc:language>
    <dc:publisher>夜読文庫</dc:publisher>
    <dc:source>{html.escape(meta.get("sourceTitle", ""))}</dc:source>
    <dc:description>{html.escape(meta.get("synopsis", ""))}</dc:description>
{subjects}
    <meta property="dcterms:modified">{modified}</meta>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    {manifest_xml}
  </manifest>
  <spine>
    {spine_xml}
  </spine>
</package>
"""
    files.append(("OEBPS/content.opf", opf.encode()))
    files.append(("META-INF/container.xml", b"""<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""))

    with zipfile.ZipFile(tmp, "w") as zf:
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        for name, data in files:
            zf.writestr(name, data, compress_type=zipfile.ZIP_DEFLATED)

    tmp.replace(out)
    cover_path.unlink(missing_ok=True)
    return {"slug": slug, "size": out.stat().st_size, "chapters": len(chapters)}


EPUB_CSS = """
@font-face {
  font-family: "LXGW WenKai";
  src: url("fonts/lxgw-regular.woff2") format("woff2");
  font-weight: normal;
  font-style: normal;
}
html { font-size: 100%; }
body {
  font-family: "LXGW WenKai", "Songti SC", "Noto Serif CJK SC", serif;
  line-height: 2.0;
  margin: 0 1.2em;
  color: #1b1917;
  text-align: justify;
}
h1 {
  font-size: 1.3em;
  font-weight: normal;
  text-align: center;
  margin: 2.4em 0 1.6em;
  line-height: 1.7;
  page-break-before: always;
}
p { margin: 0 0 0.9em; text-indent: 2em; }
p.say { text-indent: 2em; }
hr { border: 0; height: 1px; background: #ccc; margin: 2em 15%; }
blockquote { margin: 1.4em 0; padding-left: 1em; border-left: 2px solid #ddd; color: #444; }
.cover-page { margin: 0; padding: 0; text-align: center; page-break-after: always; }
.cover-page img { max-width: 100%; height: auto; }
.titlepage { text-align: center; margin-top: 30%; }
.titlepage h1 { page-break-before: avoid; font-size: 1.6em; margin-bottom: 0.8em; }
.titlepage .t-sub { text-indent: 0; color: #666; font-size: 0.95em; }
.titlepage .t-author { text-indent: 0; margin-top: 3em; }
.titlepage .t-role, .titlepage .t-imprint { text-indent: 0; color: #666; font-size: 0.9em; }
.colophon { font-size: 0.9em; margin-top: 10%; }
.colophon p { text-indent: 0; line-height: 1.9; }
nav ol { list-style: none; padding-left: 0; }
nav li { margin: 0.6em 0; }
nav a { color: #1b1917; text-decoration: none; }
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / "dist" / "data" / "books"))
    ap.add_argument("--fonts", default=str(ROOT / "dist" / "assets" / "fonts"))
    ap.add_argument("--out", default=str(ROOT / "dist" / "download"))
    ap.add_argument("--manifest", default=str(ROOT / "dist" / "data" / "books.json"))
    args = ap.parse_args()

    data_dir = Path(args.data)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    fonts = [p for p in sorted(Path(args.fonts).glob("*.woff2")) if "medium" not in p.name]
    results = []
    for book_dir in sorted(p for p in data_dir.iterdir() if p.is_dir()):
        out = out_dir / f"{book_dir.name}.epub"
        info = build_epub(book_dir, out, EPUB_CSS, fonts)
        results.append(info)
        print(f"  ✓ {out.name}  {info['size'] / 1024:.0f} KB · {info['chapters']} 章")

    manifest_path = Path(args.manifest)
    if manifest_path.is_file() and results:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        by_slug = {r["slug"]: r for r in results}
        for book in manifest.get("books", []):
            info = by_slug.get(book["slug"])
            if info:
                book["epub"] = f"download/{info['slug']}.epub"
                book["epubSize"] = info["size"]
                book["builtAt"] = dt.date.today().isoformat()
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
