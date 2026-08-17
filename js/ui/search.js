// js/ui/search.js
import { searchQuran, TRANSLATIONS } from '../api.js';
import { Storage } from '../storage.js';
import { Icon, highlightMatch, escapeHtml, debounce, stateBlock } from './common.js';
import { navigate } from '../router.js';

export function renderSearch(container, { q } = {}) {
  const settings = Storage.getSettings();
  container.innerHTML = `
    <div class="container">
      <div class="page-hero">
        <h1>Search the Qur'an</h1>
        <p>Search by surah name, ayah number, Arabic text, or translation.</p>
      </div>
      <div class="index-toolbar">
        <div class="search-input-wrap">
          ${Icon.search}
          <input type="search" id="search-input" placeholder="Search e.g. “patience”, “2:255”, or “Al-Kahf”…" value="${escapeHtml(q || '')}" autofocus />
        </div>
        <select class="filter-select" id="search-translation">
          ${TRANSLATIONS.map((t) => `<option value="${t.id}" ${t.id === settings.translationId ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
        </select>
      </div>
      <div id="search-results"></div>
    </div>
  `;

  const input = container.querySelector('#search-input');
  const translationSelect = container.querySelector('#search-translation');
  const results = container.querySelector('#search-results');

  async function runSearch() {
    const query = input.value.trim();
    if (!query) {
      results.innerHTML = `<div class="empty-inline">Start typing to search across all 114 surahs.</div>`;
      return;
    }
    if (query.length < 2) {
      results.innerHTML = `<div class="empty-inline">Keep typing — at least 2 characters.</div>`;
      return;
    }
    results.innerHTML = `<div class="spinner" style="margin:40px auto"></div>`;

    // Support direct surah:ayah lookups like "2:255"
    const directMatch = query.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
    if (directMatch) {
      navigate(`/quran/${directMatch[1]}/${directMatch[2]}`);
      return;
    }

    try {
      const matches = await searchQuran(query, translationSelect.value);
      if (!matches.length) {
        results.innerHTML = '';
        results.appendChild(stateBlock({ glyph: '🔍', title: 'No results', message: `Nothing found for "${query}". Try a different word or phrase.` }));
        return;
      }
      results.innerHTML = matches.slice(0, 60).map((m) => `
        <a class="search-result" href="#/quran/${m.surah.number}/${m.numberInSurah}">
          <div class="sr-meta">
            <div class="sr-surah">${escapeHtml(m.surah.englishName)}</div>
            <div class="sr-ayah">Ayah ${m.numberInSurah}</div>
          </div>
          <div class="sr-text">
            ${m.arabicText ? `<div class="sr-ar">${m.arabicText}</div>` : ''}
            ${m.translationText ? `<div class="sr-tr">${highlightMatch(m.translationText, query)}</div>` : ''}
          </div>
        </a>
      `).join('');
    } catch (err) {
      results.innerHTML = '';
      results.appendChild(stateBlock({
        glyph: err.offline ? '📡' : '⚠️',
        title: 'Search unavailable',
        message: err.offline ? "You're offline — search needs a connection." : 'Something went wrong running that search.',
        retry: runSearch,
      }));
    }
  }

  input.addEventListener('input', debounce(runSearch, 350));
  translationSelect.addEventListener('change', runSearch);
  if (q) runSearch(); else results.innerHTML = `<div class="empty-inline">Start typing to search across all 114 surahs.</div>`;
}
