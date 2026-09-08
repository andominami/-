(function () {
  // このリポジトリの owner/repo。fork して使う場合はここを書き換えてください。
  const OWNER = 'andominami';
  const REPO = 'tanpopo-seminar';
  const DATA_PATH = 'data/materials.json';
  const TOKEN_STORAGE_KEY = 'seminar_lib_admin_token';

  let defaultBranch = null;
  let currentSha = null;
  let currentData = [];

  const els = {
    tokenInput: document.getElementById('token-input'),
    tokenSave: document.getElementById('token-save'),
    tokenClear: document.getElementById('token-clear'),
    tokenStatus: document.getElementById('token-status'),
    form: document.getElementById('material-form'),
    formNotice: document.getElementById('form-notice'),
    submitBtn: document.getElementById('submit-btn'),
    list: document.getElementById('admin-list'),
    listNotice: document.getElementById('list-notice'),
    refreshBtn: document.getElementById('refresh-btn'),
  };

  function getToken() {
    return els.tokenInput.value.trim() || localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  }

  function initTokenUI() {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (saved) {
      els.tokenInput.value = saved;
      setTokenStatus('保存済みのトークンを読み込みました。', 'info');
    }
    els.tokenSave.addEventListener('click', () => {
      const t = els.tokenInput.value.trim();
      if (!t) {
        setTokenStatus('トークンを入力してください。', 'error');
        return;
      }
      localStorage.setItem(TOKEN_STORAGE_KEY, t);
      setTokenStatus('このブラウザにトークンを保存しました。', 'success');
    });
    els.tokenClear.addEventListener('click', () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      els.tokenInput.value = '';
      setTokenStatus('保存したトークンを削除しました。', 'info');
    });
  }

  function setTokenStatus(msg, type) {
    els.tokenStatus.textContent = msg;
    els.tokenStatus.className = `notice ${type}`;
    els.tokenStatus.hidden = false;
  }

  function setFormNotice(msg, type) {
    els.formNotice.textContent = msg;
    els.formNotice.className = `notice ${type}`;
    els.formNotice.hidden = false;
  }

  function setListNotice(msg, type) {
    els.listNotice.textContent = msg;
    els.listNotice.className = `notice ${type}`;
    els.listNotice.hidden = false;
  }

  function authHeaders() {
    const token = getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async function ghFetch(path, options = {}) {
    const token = getToken();
    if (!token) {
      throw new Error('GitHub のトークンを入力してください。');
    }
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body.message || '';
      } catch (e) {
        /* noop */
      }
      if (res.status === 401) {
        throw new Error('トークンが無効です。有効な GitHub トークンを入力してください。');
      }
      if (res.status === 403) {
        throw new Error('権限がありません。トークンに Contents: Read and write 権限を付与してください。');
      }
      if (res.status === 404) {
        throw new Error(`リポジトリまたはファイルが見つかりません (${detail || 'Not Found'})。`);
      }
      if (res.status === 409) {
        throw new Error('他の変更と競合しました。もう一度「最新の状態に更新」してからやり直してください。');
      }
      throw new Error(detail || `GitHub API エラー (${res.status})`);
    }
    return res.json();
  }

  function b64EncodeUtf8(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  function b64DecodeUtf8(b64) {
    const binary = atob(b64.replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  async function getDefaultBranch() {
    if (defaultBranch) return defaultBranch;
    const repoInfo = await ghFetch('');
    defaultBranch = repoInfo.default_branch || 'main';
    return defaultBranch;
  }

  async function loadMaterialsFile() {
    const branch = await getDefaultBranch();
    const file = await ghFetch(`/contents/${DATA_PATH}?ref=${encodeURIComponent(branch)}`);
    currentSha = file.sha;
    currentData = JSON.parse(b64DecodeUtf8(file.content));
    return currentData;
  }

  async function saveMaterialsFile(newData, message) {
    const branch = await getDefaultBranch();
    const content = b64EncodeUtf8(JSON.stringify(newData, null, 2) + '\n');
    const result = await ghFetch(`/contents/${DATA_PATH}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content,
        sha: currentSha,
        branch,
      }),
    });
    currentSha = result.content.sha;
    currentData = newData;
    return result;
  }

  function slugify(title, date) {
    const base = (date || '') + '-' + (title || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/(^-|-$)/g, '');
    const random = Math.random().toString(36).slice(2, 6);
    return `${base}-${random}`.replace(/^-+/, '') || `item-${Date.now()}`;
  }

  function readForm() {
    const fd = new FormData(els.form);
    const tags = String(fd.get('tags') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return {
      title: String(fd.get('title') || '').trim(),
      date: String(fd.get('date') || '').trim(),
      speaker: String(fd.get('speaker') || '').trim(),
      submittedBy: String(fd.get('submittedBy') || '').trim(),
      category: String(fd.get('category') || '').trim(),
      tags,
      description: String(fd.get('description') || '').trim(),
      materialUrl: String(fd.get('materialUrl') || '').trim(),
      videoUrl: String(fd.get('videoUrl') || '').trim(),
      pinned: fd.get('pinned') === 'on',
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const entry = readForm();
    if (!entry.title) {
      setFormNotice('タイトルは必須です。', 'error');
      return;
    }
    entry.id = slugify(entry.title, entry.date);

    setSubmitting(true);
    try {
      await loadMaterialsFile();
      const newData = [entry, ...currentData];
      await saveMaterialsFile(newData, `Add material: ${entry.title}`);
      setFormNotice(`「${entry.title}」を登録しました。GitHub Pages への反映まで数分かかる場合があります。`, 'success');
      els.form.reset();
      await renderList();
    } catch (err) {
      console.error(err);
      setFormNotice(err.message || '登録に失敗しました。', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function setSubmitting(isSubmitting) {
    els.submitBtn.disabled = isSubmitting;
    els.submitBtn.innerHTML = isSubmitting
      ? '<span class="spinner"></span> 登録中…'
      : '登録する';
  }

  async function handleDelete(id, title) {
    if (!confirm(`「${title}」を削除します。よろしいですか？`)) return;
    try {
      await loadMaterialsFile();
      const newData = currentData.filter((m) => m.id !== id);
      await saveMaterialsFile(newData, `Remove material: ${title}`);
      setListNotice(`「${title}」を削除しました。`, 'success');
      await renderList();
    } catch (err) {
      console.error(err);
      setListNotice(err.message || '削除に失敗しました。', 'error');
    }
  }

  async function renderList() {
    els.list.innerHTML = '<p class="notice info">読み込み中…</p>';
    try {
      const data = await loadMaterialsFile();
      els.list.innerHTML = '';
      if (data.length === 0) {
        els.list.innerHTML = '<p class="notice info">登録されている資料はまだありません。</p>';
        return;
      }
      for (const item of data) {
        const row = document.createElement('div');
        row.className = 'admin-row';
        const metaParts = [formatDate(item.date), item.speaker, item.category].filter(Boolean);
        row.innerHTML = `
          <div class="info">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(metaParts.join(' ・ '))}</span>
          </div>
        `;
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn';
        delBtn.textContent = '削除';
        delBtn.addEventListener('click', () => handleDelete(item.id, item.title));
        row.appendChild(delBtn);
        els.list.appendChild(row);
      }
    } catch (err) {
      console.error(err);
      els.list.innerHTML = '';
      setListNotice(err.message || '一覧の取得に失敗しました。トークンを設定してください。', 'error');
    }
  }

  function init() {
    initTokenUI();
    els.form.addEventListener('submit', handleSubmit);
    els.refreshBtn.addEventListener('click', renderList);
    if (getToken()) {
      renderList();
    }
  }

  initLock(init);
})();
