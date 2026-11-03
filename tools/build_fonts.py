#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_fonts — 按站点实际用字把霞鹜文楷子集化成 woff2。

中文字体整包 15MB+，站点只需要正文与界面里出现过的字。子集后约 0.5MB，
既能保证生僻字不缺，又不会让读者下载整个字库。

用法：
    python3 tools/build_fonts.py                # 输出到 dist/assets/fonts
    python3 tools/build_fonts.py --out site/assets/fonts   # 写回源站（提交用）

字重：
    Regular → 正文
    Medium  → 标题（正体，避免浏览器合成假粗）

许可证：霞鹜文楷以 SIL OFL 1.1 发布，允许子集化后在网页分发。
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION = "v1.520"
RELEASE = f"https://github.com/lxgw/LxgwWenKai/releases/download/{VERSION}/"
CACHE = ROOT / ".cache" / "fonts"

FONTS = {
    "regular": ("LXGWWenKai-Regular.ttf", "lxgw-regular.woff2"),
    "medium": ("LXGWWenKai-Medium.ttf", "lxgw-medium.woff2"),
}

# ASCII + 中文标点 + 常用符号，保证数字、代码、箭头不缺字
BASE_CHARS = "".join(chr(c) for c in range(0x20, 0x7F)) + (
    "\u3000\u3001\u3002\uff0c\uff0e\u00b7\uff1b\uff1a\uff1f\uff01"
    "\u2026\u2014\u2013\uff5e\u300a\u300b\u3008\u3009\u201c\u201d\u2018\u2019"
    "\uff08\uff09\u3010\u3011\u3014\u3015\uff05\uff0b\uff0d\u00d7\u00f7"
    "\uff1d\uffe5\uff0f\u2190\u2192\u2191\u2193\u2022\u00a9\u25c6\u2756\u2740"
    "\u00b7\u00b0\u2103\uff0a\u2460\u2461\u2462\u2463\u2464\u2465\u2466\u2467"
    "\u2468\u2469\u2776\u2777\u2778\u2779\u277a\u277b\u277c\u277d\u277e\u277f"
    "\uff10\uff11\uff12\uff13\uff14\uff15\uff16\uff17\uff18\uff19"
)


def _local(name: str) -> list[Path]:
    home = Path.home()
    return [
        home / ".local/share/fonts" / name,
        home / ".fonts" / name,
        Path("/usr/share/fonts/truetype/lxgw-wenkai") / name,
        Path("/usr/share/fonts/TTF") / name,
        Path("/usr/local/share/fonts") / name,
        ROOT / ".cache" / "fonts" / name,
    ]


def source_font(name: str) -> Path:
    for candidate in _local(name):
        if candidate.is_file() and candidate.stat().st_size > 1_000_000:
            return candidate
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / name
    print(f"  ↓ 下载 {name}（{VERSION}）")
    request = urllib.request.Request(RELEASE + name, headers={"User-Agent": "yodoku-builder/1"})
    with urllib.request.urlopen(request, timeout=300) as resp, open(target, "wb") as fh:
        shutil.copyfileobj(resp, fh)
    if target.stat().st_size < 1_000_000:
        raise RuntimeError(f"字体下载不完整：{target}")
    return target


def corpus(text_files: list[Path]) -> str:
    chars: set[str] = set(BASE_CHARS)
    for path in text_files:
        if path.is_file():
            chars.update(path.read_text(encoding="utf-8", errors="ignore"))
    return "".join(sorted(c for c in chars if c.strip() or c in BASE_CHARS))


def subset(src: Path, chars: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp.woff2")
    with tempfile.NamedTemporaryFile("w", suffix=".txt", encoding="utf-8", delete=False) as fh:
        fh.write(chars)
        chars_file = fh.name
    try:
        subprocess.run(
            [
                sys.executable, "-m", "fontTools.subset", str(src),
                f"--text-file={chars_file}",
                "--flavor=woff2",
                "--layout-features=*",
                "--no-hinting",
                "--desubroutinize",
                f"--output-file={tmp}",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        shutil.move(tmp, out)
    finally:
        Path(chars_file).unlink(missing_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "dist" / "assets" / "fonts"))
    args = ap.parse_args()

    out_dir = Path(args.out)
    md = sorted((ROOT / "content").glob("*.md"))
    ui = [p for p in sorted((ROOT / "site").rglob("*")) if p.suffix in {".html", ".js", ".css"}]

    body_chars = corpus(md + ui)
    # 标题用字：书名、界面标题，几百个字足够
    head_chars = corpus(ui) + "".join(
        line for path in md for line in path.read_text(encoding="utf-8").splitlines()[:1]
    )
    head_chars = "".join(sorted(set(head_chars)))

    print(f"  正文语料 {len(body_chars)} 字 / 标题语料 {len(head_chars)} 字")
    ok = True
    jobs = [("regular", body_chars), ("medium", head_chars)]
    for key, chars in jobs:
        ttf, name = FONTS[key]
        try:
            src = source_font(ttf)
        except Exception as exc:  # noqa: BLE001
            print(f"  ! 取不到 {ttf}：{exc}（保留现有 {name}）")
            ok = ok and (out_dir / name).is_file()
            continue
        subset(src, chars, out_dir / name)
        size = (out_dir / name).stat().st_size
        print(f"  ✓ {name}  {size / 1024:.0f} KB")

    ofl = ROOT / "licenses" / "LXGW-Wen-Kai-OFL.txt"
    if ofl.is_file():
        shutil.copy2(ofl, out_dir / "OFL.txt")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
