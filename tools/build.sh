#!/usr/bin/env bash
# 一次建好整站：正文 → 字體子集 → EPUB
set -euo pipefail
cd "$(dirname "$0")/.."

node build.mjs
python3 tools/build_fonts.py  || echo "! 字體子集化跳過（沿用已提交的 woff2）"
python3 tools/build_epub.py   || echo "! EPUB 跳過"
