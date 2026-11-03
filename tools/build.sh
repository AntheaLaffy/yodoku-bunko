#!/usr/bin/env bash
# 一次建好整站：正文 → 站點 → EPUB
set -euo pipefail
cd "$(dirname "$0")/.."

node build.mjs
python3 tools/build_epub.py   || echo "! EPUB 跳過"
