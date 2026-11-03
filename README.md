# 夜読文庫

→ https://anthealaffy.github.io/yodoku-bunko/

私人藏書的閱讀站。純靜態、零依賴、直接丟上 GitHub Pages。

```
content/      原文 markdown（一本書一個 .md，`## ` 分章）
books.config.json  書目設定：書名、作者、標籤、簡介、封面配色
site/         樣板與前端（會被原樣複製到 dist）
build.mjs     把 content + config 編譯成 dist/data/**
dist/         建置產物，就是網站本身（不進版控）
```

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
