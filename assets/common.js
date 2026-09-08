// index.html / admin.html の両方から読み込まれる共通ユーティリティ。
// 「たんぽぽ歯科マニュアル」サイトと同じ考え方(合言葉ロック・Google Driveのプレビュー/サムネイル埋め込み)を踏襲しています。

// ---- 合言葉ロック ----
// パスワードそのものではなく SHA-256 のハッシュ値だけをソースに置く。
// 変更したい場合はブラウザのコンソールで下記を実行してハッシュを作り直してください。
//   await crypto.subtle.digest('SHA-256', new TextEncoder().encode('新しい合言葉'))
//     .then(buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''))
const LOCK_PASSWORD_HASH =
  '90116063acc4ab1bff21066e506c308ccb719a47247ca2b89d7cc89d0fb89880';
const LOCK_STORAGE_KEY = 'seminar-lib-unlocked';

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ロック画面の初期化。#lock-screen / #lock-form / #lock-password / #lock-error / #site-content
 * という id を持つ要素がページ内にある前提。解除できたら onUnlock() を呼ぶ。
 */
function initLock(onUnlock) {
  const lockScreen = document.getElementById('lock-screen');
  const lockForm = document.getElementById('lock-form');
  const lockPassword = document.getElementById('lock-password');
  const lockError = document.getElementById('lock-error');
  const siteContent = document.getElementById('site-content');

  function unlock() {
    lockScreen.hidden = true;
    siteContent.hidden = false;
    onUnlock();
  }

  if (localStorage.getItem(LOCK_STORAGE_KEY) === '1') {
    unlock();
    return;
  }

  lockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hash = await sha256Hex(lockPassword.value);
    if (hash === LOCK_PASSWORD_HASH) {
      localStorage.setItem(LOCK_STORAGE_KEY, '1');
      lockError.hidden = true;
      unlock();
    } else {
      lockError.hidden = false;
      lockPassword.value = '';
      lockPassword.focus();
    }
  });
}

// ---- Google Drive リンクのユーティリティ ----

/**
 * Google Drive / Docs の共有URLからファイルIDを取り出す。取り出せなければ null。
 * 対応例:
 *  - https://drive.google.com/file/d/<ID>/view?usp=sharing
 *  - https://drive.google.com/open?id=<ID>
 *  - https://docs.google.com/presentation/d/<ID>/edit
 */
function driveFileIdFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/drive\.google\.com|docs\.google\.com/.test(u.hostname)) return null;

    let m = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];

    const idParam = u.searchParams.get('id');
    if (idParam) return idParam;

    m = u.pathname.match(/\/(?:presentation|document|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];

    return null;
  } catch (e) {
    return null;
  }
}

function driveEmbedUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

function driveThumbUrl(fileId, size = 'w400') {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=${size}`;
}

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}
