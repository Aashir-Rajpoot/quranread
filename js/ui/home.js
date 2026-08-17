// js/ui/home.js
import { getSurahList } from '../api.js';
import { Storage } from '../storage.js';
import { Icon, escapeHtml, timeAgo, skeletonLines, stateBlock } from './common.js';
import { navigate } from '../router.js';

const POPULAR = [1, 2, 18, 36, 55, 67, 112];

export async function renderHome(container) {
  const settings = Storage.getSettings();
  const lastRead = Storage.getLastRead();
  const bookmarks = Storage.getBookmarks();
  const recent = Storage.getRecent();

  container.innerHTML = `
    <section class="hero">
      <div class="hero-inner">
        <div class="eyebrow">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
        <h1>A quiet place to read the Qur'an</h1>
        <p class="lead">Read peacefully, listen to trusted recitations, and always return to exactly where you stopped.</p>
        <div class="hero-ctas">
          <button class="btn btn-gold" id="cta-read">${Icon.book} Read Qur'an</button>
          <a class="btn btn-outline" href="#/bookmarks" style="color:#F3ECD9;border-color:rgba(243,236,217,.5)">${Icon.bookmark} My Bookmarks</a>
        </div>
      </div>
    </section>

    ${lastRead ? `
    <div class="continue-card">
      <div class="cc-icon">${Icon.book}</div>
      <div class="cc-body">
        <div class="cc-label">Continue reading</div>
        <div class="cc-title">${escapeHtml(lastRead.surahName)} — Ayah ${lastRead.ayah}</div>
      </div>
      <div class="cc-actions">
        <button class="btn btn-primary btn-sm" id="cta-continue">Continue Reading</button>
        <button class="btn btn-ghost btn-sm" id="cta-restart">Start from Beginning</button>
      </div>
    </div>` : ''}

    ${!settings.hasSeenWelcome ? `
    <div class="first-visit-banner" id="welcome-banner">
      <div style="font-size:20px">🌙</div>
      <div>
        <strong>Welcome to your Qur'an reading space.</strong><br/>
        Read peacefully — your progress is saved automatically on this device.
      </div>
      <button class="dismiss" aria-label="Dismiss">${Icon.x}</button>
    </div>` : ''}

    <div class="container">
      <section class="home-section">
        <div class="section-head"><h2>Quick access</h2></div>
        <div class="chip-row" id="popular-chips"></div>
      </section>

      <section class="home-section" id="recent-section" style="display:none">
        <div class="section-head">
          <h2>Recently read</h2>
          <a class="see-all" href="#/quran">Browse all surahs →</a>
        </div>
        <div class="mini-list" id="recent-list"></div>
      </section>

      <section class="home-section" id="bookmarks-section" style="display:none">
        <div class="section-head">
          <h2>Bookmarks</h2>
          <a class="see-all" href="#/bookmarks">See all →</a>
        </div>
        <div class="mini-list" id="bookmarks-preview"></div>
      </section>

      <section class="home-section">
        <div class="section-head">
          <h2>Surahs</h2>
          <a class="see-all" href="#/quran">Full index →</a>
        </div>
        <div id="surah-preview"></div>
      </section>
    </div>
  `;

  container.querySelector('#cta-read')?.addEventListener('click', () => navigate('/quran'));
  container.querySelector('#cta-continue')?.addEventListener('click', () => navigate(`/quran/${lastRead.surah}/${lastRead.ayah}`));
  container.querySelector('#cta-restart')?.addEventListener('click', () => navigate(`/quran/${lastRead.surah}/1`));

  const banner = container.querySelector('#welcome-banner');
  banner?.querySelector('.dismiss').addEventListener('click', () => {
    Storage.updateSettings({ hasSeenWelcome: true });
    banner.remove();
  });

  // Recently read
  if (recent.length) {
    const sec = container.querySelector('#recent-section');
    sec.style.display = '';
    const list = sec.querySelector('#recent-list');
    list.innerHTML = recent.slice(0, 5).map((r) => `
      <a class="mini-row" href="#/quran/${r.surah}/${r.ayah}">
        <span class="mr-badge">${Icon.clock}</span>
        <span class="mr-body">
          <span class="mr-title">${escapeHtml(r.surahName)} — Ayah ${r.ayah}</span>
        </span>
        <span class="mr-date">${timeAgo(r.timestamp)}</span>
      </a>
    `).join('');
  }

  // Bookmarks preview
  if (bookmarks.length) {
    const sec = container.querySelector('#bookmarks-section');
    sec.style.display = '';
    const list = sec.querySelector('#bookmarks-preview');
    list.innerHTML = bookmarks.slice(0, 4).map((b) => `
      <a class="mini-row" href="#/quran/${b.surah}/${b.ayah}">
        <span class="mr-badge">${Icon.bookmarkFilled}</span>
        <span class="mr-body">
          <span class="mr-title">${escapeHtml(b.surahName)} — Ayah ${b.ayah}</span>
          <span class="mr-sub">${escapeHtml(b.arabicPreview || '')}</span>
        </span>
      </a>
    `).join('');
  }

  // Popular chips + surah preview (needs API)
  const chipRow = container.querySelector('#popular-chips');
  const surahPreview = container.querySelector('#surah-preview');
  chipRow.appendChild(skeletonChips());
  surahPreview.appendChild(skeletonLines(6));

  try {
    const surahs = await getSurahList();
    chipRow.innerHTML = POPULAR.map((n) => {
      const s = surahs.find((x) => x.number === n);
      if (!s) return '';
      return `<a class="chip" href="#/quran/${n}/1">${escapeHtml(s.englishName)}</a>`;
    }).join('');

    surahPreview.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'surah-grid';
    grid.innerHTML = surahs.slice(0, 8).map(surahCardHtml).join('');
    surahPreview.appendChild(grid);
  } catch (err) {
    chipRow.innerHTML = '';
    surahPreview.innerHTML = '';
    surahPreview.appendChild(stateBlock({
      glyph: '📡',
      title: 'Unable to load surahs',
      message: err.offline ? "You're offline — connect to the internet to browse the Qur'an." : 'Please check your connection and try again.',
      retry: () => renderHome(container),
    }));
  }
}

function skeletonChips() {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '8px';
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('div');
    c.className = 'skel';
    c.style.width = '80px';
    c.style.height = '34px';
    c.style.borderRadius = '999px';
    wrap.appendChild(c);
  }
  return wrap;
}

export function surahCardHtml(s) {
  return `
    <a class="surah-card" href="#/quran/${s.number}/1">
      <span class="surah-num">${s.number}</span>
      <span class="sc-body">
        <span class="sc-en">${escapeHtml(s.englishName)}</span>
        <span class="sc-meta">${escapeHtml(s.englishNameTranslation)} · ${s.numberOfAyahs} ayahs · ${s.revelationType}</span>
      </span>
      <span class="sc-ar">${s.name}</span>
    </a>
  `;
}
