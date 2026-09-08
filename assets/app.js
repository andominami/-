(function () {
  const DATA_URL = 'data/materials.json';
  const ALL_CATEGORY = 'すべて';
  const FAVORITES_KEY = 'seminar-lib-favorites';

  function getCategories(item) {
    if (Array.isArray(item.category)) return item.category;
    return item.category ? [item.category] : [];
  }

  function loadFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []);
    } catch (e) {
      return new Set();
    }
  }

  function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  }

  const state = {
    items: [],
    activeCategory: ALL_CATEGORY,
    query: '',
    sortOrder: 'new',
    mediaType: 'all',
    favorites: loadFavorites(),
  };

  const els = {
    grid: document.getElementById('card-grid'),
    mediaTabs: document.getElementById('media-tabs'),
    categoryFilters: document.getElementById('category-filters'),
    search: document.getElementById('search-input'),
    sort: document.getElementById('sort-select'),
    resultCount: document.getElementById('result-count'),
    emptyMessage: document.getElementById('empty-message'),
    modal: document.getElementById('detail-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalMeta: document.getElementById('modal-meta'),
    modalDescription: document.getElementById('modal-description'),
    modalTabs: document.getElementById('modal-tabs'),
    modalFrameWrap: document.getElementById('modal-frame-wrap'),
    modalIframe: document.getElementById('modal-iframe'),
    modalImage: document.getElementById('modal-image'),
    modalFavoriteBtn: document.getElementById('modal-favorite-btn'),
    modalClose: document.getElementById('modal-close'),
  };

  let currentItem = null;

  function isFavorite(id) {
    return state.favorites.has(id);
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    saveFavorites();
  }

  function hasMaterial(item) {
    return !!driveFileIdFromUrl(item.materialUrl);
  }
  function hasVideo(item) {
    return !!driveFileIdFromUrl(item.videoUrl);
  }

  function matchesMediaType(item) {
    switch (state.mediaType) {
      case 'material':
        return hasMaterial(item);
      case 'video':
        return hasVideo(item);
      case 'favorite':
        return isFavorite(item.id);
      default:
        return true;
    }
  }

  function thumbFileId(item) {
    const videoId = driveFileIdFromUrl(item.videoUrl);
    if (videoId) return videoId;
    return driveFileIdFromUrl(item.materialUrl);
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      state.items = await res.json();
    } catch (e) {
      console.error('資料データの読み込みに失敗しました', e);
      state.items = [];
    }
    bindEvents();
    renderCategoryFilters();
    renderGrid();
    openFromHash();
  }

  function renderCategoryFilters() {
    const itemsForTabs = state.items.filter(matchesMediaType);
    const used = [...new Set(itemsForTabs.flatMap(getCategories))].sort((a, b) =>
      a.localeCompare(b, 'ja')
    );
    const categories = [ALL_CATEGORY, ...used];
    els.categoryFilters.innerHTML = '';
    for (const category of categories) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'category-btn' + (category === state.activeCategory ? ' active' : '');
      btn.textContent = category;
      btn.addEventListener('click', () => {
        state.activeCategory = category;
        renderCategoryFilters();
        renderGrid();
      });
      els.categoryFilters.appendChild(btn);
    }
  }

  function getFilteredItems() {
    const query = state.query.trim().toLowerCase();
    const filtered = state.items.filter((item) => {
      const matchesCategory =
        state.activeCategory === ALL_CATEGORY || getCategories(item).includes(state.activeCategory);
      const haystack = [item.title, item.description, item.speaker, ...(item.tags || [])]
        .join(' ')
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesCategory && matchesMediaType(item) && matchesQuery;
    });

    const pinned = filtered.filter((i) => i.pinned);
    const rest = filtered.filter((i) => !i.pinned);

    let sortedRest;
    switch (state.sortOrder) {
      case 'old':
        sortedRest = [...rest].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        break;
      case 'title':
        sortedRest = [...rest].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));
        break;
      case 'new':
      default:
        sortedRest = [...rest].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    return [...pinned, ...sortedRest];
  }

  function renderGrid() {
    const items = getFilteredItems();
    els.resultCount.textContent = `${items.length} 件`;
    els.grid.innerHTML = '';
    els.emptyMessage.hidden = items.length > 0;

    for (const item of items) {
      els.grid.appendChild(renderCard(item));
    }
  }

  function renderCard(item) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'video-card';
    card.addEventListener('click', () => openModal(item));

    const thumb = document.createElement('div');
    thumb.className = 'video-thumb';
    const fileId = thumbFileId(item);
    if (fileId) {
      const img = document.createElement('img');
      img.src = driveThumbUrl(fileId);
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => img.remove());
      thumb.appendChild(img);
    } else {
      thumb.classList.add('is-text');
    }

    if (item.pinned) {
      const pinnedBadge = document.createElement('span');
      pinnedBadge.className = 'thumb-pinned-badge';
      pinnedBadge.textContent = '📌';
      thumb.appendChild(pinnedBadge);
    }

    const badges = document.createElement('div');
    badges.className = 'thumb-type-badges';
    if (hasVideo(item)) {
      const b = document.createElement('span');
      b.className = 'thumb-type-badge';
      b.textContent = '🎬 動画';
      badges.appendChild(b);
    }
    if (hasMaterial(item)) {
      const b = document.createElement('span');
      b.className = 'thumb-type-badge';
      b.textContent = '📄 資料';
      badges.appendChild(b);
    }
    thumb.appendChild(badges);

    const favoriteBtn = document.createElement('span');
    favoriteBtn.className = 'favorite-btn' + (isFavorite(item.id) ? ' active' : '');
    favoriteBtn.textContent = isFavorite(item.id) ? '♥' : '♡';
    favoriteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(item.id);
      renderGrid();
    });
    thumb.appendChild(favoriteBtn);

    const info = document.createElement('div');
    info.className = 'video-info';
    info.innerHTML = `
      ${getCategories(item).map((c) => `<span class="video-category">${escapeHtml(c)}</span>`).join('')}
      ${item.date ? `<span class="video-date">${escapeHtml(formatDate(item.date))}</span>` : ''}
      ${item.speaker ? `<span class="video-date">${escapeHtml(item.speaker)}</span>` : ''}
      ${item.submittedBy ? `<span class="video-date">【投稿者:${escapeHtml(item.submittedBy)}】</span>` : ''}
      <h3 class="video-title">${escapeHtml(item.title)}</h3>
      <p class="video-description">${escapeHtml(item.description)}</p>
    `;

    card.appendChild(thumb);
    card.appendChild(info);
    return card;
  }

  function renderModalTabs(item) {
    els.modalTabs.innerHTML = '';
    const options = [];
    if (hasVideo(item)) options.push({ key: 'video', label: '🎬 動画を見る' });
    if (hasMaterial(item)) options.push({ key: 'material', label: '📄 資料を見る' });
    if (options.length <= 1) {
      els.modalTabs.hidden = true;
      return options[0] ? options[0].key : null;
    }
    els.modalTabs.hidden = false;
    let active = options[0].key;
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'modal-tab' + (opt.key === active ? ' active' : '');
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        for (const b of els.modalTabs.children) b.classList.remove('active');
        btn.classList.add('active');
        showModalFrame(item, opt.key);
      });
      els.modalTabs.appendChild(btn);
    }
    return active;
  }

  function showModalFrame(item, key) {
    const url = key === 'video' ? item.videoUrl : item.materialUrl;
    const fileId = driveFileIdFromUrl(url);
    const isImage = key === 'material' && item.materialType === 'image';

    if (!fileId) {
      els.modalFrameWrap.hidden = true;
      els.modalIframe.hidden = false;
      els.modalIframe.src = '';
      els.modalImage.hidden = true;
      els.modalImage.src = '';
      return;
    }

    els.modalFrameWrap.hidden = false;
    els.modalFrameWrap.classList.toggle('is-pdf', key === 'material' && !isImage);
    els.modalFrameWrap.classList.toggle('is-image', isImage);

    if (isImage) {
      // 写真はGoogle Driveの汎用プレビュー(ズームアイコン等が出て見づらい)ではなく、
      // 画像そのものを大きく表示する。
      els.modalIframe.hidden = true;
      els.modalIframe.src = '';
      els.modalImage.hidden = false;
      els.modalImage.src = driveThumbUrl(fileId, 'w1600');
    } else {
      els.modalImage.hidden = true;
      els.modalImage.src = '';
      els.modalIframe.hidden = false;
      els.modalIframe.src = driveEmbedUrl(fileId);
    }
  }

  function renderModalFavoriteBtn() {
    const active = currentItem && isFavorite(currentItem.id);
    els.modalFavoriteBtn.classList.toggle('active', !!active);
    els.modalFavoriteBtn.textContent = active ? '♥' : '♡';
  }

  function openModal(item) {
    currentItem = item;
    renderModalFavoriteBtn();
    const startKey = renderModalTabs(item);
    if (startKey) {
      showModalFrame(item, startKey);
    } else {
      els.modalFrameWrap.hidden = true;
      els.modalIframe.src = '';
    }

    const metaParts = [
      formatDate(item.date),
      item.speaker,
      ...getCategories(item),
      item.submittedBy ? `【投稿者:${item.submittedBy}】` : '',
    ].filter(Boolean);
    els.modalTitle.textContent = item.pinned ? `📌 ${item.title}` : item.title;
    els.modalMeta.textContent = metaParts.join(' ・ ');
    els.modalDescription.textContent = item.description || '';

    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    renderGrid();
    history.replaceState(null, '', `#id=${encodeURIComponent(item.id)}`);
  }

  function closeModal() {
    els.modal.hidden = true;
    els.modalIframe.src = '';
    els.modalImage.src = '';
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname + location.search);
  }

  function openFromHash() {
    const match = location.hash.match(/^#id=(.+)$/);
    if (!match) return;
    const id = decodeURIComponent(match[1]);
    const item = state.items.find((v) => v.id === id);
    if (item) openModal(item);
  }

  function bindEvents() {
    els.search.addEventListener('input', (e) => {
      state.query = e.target.value;
      renderGrid();
    });
    els.sort.addEventListener('change', (e) => {
      state.sortOrder = e.target.value;
      renderGrid();
    });
    for (const tab of els.mediaTabs.querySelectorAll('.media-tab')) {
      tab.addEventListener('click', () => {
        state.mediaType = tab.dataset.media;
        for (const t of els.mediaTabs.querySelectorAll('.media-tab')) {
          t.classList.toggle('active', t === tab);
        }
        renderCategoryFilters();
        renderGrid();
      });
    }
    els.modalFavoriteBtn.addEventListener('click', () => {
      if (!currentItem) return;
      toggleFavorite(currentItem.id);
      renderModalFavoriteBtn();
      renderGrid();
    });
    els.modalClose.addEventListener('click', closeModal);
    els.modal.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });
  }

  initLock(init);
})();
