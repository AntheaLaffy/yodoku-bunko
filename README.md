# 夜読文庫

→ https://anthealaffy.github.io/yodoku-bunko/

私人藏書的閱讀站。純靜態、零依賴、直接丟上 GitHub Pages。

```
content/      原文 markdown（一本書一個 .md，`## ` 分章）
books.config.json  書目設定：書名、作者、標籤、簡介、封面配色
site/         樣板與前端（會被原樣複製到 dist）
tools/build_fonts.py  按站點用字子集化霞鹜文楷
licenses/     霞鹜文楷 OFL 1.1 授權
build.mjs     把 content + config 編譯成 dist/data/**
dist/         建置產物，就是網站本身（不進版控）
```

## 字體

正文與標題使用[霞鹜文楷（LXGW WenKai）](https://github.com/lxgw/LxgwWenKai)。
整包 15MB＋，所以建置時按站點實際用字子集化成 WOFF2：

```bash
python3 tools/build_fonts.py                        # 只寫進 dist/
python3 tools/build_fonts.py --out site/assets/fonts  # 順便更新要提交的版本
```

正文 Regular ≈ 530 KB（含全部正文用字，生僻字不缺），標題 Medium ≈ 68 KB。
字重兩個檔位（100–400 / 500–900），所以不會出現瀏覽器合成假粗。
字體以 SIL OFL 1.1 分發，授權見 `licenses/`，頁尾有署名。

## 本地預覽

```bash
node build.mjs
python3 -m http.server -d dist 8899
# http://localhost:8899
```

## 加一本書

1. 把 markdown 放進 `content/`，章節標題用 `## 第X話 …`。
2. 在 `books.config.json` 的 `books` 陣列加一筆：

```json
{
  "slug": "my-book",
  "file": "my-book.md",
  "title": "書名",
  "subtitle": "副標",
  "author": "作者",
  "tags": ["標籤"],
  "synopsis": "一段簡介",
  "cover": { "from": "#2b1a1e", "to": "#0b0908", "accent": "#d4726a", "motif": "moon" }
}
```

`motif` 可選 `moon` / `wave` / `blade` / `petal`。

3. `node build.mjs`，推上去，Actions 會自動部署。

## 閱讀器

- 目錄側欄、上一話／下一話、鍵盤 `←` `→` `M` `T` `Esc`
- 字號、行距、宋黑字體、四種主題（夜／月／紙／白）
- 閱讀進度、當前章節自動記憶（localStorage）
