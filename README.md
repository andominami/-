# セミナー資料ライブラリ

社内向けに開催したセミナーの資料と動画をまとめて検索・閲覧できる、GitHub Pages 上の静的サイトです。
「たんぽぽ歯科マニュアル」「保険算定ルールノート」と同じ考え方(合言葉ロック・Google Drive埋め込み・ビルド不要の静的サイト)で作っています。

- 資料（PDF/PPT 等）・動画は **Google Drive** にアップロードし、このサイトには共有リンクだけを登録します（リポジトリ自体には大きなファイルは置きません）。
- サイト全体は**合言葉（パスワード）**で保護されています(社内限定の簡易的な鍵で、厳密なセキュリティではありません)。
- タイトル・登壇者・カテゴリ・タグ・概要文で検索、カテゴリ絞り込み、「資料/動画/お気に入り」タブでの絞り込みができます。
- カードの ♡ ボタンで自分用にお気に入り登録できます(ブラウザのlocalStorageに保存・自分だけに表示)。
- 資料の登録・削除は、ビルドツール不要のブラウザ完結の管理画面（`admin.html`）から行えます。
- Googleフォームからの投稿にも対応できます（`automation/` 参照）。スタッフはGitHubトークンを用意せず、フォームに入力するだけで新しい資料を追加できます。

## サイト構成

```
index.html            … 一覧・検索ページ（合言葉入力後に閲覧可）
admin.html             … 登録・削除フォーム（合言葉 + GitHubトークンを持つ人だけが実質利用可能）
assets/style.css        … デザイン
assets/logo.png         … ロゴ画像
assets/common.js        … 共通ユーティリティ（合言葉ロック・Google Driveリンク変換など）
assets/app.js           … 一覧ページのロジック（検索・絞り込み・並び替え・プレビュー表示・お気に入り）
assets/admin.js         … 管理画面のロジック（GitHub API経由でデータをコミット）
data/materials.json     … 資料データ本体（このファイルをadmin.htmlが書き換える）
.github/workflows/pages.yml … push時にGitHub Pagesへ自動デプロイ
automation/             … Googleフォームからの自動投稿の仕組み（Apps Script、任意）
```

## 公開設定（最初の一回だけ）

1. このブランチ／変更を `main` ブランチに反映してください（PRをマージ、または直接push）。
2. GitHubリポジトリの **Settings → Pages** を開き、「Build and deployment」の **Source** を `GitHub Actions` に設定してください。
3. `main` に push されると `.github/workflows/pages.yml` が自動実行され、`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます。

## 合言葉（サイトのパスワード）を設定する

合言葉は設定済みです。変更したくなった場合は以下の手順で更新できます。

1. ブラウザのアドレスバーに `javascript:` に続けて下記を貼り付けて実行するか、開発者ツールのコンソールで実行し、新しい合言葉のハッシュ値を作る:
   ```js
   crypto.subtle.digest('SHA-256', new TextEncoder().encode('新しい合言葉'))
     .then(buf => console.log([...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')))
   ```
2. 表示されたハッシュ値を `assets/common.js` の `LOCK_PASSWORD_HASH` に貼り付けて保存し、push する。
3. スタッフには新しい合言葉を別途(口頭やチャットなど)で共有してください。

合言葉はブラウザのJavaScriptで照合しているだけの簡易的な鍵です。本当に見られてはいけない機密情報は置かないでください。

## 資料の登録方法（管理者向け）

管理画面 (`admin.html`) はブラウザからGitHubのContents APIを直接呼び出し、`data/materials.json` に対してコミットを行うことでデータを更新します。バックエンドサーバーは不要です。

### 1. Fine-grained Personal Access Tokenを発行する

1. GitHubの **Settings → Developer settings → Personal access tokens → Fine-grained tokens** を開く。
2. 「Generate new token」をクリック。
3. **Repository access** はこのリポジトリのみを選択。
4. **Permissions → Repository permissions → Contents** を `Read and write` に設定（他の権限は付与不要）。
5. 発行されたトークン（`github_pat_...`）をコピーする。

> トークンはパスワードと同じです。他人に共有したり、公開の場に貼り付けたりしないでください。

### 2. 管理画面から登録する

1. サイトの `admin.html`（トップページ右上「＋ 資料を登録する」）を開く。合言葉を入力。
2. 発行したトークンを入力し、「このブラウザに保存」（共有PCでは保存しないことを推奨）。
3. タイトル・実施日・登壇者・カテゴリ・タグ・概要・資料/動画のGoogle Driveリンクを入力して「登録する」。
4. 数十秒〜数分待つとGitHub Actionsが自動デプロイし、サイトに反映されます。

削除も同じ画面の「登録済みの資料」一覧から行えます。「一覧の先頭に固定表示する」にチェックすると、並び替え条件に関わらずその資料が常に一番上に表示されます。

### Google Driveのリンクについて

- 資料・動画のファイルはGoogle Driveにアップロードし、共有設定を **「リンクを知っている全員が閲覧可」** にしてください。
- 対応しているリンク形式（自動でサムネイル・プレビュー埋め込みに変換されます）:
  - `https://drive.google.com/file/d/<ID>/view?usp=sharing`（PDF・動画などのファイル）
  - `https://drive.google.com/open?id=<ID>`
  - `https://docs.google.com/presentation|document|spreadsheets/d/<ID>/edit`
- 資料・動画の両方を登録した場合、カード/詳細画面に両方のバッジが表示され、詳細画面内のタブで切り替えて閲覧できます。

## Googleフォームからの投稿(スタッフ向け・任意)

管理画面(GitHubトークンが必要)の代わりに、Googleフォームに入力するだけで
資料を追加できる仕組みも用意しています。GitHubトークンはApps Script側に
1回だけ設定すればよく、投稿する人はGitHubを一切意識しません。

セットアップ手順は [`automation/README.md`](automation/README.md) を参照してください。

## ローカルでの確認方法

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

（`fetch`でJSONを読み込むため、`file://`で直接開くとブラウザによっては動作しません。必ず簡易サーバー経由で確認してください。）

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
  "submittedBy": "投稿者名（任意。サイトには【投稿者:○○】と表示されます）",
  "materialUrl": "Google Driveの資料リンク（任意）",
  "materialType": "写真の場合は \"image\"、それ以外は空文字（任意。写真は画像として大きく表示されます）",
  "videoUrl": "Google Driveの動画リンク（任意）",
  "pinned": false
}
```

`category` は文字列だけでなく配列でも指定できます（例: `["マーケティング", "全社共通"]`）。管理画面を使わずに、このファイルを直接編集してpushしても問題ありません。
