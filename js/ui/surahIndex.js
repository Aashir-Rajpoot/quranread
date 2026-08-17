// js/ui/surahIndex.js
import { getSurahList } from '../api.js';
import { skeletonLines, stateBlock, escapeHtml, debounce } from './common.js';
import { surahCardHtml } from './home.js';

export async function renderSurahIndex(container) {
  container.innerHTML = `
    <div class="container">
      <div class="page-hero">
        <h1>Every surah</h1>
        <p>114 surahs, in Uthmani Arabic script — search by name or number.</p>
      </div>
      <div class="index-toolbar">
        <div class="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.8-3.8"/></svg>
          <input type="search" id="surah-filter" placeholder="Search surah name or number…" aria-label="Search surahs" />
        </div>
        <select class="filter-select" id="revelation-filter" aria-label="Filter by revelation type">
          <option value="">All revelations</option>
          <option value="Meccan">Meccan</option>
          <option value="Medinan">Medinan</option>
        </select>
      </div>
      <div id="surah-index-results"></div>
    </div>
  `;

  const results = container.querySelector('#surah-index-results');
  results.appendChild(skeletonLines(10));

  let surahs = [];
  try {
    surahs = await getSurahList();
  } catch (err) {
    results.innerHTML = '';
    results.appendChild(stateBlock({
      glyph: '📡',
      title: 'Unable to load the surah list',
      message: err.offline ? "You're offline right now." : 'Something went wrong reaching the Quran data source.',
      retry: () => renderSurahIndex(container),
    }));
    return;
  }

  function draw() {
    const q = container.querySelector('#surah-filter').value.trim().toLowerCase();
    const rev = container.querySelector('#revelation-filter').value;
    const filtered = surahs.filter((s) => {
      const matchesQ = !q || s.englishName.toLowerCase().includes(q) || s.englishNameTranslation.toLowerCase().includes(q) || String(s.number) === q || s.name.includes(q);
      const matchesRev = !rev || s.revelationType === rev;
      return matchesQ && matchesRev;
    });
    results.innerHTML = filtered.length
      ? `<div class="surah-list-full">${filtered.map(surahCardHtml).join('')}</div>`
      : `<div class="empty-inline">No surah matches “${escapeHtml(q)}”.</div>`;
  }

  draw();
  container.querySelector('#surah-filter').addEventListener('input', debounce(draw, 120));
  container.querySelector('#revelation-filter').addEventListener('change', draw);
}
