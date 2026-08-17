// js/ui/bookmarks.js
import { Storage } from '../storage.js';
import { Icon, escapeHtml, formatDate, confirmModal, toast } from './common.js';
import { navigate } from '../router.js';

export function renderBookmarks(container) {
  container.innerHTML = `
    <div class="container">
      <div class="page-hero" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:10px">
        <div>
          <h1>Bookmarks</h1>
          <p>Ayahs you've saved for later — stored on this device.</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="clear-bookmarks">${Icon.trash} Clear all</button>
      </div>
      <div id="bookmarks-list" style="display:flex;flex-direction:column;gap:10px;margin-top:10px"></div>
    </div>
  `;

  const list = container.querySelector('#bookmarks-list');
  const clearBtn = container.querySelector('#clear-bookmarks');

  function draw() {
    const bookmarks = Storage.getBookmarks();
    clearBtn.style.display = bookmarks.length ? '' : 'none';
    if (!bookmarks.length) {
      list.innerHTML = `<div class="empty-inline">📖 No bookmarks yet. Tap the bookmark icon on any ayah while reading to save it here.</div>`;
      return;
    }
    list.innerHTML = bookmarks.map((b, i) => `
      <div class="bookmark-card" data-idx="${i}">
        <div class="bm-badge">${b.surah}</div>
        <div class="bm-body">
          <div class="bm-title">${escapeHtml(b.surahName)} — Ayah ${b.ayah}</div>
          ${b.arabicPreview ? `<div class="bm-ar">${b.arabicPreview}…</div>` : ''}
          <div class="bm-date">Saved ${formatDate(b.dateAdded)}</div>
        </div>
        <div class="bm-actions">
          <button class="icon-btn" data-act="open" title="Open" aria-label="Open ayah">${Icon.book}</button>
          <button class="icon-btn" data-act="remove" title="Remove bookmark" aria-label="Remove bookmark">${Icon.trash}</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.bookmark-card').forEach((card) => {
      const idx = parseInt(card.dataset.idx, 10);
      const b = bookmarks[idx];
      card.querySelector('[data-act="open"]').addEventListener('click', () => navigate(`/quran/${b.surah}/${b.ayah}`));
      card.querySelector('[data-act="remove"]').addEventListener('click', () => {
        Storage.removeBookmark(b.surah, b.ayah);
        toast('Bookmark removed');
        draw();
      });
    });
  }

  clearBtn.addEventListener('click', async () => {
    const ok = await confirmModal({
      title: 'Clear all bookmarks?',
      message: 'This removes every saved ayah bookmark from this device. This cannot be undone.',
      confirmLabel: 'Clear all',
    });
    if (ok) { Storage.clearBookmarks(); toast('All bookmarks cleared'); draw(); }
  });

  draw();
}
