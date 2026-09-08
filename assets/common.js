// Shared helpers used by both the public site (app.js) and the admin page (admin.js).

/**
 * Google Drive / Docs のリンクを、iframe に埋め込んで再生・プレビューできる
 * URL に変換する。埋め込みに対応していない形式の場合は null を返す
 * (呼び出し側は新しいタブで開く等のフォールバックを行うこと)。
 *
 * 対応リンク例:
 *  - https://drive.google.com/file/d/<ID>/view?usp=sharing  (PDF, 動画など)
 *  - https://drive.google.com/open?id=<ID>
 *  - https://docs.google.com/presentation/d/<ID>/edit
 *  - https://docs.google.com/document/d/<ID>/edit
 *  - https://docs.google.com/spreadsheets/d/<ID>/edit
 */
function getEmbeddableUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/drive\.google\.com|docs\.google\.com/.test(u.hostname)) return null;

    // drive.google.com/file/d/<ID>/...
    let m = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;

    // drive.google.com/open?id=<ID> or ...?id=<ID>
    const idParam = u.searchParams.get('id');
    if (idParam) return `https://drive.google.com/file/d/${idParam}/preview`;

    // docs.google.com/presentation|document|spreadsheets/d/<ID>/...
    m = u.pathname.match(/\/(presentation|document|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;

    return null;
  } catch (e) {
    return null;
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}
