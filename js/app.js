// js/app.js — bootstraps the single-page app.
import { Storage } from './storage.js';
import { route, notFound, startRouter, navigate } from './router.js';
import { Icon } from './ui/common.js';
import { mountPlayerBar } from './ui/playerBar.js';
import { renderHome } from './ui/home.js';
import { renderSurahIndex } from './ui/surahIndex.js';
import { renderReader } from './ui/reader.js';
import { renderBookmarks } from './ui/bookmarks.js';
import { renderSearch } from './ui/search.js';
import { renderSettings } from './ui/settings.js';

const outlet = document.getElementById('page-outlet');

// ---------- theme ----------
document.documentElement.setAttribute('data-theme', Storage.getTheme());

// ---------- header / mobile nav ----------
function buildChrome() {
  document.getElementById('header-mount').innerHTML = `
    <header class="site-header">
      <div class="container">
        <a class="brand" href="#/">
          <span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#F3ECD9" stroke-width="1.8"><path d="M12 4c4 2.6 5.6 5.6 5.6 9A5.6 5.6 0 0 1 6.4 13c0-3.4 1.6-6.4 5.6-9Z"/></svg></span>
          QuranRead
        </a>
        <nav class="main-nav" aria-label="Primary">
          <a href="#/" data-path="/">${Icon.home} Home</a>
          <a href="#/quran" data-path="/quran">${Icon.book} Qur'an</a>
          <a href="#/bookmarks" data-path="/bookmarks">${Icon.bookmark} Bookmarks</a>
          <a href="#/search" data-path="/search">${Icon.search} Search</a>
        </nav>
        <div class="header-actions">
          <a class="icon-btn" href="#/search" aria-label="Search">${Icon.search}</a>
          <a class="icon-btn" href="#/settings" aria-label="Settings">${Icon.settings}</a>
        </div>
      </div>
    </header>
    <div class="offline-banner" id="offline-banner">You're offline. Reading resumes automatically once you're back online.</div>
  `;

  document.getElementById('footer-mount').innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-col">
            <h4>QuranRead</h4>
            <ul>
              <li><a href="#/">Home</a></li>
              <li><a href="#/quran">Read Qur'an</a></li>
              <li><a href="#/bookmarks">Bookmarks</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>About</h4>
            <ul>
              <li>A peaceful, distraction-free space for daily Qur'an reading.</li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Privacy</h4>
            <ul>
              <li>All reading data stays on your device — no account, no tracking.</li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Sources &amp; credits</h4>
            <ul>
              <li>Qur'an text &amp; translations: AlQuran Cloud API</li>
              <li>Recitation audio: AlQuran Cloud / EveryAyah</li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">QuranRead is an independent reading tool and is not affiliated with any Qur'an publisher.</div>
      </div>
    </footer>
  `;

  document.getElementById('mobilenav-mount').innerHTML = `
    <nav class="mobile-bottom-nav" aria-label="Primary">
      <a href="#/" data-path="/">${Icon.home}<span>Home</span></a>
      <a href="#/quran" data-path="/quran">${Icon.book}<span>Qur'an</span></a>
      <a href="#/bookmarks" data-path="/bookmarks">${Icon.bookmark}<span>Saved</span></a>
      <a href="#/search" data-path="/search">${Icon.search}<span>Search</span></a>
      <a href="#/settings" data-path="/settings">${Icon.settings}<span>Settings</span></a>
    </nav>
  `;

  mountPlayerBar(document.getElementById('player-mount'));
}

function setActiveNav(path) {
  const top = path === '/' ? '/' : '/' + path.split('/')[1];
  document.querySelectorAll('[data-path]').forEach((a) => {
    a.classList.toggle('active', a.dataset.path === top);
  });
}

function updateOfflineBanner() {
  document.getElementById('offline-banner')?.classList.toggle('show', !navigator.onLine);
}
window.addEventListener('online', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);

// ---------- routes ----------
function setup() {
  buildChrome();
  updateOfflineBanner();

  route('/', async () => { setActiveNav('/'); document.title = 'QuranRead — Read, Listen, Reflect'; await renderHome(outlet); });
  route('/quran', async () => { setActiveNav('/quran'); document.title = "Surahs — QuranRead"; await renderSurahIndex(outlet); });
  route('/quran/:surah', async ({ surah }) => { setActiveNav('/quran'); await renderReader(outlet, { surah, ayah: 1 }); });
  route('/quran/:surah/:ayah', async ({ surah, ayah }) => { setActiveNav('/quran'); await renderReader(outlet, { surah, ayah }); });
  route('/bookmarks', async () => { setActiveNav('/bookmarks'); document.title = 'Bookmarks — QuranRead'; renderBookmarks(outlet); });
  route('/search', async () => { setActiveNav('/search'); document.title = 'Search — QuranRead'; renderSearch(outlet); });
  route('/settings', async () => { setActiveNav('/settings'); document.title = 'Settings — QuranRead'; renderSettings(outlet); });

  notFound(() => {
    outlet.innerHTML = `
      <div class="container">
        <div class="state-block">
          <div class="glyph">🕌</div>
          <h3>Page not found</h3>
          <p>That page doesn't exist. Let's get you back to reading.</p>
          <button class="retry-btn" id="go-home">Go home</button>
        </div>
      </div>`;
    outlet.querySelector('#go-home').addEventListener('click', () => navigate('/'));
  });

  window.addEventListener('hashchange', () => {
    document.querySelectorAll('.popover, .ayah-toolbar').forEach((el) => el.remove());
    document.body.classList.remove('focus-mode');
    window.scrollTo({ top: 0, behavior: 'instant' in window.scrollTo ? 'instant' : 'auto' });
  });

  startRouter();
}

setup();

// Register the app-shell service worker (offline support). Safe to skip
// silently in environments without SW support (e.g. very old browsers) or
// when the file is opened as file:// without a static server.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
