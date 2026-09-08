(function () {
  const DATA_URL = 'data/materials.json';

  const state = {
    all: [],
    query: '',
    category: '',
    tags: new Set(),
    sort: 'date-desc',
  };

  const els = {
    grid: document.getElementById('card-grid'),
    search: document.getElementById('search-input'),
    category: document.getElementById('category-filter'),
    sort: document.getElementById('sort-order'),
    tagCloud: document.getElementById('tag-cloud'),
    resultCount: document.getElementById('result-count'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalClose: document.getElementById('modal-close'),
  };

  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      state.all = await res.json();
    } catch (e) {
      console.error('資料データの読み込みに失敗しました', e);
      state.all = [];
    }
    buildCategoryOptions();
    buildTagCloud();
    bindEvents();
    render();
  }

  function buildCategoryOptions() {
    const categories = Array.from(new Set(state.all.map((m) => m.category).filter(Boolean))).sort();
    for (const c of categories) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      els.category.appendChild(opt);
    }
  }

  function buildTagCloud() {
    const tags = Array.from(new Set(state.all.flatMap((m) => m.tags || []))).sort();
    els.tagCloud.innerHTML = '';
    for (const tag of tags) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip';
      btn.textContent = tag;
      btn.addEventListener('click', () => {
        if (state.tags.has(tag)) {
          state.tags.delete(tag);
          btn.classList.remove('active');
        } else {
          state.tags.add(tag);
          btn.classList.add('active');
        }
        render();
      });
      els.tagCloud.appendChild(btn);
    }
  }

  function bindEvents() {
    els.search.addEventListener('input', () => {
      state.query = els.search.value.trim().toLowerCase();
      render();
    });
    els.category.addEventListener('change', () => {
      state.category = els.category.value;
      render();
    });
    els.sort.addEventListener('change', () => {
      state.sort = els.sort.value;
      render();
    });
    els.modalClose.addEventListener('click', closeModal);
    els.modalOverlay.addEventListener('click', (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function matchesQuery(item) {
    if (!state.query) return true;
    const haystack = [
      item.title,
      item.speaker,
      item.category,
      item.description,
      ...(item.tags || []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(state.query);
  }

  function matchesCategory(item) {
    return !state.category || item.category === state.category;
  }

  function matchesTags(item) {
    if (state.tags.size === 0) return true;
    const itemTags = new Set(item.tags || []);
    for (const t of state.tags) {
      if (itemTags.has(t)) return true;
    }
    return false;
  }

  function sortItems(items) {
    const sorted = [...items];
    switch (state.sort) {
      case 'date-asc':
        sorted.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        break;
      case 'title-asc':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));
        break;
      case 'date-desc':
      default:
        sorted.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    return sorted;
  }

  function render() {
    const filtered = sortItems(
      state.all.filter((item) => matchesQuery(item) && matchesCategory(item) && matchesTags(item))
    );

    els.resultCount.textContent = `${filtered.length} 件の資料`;
    els.grid.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '該当する資料が見つかりませんでした。検索条件を変えてお試しください。';
      els.grid.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      els.grid.appendChild(renderCard(item));
    }
  }

  function renderCard(item) {
    const card = document.createElement('article');
    card.className = 'card';

    const metaParts = [formatDate(item.date), item.speaker, item.category].filter(Boolean);

    card.innerHTML = `
      <h2>${escapeHtml(item.title)}</h2>
      <div class="meta">${escapeHtml(metaParts.join(' ・ '))}</div>
      <div class="description">${escapeHtml(item.description)}</div>
      <div class="tags">${(item.tags || []).map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>
      <div class="actions"></div>
    `;

    const actions = card.querySelector('.actions');

    if (item.materialUrl) {
      actions.appendChild(
        makeActionButton('資料を見る', item.materialUrl, `${item.title}（資料）`)
      );
    }
    if (item.videoUrl) {
      actions.appendChild(
        makeActionButton('動画を見る', item.videoUrl, `${item.title}（動画）`, true)
      );
    }
    if (!item.materialUrl && !item.videoUrl) {
      const span = document.createElement('span');
      span.className = 'meta';
      span.textContent = '資料・動画は準備中です';
      actions.appendChild(span);
    }

    return card;
  }

  function makeActionButton(label, url, title, primary) {
    const btn = document.createElement('a');
    btn.className = primary ? 'btn primary' : 'btn';
    btn.textContent = label;
    btn.href = url;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';

    const embedUrl = getEmbeddableUrl(url);
    if (embedUrl) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(title, embedUrl);
      });
    }
    return btn;
  }

  function openModal(title, embedUrl) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = `<iframe src="${embedUrl}" allow="autoplay" allowfullscreen></iframe>`;
    els.modalOverlay.hidden = false;
  }

  function closeModal() {
    els.modalOverlay.hidden = true;
    els.modalBody.innerHTML = '';
  }

  init();
})();
