/**
 * Googleフォームの回答(に紐づくスプレッドシート)から自動で発火し、
 * andominami/tanpopo-seminar リポジトリの data/materials.json に新しいセミナー資料を追加して、
 * GitHub Pages のサイトへ自動反映するスクリプト。
 *
 * セットアップ手順は automation/README.md を参照。
 *
 * 前提とするフォームの質問:
 *   - タイトル              (記述式・必須)
 *   - 実施日                (日付)
 *   - 登壇者・講師           (記述式・任意)
 *   - カテゴリ               (プルダウン・必須。CATEGORIES と同じ選択肢にする)
 *   - タグ                  (記述式・任意。カンマ区切りで複数入力可)
 *   - 概要                  (段落・任意)
 *   - 投稿者                (記述式・任意)
 *   - 資料ファイル(写真やPDF) (ファイルのアップロード・任意・複数可)
 *   - 資料ファイル(動画)      (ファイルのアップロード・任意・1個のみ)
 *
 * 質問文は上記と「前方一致」していればよく(例:「タイトル」の後に説明を
 * 括弧書きで足しても問題ない)、完全に同じ表記でなくても動く。ただし
 * 「資料ファイル(写真やPDF)」と「資料ファイル(動画)」のように同じ言葉で
 * 始まる質問が複数ある場合は、「動画」という文字が含まれているかどうかで
 * 見分けている(下の findAnswer 呼び出し箇所を参照)。
 *
 * 「資料ファイル(写真やPDF)」は複数ファイルをまとめてアップロードでき、
 * サイト側では1件の投稿の中で前へ/次へをめくって見られる。「資料ファイル
 * (動画)」はフォーム側の設定で1個までに制限すること(先頭の1件しか使わない)。
 *
 * これらのファイルはGoogleフォームの仕様上、まず回答者(または
 * フォーム所有者)のGoogleドライブに保存される。このスクリプトはファイル本体を
 * GitHubにはコピーせず(動画は大きすぎてGitHubに向かないため)、ドライブ上の
 * ファイルの共有設定を「リンクを知っている全員が閲覧可」に変更したうえで、
 * そのファイルへの共有リンクだけを data/materials.json に保存する。
 * サイト側は既存の Google Drive 埋め込み表示の仕組みでそのまま再生・プレビューできる。
 *
 * 使う前に、スクリプトエディタの「プロジェクトの設定」→「スクリプト プロパティ」に
 * 以下を登録しておくこと(コードに直接書かない):
 *   GITHUB_TOKEN … リポジトリへの書き込み権限を持つGitHubのアクセストークン
 *   REPO_OWNER   … andominami
 *   REPO_NAME    … tanpopo-seminar
 */

// フォームの「カテゴリ」プルダウンと合わせること。
const CATEGORIES = [
  "小出セミナー",
  "秋葉塾",
  "その他入力関連",
  "インプラント",
  "その他歯科治療関連",
  "DH関連",
  "口腔機能関連",
  "その他",
];

const MATERIALS_PATH = "data/materials.json";
const BRANCH = "main";
const MAX_RETRIES = 3;

/**
 * スプレッドシートの「フォーム送信時」トリガーから呼ばれる関数。
 * トリガーの設定方法は README 参照(onOpen等では自動発火しないため、
 * 手動でインストール型トリガーを登録する必要がある)。
 */
