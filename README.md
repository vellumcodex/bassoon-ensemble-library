# Bassoon Ensemble Library

ファゴットアンサンブル楽譜のプライベート・データベースサイト。

Excel（`.xlsx`）をそのままデータソースとして扱い、GitHub Pages で配信する構成。ビルド不要、バックエンド不要。

---

## ファイル構成

```
fagott-ensemble-db/
├── index.html                 # エントリポイント
├── css/
│   └── style.css              # スタイル
├── js/
│   └── app.js                 # データ読込・描画ロジック
├── data/
│   └── ensemble-scores.xlsx   # データ本体 (ここを更新する)
├── assets/
│   └── header-bg.jpg          # ヘッダー背景画像
├── README.md
└── .gitignore
```

**仕組み**: ブラウザが `data/ensemble-scores.xlsx` を `fetch()` で取得し、[SheetJS](https://sheetjs.com/) でパースしてレンダリング。

---

## データ更新の運用フロー

1. ローカルで `data/ensemble-scores.xlsx` を Excel で編集
2. `git add . && git commit -m "Update scores" && git push`
3. GitHub Pages が自動デプロイ、ブラウザでリロードすれば反映

---

## Excel 列定義

| 列名 | 用途 |
|---|---|
| 編成人数 | 演奏人数（数値） |
| 編成 | `Fg×2`, `Fg+Mini-Fg` など |
| タイトル | 楽譜タイトル |
| 作曲者 / 作曲者_生年 / 作曲者_没年 | 作曲者情報 |
| 編曲者 / 編曲者_生年 / 編曲者_没年 | 編曲者情報 |
| 出版社 | |
| 出版番号 | カタログ番号 |
| 出版年 | |
| ISMN / ISBN | |
| 時間 | 演奏時間 |
| 説明 | 楽譜の解説文 |
| 曲目 | 収録曲リスト |
| スキルレベル | `A-C`, `D` 等、ABRSMグレード準拠 |
| 画像 | 画像URL (http/https) |

- シート名は **`Scores`** を想定
- 1行目がヘッダー、以降が1楽譜=1行
- 空セルはそのまま空欄で表示される

---

## GitHub Pages デプロイ手順

### 1. ローカルからpush

```bash
cd fagott-ensemble-db
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<YOUR_USERNAME>/<REPO_NAME>.git
git branch -M main
git push -u origin main
```

### 2. Pages 有効化

GitHubのリポジトリページで `Settings` → `Pages` を開き、
- **Source**: `Deploy from a branch`
- **Branch**: `main` / `/ (root)`
- **Save**

数分後、`https://<username>.github.io/<repo-name>/` で公開される。

---

## プライベート運用の選択肢

### A. GitHub Pro + Private Pages（本命・月$4）
Private リポジトリ + Private Pages で、GitHub アカウント認証が必須。最もシンプルで確実。

### B. Cloudflare Pages + Cloudflare Access（無料枠あり）
リポジトリは GitHub に置いたまま、Cloudflare Pages に連携。Cloudflare Access でメール認証等を掛ける。GitHub の有料プラン不要。

### C. 簡易パスワードゲート（JS実装）
`js/app.js` の先頭で：
```js
var CONFIG = {
  requirePassword: true,       // ← true に変更
  password: 'your-password',   // ← 任意に変更
  ...
};
```
- 画面のみ保護。`data/ensemble-scores.xlsx` の直URLは依然として取得可能
- 「身内だけで URL を共有する」運用レベルの秘匿性

---

## ローカル動作確認

`file://` で開くと CORS の関係で xlsx 読み込みに失敗する。簡易サーバーを立てる：

```bash
cd fagott-ensemble-db
python3 -m http.server 8000
# → http://localhost:8000/
```

---

## カスタマイズポイント

- **色 / フォント**: `css/style.css` の `:root` ブロック
- **ヘッダー暗さ**: `.site-header` の `linear-gradient(...)` のアルファ値
- **ヘッダー背景画像**: `assets/header-bg.jpg` を差し替え
- **列の追加**: `js/app.js` の `COLUMNS` と `normalizeRow()`、詳細パネルの `openDetail()` を更新
- **フィルタ追加**: `buildFilters()` と `applyFiltersAndRender()` に項目を追加
