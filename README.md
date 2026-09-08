# セミナー資料ライブラリ

社内・社外向けに開催したセミナーの資料と動画をまとめて検索・閲覧できる、GitHub Pages 上の静的サイトです。

- 資料（PDF/PPT 等）・動画は **Google Drive** にアップロードし、このサイトには共有リンクだけを登録します（リポジトリ自体には大きなファイルは置きません）。
- サイトからは Google Drive のプレビュー機能を使って、その場で資料や動画を再生できます。
- タイトル・登壇者・カテゴリ・タグ・概要文で検索・絞り込みができます。
- 資料の登録・削除は、ビルドツール不要のブラウザ完結の管理画面（`admin.html`）から行えます。

## サイト構成

```
index.html          … 一覧・検索ページ（誰でも閲覧可）
admin.html           … 登録・削除フォーム（GitHub トークンを持つ人だけが実質利用可能）
assets/style.css      … デザイン
assets/common.js      … 共通ユーティリティ（Google Drive リンク→埋め込みURL変換など）
assets/app.js         … 一覧ページのロジック（検索・絞り込み・並び替え・プレビュー表示）
assets/admin.js       … 管理画面のロジック（GitHub API 経由でデータをコミット）
data/materials.json   … 資料データ本体（このファイルを admin.html が書き換える）
.github/workflows/pages.yml … push 時に GitHub Pages へ自動デプロイ
```

資料が増えても本文（PDF/動画そのもの）はリポジトリに入らないため、リポジトリは軽量なまま保てます。

## 公開設定（最初の一回だけ）

1. このブランチ／変更を `main` ブランチに反映してください（PR をマージ、または直接 push）。
2. GitHub リポジトリの **Settings → Pages** を開き、「Build and deployment」の **Source** を `GitHub Actions` に設定してください。
3. `main` に push されると `.github/workflows/pages.yml` が自動実行され、`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます。

このサイトは全体公開（誰でも閲覧可）を前提にしています。社内限定にしたい場合は GitHub Enterprise/Pro のプライベート Pages 機能や、別途アクセス制限の仕組みが必要です。

## 資料の登録方法（管理者向け）

管理画面 (`admin.html`) はブラウザから GitHub の Contents API を直接呼び出し、`data/materials.json` に対してコミットを行うことでデータを更新します。バックエンドサーバーは不要です。

### 1. Fine-grained Personal Access Token を発行する

1. GitHub の **Settings → Developer settings → Personal access tokens → Fine-grained tokens** を開く。
2. 「Generate new token」をクリック。
3. **Repository access** はこのリポジトリのみを選択。
4. **Permissions → Repository permissions → Contents** を `Read and write` に設定（他の権限は付与不要）。
5. 発行されたトークン（`github_pat_...`）をコピーする。

> トークンはパスワードと同じです。他人に共有したり、公開の場に貼り付けたりしないでください。

### 2. 管理画面から登録する

1. サイトの `admin.html`（トップページ右上「資料を登録・管理する」）を開く。
2. 発行したトークンを入力し、「このブラウザに保存」（共有 PC では保存しないことを推奨）。
3. タイトル・実施日・登壇者・カテゴリ・タグ・概要・資料/動画の Google Drive リンクを入力して「登録する」。
4. 数十秒〜数分待つと GitHub Actions が自動デプロイし、サイトに反映されます。

削除も同じ画面の「登録済みの資料」一覧から行えます。

### Google Drive のリンクについて

- 資料・動画のファイルは Google Drive にアップロードし、共有設定を **「リンクを知っている全員が閲覧可」** にしてください（そうしないと公開サイトから再生できません）。
- 対応しているリンク形式（自動でプレビュー埋め込みに変換されます）:
  - `https://drive.google.com/file/d/<ID>/view?usp=sharing`（PDF・動画などのファイル）
  - `https://drive.google.com/open?id=<ID>`
  - `https://docs.google.com/presentation|document|spreadsheets/d/<ID>/edit`
- 上記以外の URL の場合は、プレビュー埋め込みはできず新しいタブで開くリンクとして扱われます。

## ローカルでの確認方法

ビルド不要の静的サイトなので、簡易サーバーで開けば動作確認できます。

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

（`fetch` で JSON を読み込むため、`file://` で直接開くとブラウザによっては動作しません。必ず簡易サーバー経由で確認してください。）

## データ形式（`data/materials.json`）

```json
{
  "id": "一意なID（管理画面が自動生成）",
  "title": "セミナータイトル",
  "date": "2026-03-05",
  "speaker": "登壇者名",
  "category": "カテゴリ名",
  "tags": ["タグ1", "タグ2"],
  "description": "概要文",
  "materialUrl": "Google Drive の資料リンク（任意）",
  "videoUrl": "Google Drive の動画リンク（任意）",
  "thumbnail": "サムネイル画像URL（任意・未使用でも可）"
}
```

管理画面を使わずに、このファイルを直接編集して push しても問題ありません。