function onFormSubmit(e) {
  // Drive APIを直接呼ぶだけだとApps Scriptがdriveスコープを自動要求しないため、
  // DriveAppを一度呼んでおき、権限承認時にdriveスコープが含まれるようにする。
  DriveApp.getRootFolder();

  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("GITHUB_TOKEN");
  const owner = props.getProperty("REPO_OWNER");
  const repo = props.getProperty("REPO_NAME");

  if (!token || !owner || !repo) {
    throw new Error(
      "スクリプトプロパティに GITHUB_TOKEN / REPO_OWNER / REPO_NAME を設定してください。"
    );
  }

  const values = e.namedValues || {};

  const title = findAnswer(values, (k) => k.startsWith("タイトル"));
  if (!title) return; // タイトル未入力は何もしない(フォーム側の必須設定で基本発生しない想定)

  const speaker = findAnswer(values, (k) => k.startsWith("登壇者"));
  const categoryAnswer = findAnswer(values, (k) => k.startsWith("カテゴリ"));
  const category = CATEGORIES.includes(categoryAnswer) ? categoryAnswer : "その他";
  const tagsRaw = findAnswer(values, (k) => k.startsWith("タグ"));
  const tags = tagsRaw
    ? tagsRaw.split(/[,、]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const description = findAnswer(values, (k) => k.startsWith("概要"));
  const date = normalizeDate(findAnswer(values, (k) => k.startsWith("実施日")));
  const submittedBy = findAnswer(values, (k) => k.startsWith("投稿者"));

  // 「資料ファイル(写真やPDF)」「資料ファイル(動画)」のように同じ言葉で始まる
  // 質問が複数あるので、「動画」を含むかどうかで見分ける。
  const materialAnswer = findAnswer(
    values,
    (k) => k.startsWith("資料ファイル") && !k.includes("動画")
  );
  const videoAnswer = findAnswer(
    values,
    (k) => k.startsWith("資料ファイル") && k.includes("動画")
  );
  // 「資料ファイル」は複数アップロードできるので全件を拾う。動画は1件のみの想定。
  const materialFiles = resolveDriveUploads(materialAnswer);
  const videoFiles = resolveDriveUploads(videoAnswer);
  const materialEntries = materialFiles.map((f) => ({ url: f.url, type: f.isImage ? "image" : "" }));
  const videoUrl = videoFiles.length ? videoFiles[0].url : "";

  const id = `form-${Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd-HHmmss")}`;

  runWithRetry(() => {
    const { sha, materials } = fetchMaterialsJson(owner, repo, token);
    materials.unshift({
      id,
      title,
      date,
      speaker,
      category,
      tags,
      description,
      submittedBy,
      materials: materialEntries,
      videoUrl,
      pinned: false,
    });
    putFile(
      owner,
      repo,
      token,
      MATERIALS_PATH,
      JSON.stringify(materials, null, 2) + "\n",
      `フォームから資料を追加: ${title}`,
      sha
    );
  });
}

/**
 * e.namedValues(質問文 → 回答値の配列)から、条件に一致する最初の質問の
 * 回答を取り出す。質問文の完全一致ではなく前方一致等で判定できるため、
 * 質問文に補足説明を括弧書きで足すなど多少の変更をしても壊れにくい。
 */
function findAnswer(namedValues, matcher) {
  const key = Object.keys(namedValues).find(matcher);
  if (!key) return "";
  return ((namedValues[key] || [])[0] || "").trim();
}

/** data/materials.json の現在の内容とshaを取得する */
function fetchMaterialsJson(owner, repo, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${MATERIALS_PATH}?ref=${BRANCH}`;
  const res = UrlFetchApp.fetch(url, {
    headers: ghHeaders(token),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`materials.jsonの取得に失敗: ${res.getContentText()}`);
  }
  const meta = JSON.parse(res.getContentText());
  const content = Utilities.newBlob(
    Utilities.base64Decode(meta.content.replace(/\n/g, ""))
  ).getDataAsString("UTF-8");
  return { sha: meta.sha, materials: JSON.parse(content) };
}

/**
 * ファイルアップロード質問の回答(DriveのURL。複数ファイルはカンマ区切りで
 * 入っている)から、アップロードされた全ファイル分の共有リンクを作る。
 * あわせて、写真(画像ファイル)かどうかも判定して返す。写真の場合サイト側は
 * Driveの汎用プレビュー(ズームアイコン等が出て見づらい)ではなく、画像を
 * そのまま大きくきれいに表示する。
 * 回答が空・ファイルが見つからない場合は空配列を返す(その場合サイト上では
 * 「準備中」扱いになるだけで、投稿自体は失敗させない)。
 */
function resolveDriveUploads(answer) {
  if (!answer) return [];
  const urls = answer.split(",").map((s) => s.trim()).filter(Boolean);
  const results = [];
  urls.forEach((url) => {
    const fileId = extractDriveFileId(url);
    if (!fileId) return;
    try {
      setFilePubliclyViewable(fileId);
    } catch (err) {
      console.error(`共有設定に失敗(fileId=${fileId}): ${err}`);
    }
    let isImage = false;
    try {
      isImage = isImageFile(fileId);
    } catch (err) {
      console.error(`ファイル種別の判定に失敗(fileId=${fileId}): ${err}`);
    }
    results.push({ url: `https://drive.google.com/file/d/${fileId}/view`, isImage });
  });
  return results;
}

/** ドライブのファイルが画像(写真)かどうかをMIMEタイプから判定する */
function isImageFile(fileId) {
  const token = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return false;
  const meta = JSON.parse(res.getContentText());
  return (meta.mimeType || "").indexOf("image/") === 0;
}

/** ドライブのファイルを「リンクを知っている全員が閲覧可」に変更する */
function setFilePubliclyViewable(fileId) {
  const token = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`,
    {
      method: "post",
      headers: { Authorization: `Bearer ${token}` },
      contentType: "application/json",
      payload: JSON.stringify({ role: "reader", type: "anyone" }),
      muteHttpExceptions: true,
    }
  );
  if (res.getResponseCode() >= 300) {
    throw new Error(`共有設定APIエラー: ${res.getContentText()}`);
  }
}

/** GitHubにテキストファイルを作成/更新する。shaを渡すと更新、渡さないと新規作成。 */
function putFile(owner, repo, token, path, textContent, message, sha) {
  const content = Utilities.base64Encode(
    Utilities.newBlob(textContent, "application/json").getBytes()
  );
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const payload = { message, content, branch: BRANCH };
  if (sha) payload.sha = sha;

  const res = UrlFetchApp.fetch(url, {
    method: "put",
    headers: ghHeaders(token),
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new ConflictOrError(code, res.getContentText());
  }
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
}

function extractDriveFileId(url) {
  const m = url.match(/[-\w]{25,}/);
  return m ? m[0] : null;
}

/** "2026/03/05" のようなフォーム標準の日付表記を "2026-03-05" に揃える */
function normalizeDate(dateStr) {
  if (!dateStr) return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  const m = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return dateStr;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** data/materials.json は複数投稿が重なるとsha競合(409/422)することがあるため、少しだけ再試行する */
function runWithRetry(fn) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      fn();
      return;
    } catch (err) {
      const isConflict = err instanceof ConflictOrError && (err.code === 409 || err.code === 422);
      if (!isConflict || i === MAX_RETRIES - 1) throw err;
      Utilities.sleep(1000 * (i + 1));
    }
  }
}

class ConflictOrError extends Error {
  constructor(code, body) {
    super(`GitHub API error ${code}: ${body}`);
    this.code = code;
  }
}
