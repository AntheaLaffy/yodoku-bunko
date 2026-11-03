# 夜読文庫

→ https://anthealaffy.github.io/yodoku-bunko/

私人藏書的閱讀站。純靜態、零依賴、直接丟上 GitHub Pages。

```
content/      原文 markdown（一本書一個 .md，`## ` 分章）
books.config.json  書目設定：書名、作者、標籤、簡介、封面配色
site/         樣板與前端（會被原樣複製到 dist）
  index.html  書架：只放封面
  book.html   書目：簡介 / 目錄 / 續讀 / EPUB
  read.html   閱讀器
tools/build_epub.py   章節 → EPUB 3（含自繪封面）
tools/build.sh        一條命令：站點 → EPUB
build.mjs     把 content + config 編譯成 dist/data/**
dist/         建置產物，就是網站本身（不進版控）
```

## 字體

不隨包分發字庫，直接用系統宋體：

```css
--song: "Songti SC", "Source Han Serif SC", "Noto Serif CJK SC",
        "Noto Serif SC", STSong, SimSun, serif;
--kai:  "Kaiti SC", "KaiTi", STKaiti, "LXGW WenKai", serif;
```

理由：書只會越積越多，按語料子集化的收益越來越小，還得每加一本就重建字體；
而各平台基本都自帶宋體。首屏零字體下載。閱讀器可在宋 / 楷 / 黑之間切換，
切到楷時若系統裝了霞鹜文楷（或系統楷體）就會用上。

EPUB 同樣不內嵌字體，用閱讀器自己的中文襯線字。

## 建置

```bash
bash tools/build.sh          # 站點 + EPUB
python3 -m http.server -d dist 8899
# http://localhost:8899
```

只改文字、不碰字體時，`node build.mjs` 就夠。

## 電子書

每本書都會生成 `dist/download/<slug>.epub`：

- 章節直接取用網站自己的 `ch-*.json`，網頁和書永遠同一份正文
- 封面由 `build_epub.py` 用 Pillow + 文楷即時繪製（豎排書名、月環、朱印）
- 不內嵌字體，體積小（這本 237 KB）
- 已通過 EPUBCheck 5.2.1（EPUB 3.3 規則，0 error 0 warning）

EPUB 建好後會把 `epub` / `epubSize` 寫回 `data/books.json`，前端據此顯示下載入口。

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

## 資訊分層

- **書架**：封面、書名、一句副標、話數字數、進度條。沒有簡介，不搶封面的位置。
- **書目**：封面 + 簡介 + 進度 + 全文目錄；點進來才知道細節。
- **閱讀器**：正文、目錄抽屜、排版設定。

續讀以「讀到哪一章」為準（`progress[slug].ch`），不是時間排序；同一章再記捲動比例。
書架卡片右上顯示「續讀 N」就直接接上。

## 閱讀器

- 目錄側欄、上一話／下一話、鍵盤 `←` `→` `M` `T` `Esc`
- 字號、行距、宋黑字體、四種主題（夜／月／紙／白）
- 閱讀進度、當前章節自動記憶（localStorage）
- 站點署名一律用「夜読文庫」，不放個人身份
