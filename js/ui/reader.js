// js/ui/reader.js — the heart of the app.
import { getSurah, TRANSLATIONS } from '../api.js';
import { Storage } from '../storage.js';
import { player } from '../audio.js';
import { Icon, escapeHtml, toast, stateBlock, skeletonLines } from './common.js';
import { navigate } from '../router.js';
import { openAudioPlayerFor } from './playerBar.js';

const THEMES = [
  { id: 'classic', label: 'C' },
  { id: 'paper', label: 'P' },
  { id: 'dark', label: 'D' },
  { id: 'sakina-green', label: 'G' },
  { id: 'modern', label: 'M' },
];
const THEME_NAMES = { classic: 'Classic', paper: 'Paper', dark: 'Dark', 'sakina-green': 'Green', modern: 'Modern' };

let currentSurah = null;   // loaded surah data
let activeAyahEl = null;
let saveScrollTimer = null;
let observer = null;
let readerContainerRef = null; // the page container currently rendering the reader

export async function renderReader(container, { surah, ayah }) {
  const surahNum = Math.max(1, Math.min(114, parseInt(surah, 10) || 1));
  const settings = Storage.getSettings();
  applyReaderStyleVars(settings);
  readerContainerRef = container;

  container.innerHTML = `
    <div class="reader-shell">
      <div class="reader-topbar">
        <div class="rt-title">
          <span class="rt-ar" id="rt-ar"></span>
          <span class="rt-en" id="rt-en"></span>
        </div>
        <div class="rt-progress" id="rt-progress"></div>
        <div class="rt-controls">
          <button class="icon-btn" id="btn-font" aria-label="Reading display settings" aria-haspopup="true">${Icon.type}</button>
          <button class="icon-btn" id="btn-theme" aria-label="Reading theme" aria-haspopup="true">🎨</button>
          <button class="icon-btn" id="btn-focus" aria-label="Distraction-free mode">${Icon.expand}</button>
        </div>
      </div>
      <div class="progress-bar-track"><div class="progress-bar-fill" id="progress-fill" style="width:0%"></div></div>
      <div class="reader-body" id="reader-body">
        <div class="spinner" style="margin:60px auto"></div>
      </div>
    </div>
  `;

  wireTopbarControls(container);

  const body = container.querySelector('#reader-body');
  const audioSettings = Storage.getAudioSettings();

  async function load() {
    body.innerHTML = '';
    body.appendChild(skeletonLines(8));
    try {
      const [data] = await Promise.all([
        getSurah(surahNum, settings.translationId, audioSettings.qari),
      ]);
      currentSurah = data;
      renderSurahBody(container, data, ayah);
      updateTopbarMeta(container, data);
      Storage.pushRecent({ surah: data.number, surahName: data.englishName, ayah: parseInt(ayah, 10) || 1 });
    } catch (err) {
      body.innerHTML = '';
      body.appendChild(stateBlock({
        glyph: err.offline ? '📡' : '⚠️',
        title: err.offline ? "You're offline" : 'Unable to load this surah',
        message: err.offline ? 'Reconnect to continue reading — your saved position and bookmarks are still safe.' : 'The Quran data source could not be reached. Please try again.',
        retry: load,
      }));
    }
  }

  await load();
}

function applyReaderStyleVars(settings) {
  document.documentElement.style.setProperty('--arabic-size', settings.arabicSize + 'px');
  document.documentElement.style.setProperty('--arabic-line', settings.lineHeight);
  document.documentElement.style.setProperty('--translation-size', settings.translationSize + 'px');
  const widthMap = { narrow: '580px', comfortable: '720px', wide: '900px' };
  document.documentElement.style.setProperty('--reader-width', widthMap[settings.readerWidth] || '720px');
}

function updateTopbarMeta(container, data) {
  container.querySelector('#rt-ar').textContent = data.name;
  container.querySelector('#rt-en').textContent = `${data.englishName} · ${data.englishNameTranslation}`;
  document.title = `${data.englishName} — QuranRead`;
}

function updateProgress(container, data, numberInSurah) {
  const pct = Math.round((numberInSurah / data.ayahCount) * 100);
  const fill = container.querySelector('#progress-fill');
  if (fill) fill.style.width = pct + '%';
  const label = container.querySelector('#rt-progress');
  if (label) label.textContent = `Ayah ${numberInSurah} / ${data.ayahCount} · ${pct}%`;
  return pct;
}

function renderSurahBody(container, data, initialAyah) {
  const body = container.querySelector('#reader-body');
  const settings = Storage.getSettings();
  const bookmarks = Storage.getBookmarks();
  const bookmarkedSet = new Set(bookmarks.filter((b) => b.surah === data.number).map((b) => b.ayah));

  const showBismillah = data.number !== 9 && data.number !== 1;

  const flowHtml = data.ayahs.map((a) => {
    const isBookmarked = bookmarkedSet.has(a.numberInSurah);
    return `<span class="ayah${isBookmarked ? ' is-bookmarked' : ''}" data-ayah="${a.numberInSurah}" data-global="${a.number}" tabindex="0" role="button" aria-label="Ayah ${a.numberInSurah}">${wrapWords(a.text)}<span class="ayah-badge">${toArabicNumeral(a.numberInSurah)}</span></span>${settings.translationOn ? translationBlockHtml(a) : ''} `;
  }).join('');

  body.innerHTML = `
    ${showBismillah ? `<div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>` : ''}
    <div class="surah-intro">
      <div class="si-ar">${data.name}</div>
      <div class="si-meta">${escapeHtml(data.englishName)} · ${escapeHtml(data.revelationType)} · ${data.ayahCount} Ayahs</div>
    </div>
    <div class="ayah-flow" id="ayah-flow">${flowHtml}</div>
    <div class="reader-surah-nav">
      ${data.number > 1 ? `<a class="rsn-btn prev" href="#/quran/${data.number - 1}/1"><span class="rsn-label">${Icon.chevronLeft} Previous</span><span class="rsn-name">Surah ${data.number - 1}</span></a>` : '<span></span>'}
      ${data.number < 114 ? `<a class="rsn-btn next" href="#/quran/${data.number + 1}/1"><span class="rsn-name">Surah ${data.number + 1}</span><span class="rsn-label">Next ${Icon.chevronRight}</span></a>` : '<span></span>'}
    </div>
  `;

  wireAyahInteractions(container, data);
  setupScrollTracking(container, data);

  // Deep link: scroll to the requested ayah and select it
  const targetNum = parseInt(initialAyah, 10) || 1;
  requestAnimationFrame(() => {
    const el = body.querySelector(`.ayah[data-ayah="${targetNum}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      selectAyah(container, el, data);
    }
    updateProgress(container, data, targetNum);
  });
}

function translationBlockHtml(a) {
  return `<span class="ayah-translation"><span class="tr-num">${a.numberInSurah}.</span>${escapeHtml(a.translation || '')}</span>`;
}

function wrapWords(arabicText) {
  // Word-by-word display: each word gets its own span so highlighting *can*
  // target individual words. Reliable word-level timing data is not available
  // from the current audio source, so playback highlighting gracefully falls
  // back to whole-ayah highlighting (see toggleWordSync below) rather than
  // faking a synchronization that isn't real.
  return arabicText.split(' ').map((w) => `<span class="word">${w}</span>`).join(' ') + ' ';
}

function toArabicNumeral(n) {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n).split('').map((d) => digits[+d] ?? d).join('');
}

// ---------------- interactions ----------------

function wireAyahInteractions(container, data) {
  const flow = container.querySelector('#ayah-flow');
  flow.addEventListener('click', (e) => {
    const ayahEl = e.target.closest('.ayah');
    if (!ayahEl) return;
    selectAyah(container, ayahEl, data);
  });
  flow.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('ayah')) {
      e.preventDefault();
      selectAyah(container, e.target, data);
    }
  });
}

function selectAyah(container, ayahEl, data) {
  container.querySelectorAll('.ayah.is-selected').forEach((el) => el.classList.remove('is-selected'));
  ayahEl.classList.add('is-selected');
  showAyahToolbar(container, ayahEl, data);
}

function showAyahToolbar(container, ayahEl, data) {
  document.querySelector('.ayah-toolbar')?.remove();
  const numberInSurah = parseInt(ayahEl.dataset.ayah, 10);
  const ayah = data.ayahs.find((a) => a.numberInSurah === numberInSurah);
  const isBookmarked = Storage.isBookmarked(data.number, numberInSurah);

  const bar = document.createElement('div');
  bar.className = 'ayah-toolbar';
  bar.innerHTML = `
    <button data-act="play" aria-label="Play this ayah" title="Play">${Icon.play}</button>
    <button data-act="bookmark" aria-label="Bookmark this ayah" title="Bookmark" class="${isBookmarked ? 'active' : ''}">${isBookmarked ? Icon.bookmarkFilled : Icon.bookmark}</button>
    <button data-act="copy" aria-label="Copy ayah text" title="Copy">${Icon.copy}</button>
    <button data-act="share" aria-label="Share ayah" title="Share">${Icon.share}</button>
    <button data-act="close" aria-label="Close toolbar" title="Close">${Icon.x}</button>
  `;
  document.body.appendChild(bar);
  positionToolbar(bar, ayahEl);

  bar.querySelector('[data-act="play"]').addEventListener('click', () => playFromAyah(container, data, numberInSurah));
  bar.querySelector('[data-act="bookmark"]').addEventListener('click', () => {
    const list = Storage.toggleBookmark({
      surah: data.number, surahName: data.englishName, ayah: numberInSurah,
      arabicPreview: ayah.text.slice(0, 60),
    });
    const nowBookmarked = list.some((b) => b.surah === data.number && b.ayah === numberInSurah);
    ayahEl.classList.toggle('is-bookmarked', nowBookmarked);
    toast(nowBookmarked ? 'Ayah bookmarked' : 'Bookmark removed');
    showAyahToolbar(container, ayahEl, data);
  });
  bar.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    const text = `${ayah.text}\n\n— ${data.englishName}, Ayah ${numberInSurah}`;
    try {
      await navigator.clipboard.writeText(text);
      toast('Ayah copied');
    } catch {
      toast('Could not copy — try selecting the text manually.');
    }
  });
  bar.querySelector('[data-act="share"]').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#/quran/${data.number}/${numberInSurah}`;
    const shareData = { title: `${data.englishName} — Ayah ${numberInSurah}`, text: ayah.text, url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast('Link copied to clipboard');
      } catch {
        toast(url);
      }
    }
  });
  bar.querySelector('[data-act="close"]').addEventListener('click', () => {
    bar.remove();
    ayahEl.classList.remove('is-selected');
  });
}

function positionToolbar(bar, ayahEl) {
  if (window.innerWidth <= 640) return; // CSS fixes it to the bottom on mobile
  const rect = ayahEl.getBoundingClientRect();
  const top = window.scrollY + rect.top - 52;
  let left = window.scrollX + rect.left + rect.width / 2 - 100;
  left = Math.max(12, Math.min(left, window.innerWidth - 212));
  bar.style.top = `${top}px`;
  bar.style.left = `${left}px`;
}

function playFromAyah(container, data, numberInSurah) {
  const startIndex = data.ayahs.findIndex((a) => a.numberInSurah === numberInSurah);
  const queue = data.ayahs.map((a) => ({ ...a, surah: data.number, surahName: data.englishName, surahAyahCount: data.ayahCount }));
  player.playQueue(queue, startIndex);
  openAudioPlayerFor(data);
}

// ---------------- scroll tracking → last read + progress + audio highlight ----------------

let pendingLastRead = null; // most recent {surah, surahName, ayah, progressPct} not yet flushed

function setupScrollTracking(container, data) {
  observer?.disconnect();
  const flow = container.querySelector('#ayah-flow');
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (!visible.length) return;
    const el = visible[0].target;
    const numberInSurah = parseInt(el.dataset.ayah, 10);
    const pct = updateProgress(container, data, numberInSurah);
    pendingLastRead = { surah: data.number, surahName: data.englishName, ayah: numberInSurah, progressPct: pct };
    clearTimeout(saveScrollTimer);
    saveScrollTimer = setTimeout(() => {
      if (pendingLastRead) Storage.setLastRead(pendingLastRead);
    }, 600); // debounce writes while actively scrolling
  }, { root: null, threshold: [0.4, 0.6], rootMargin: '-120px 0px -50% 0px' });

  flow.querySelectorAll('.ayah').forEach((el) => observer.observe(el));
}

// Flush the most recent scroll position immediately before the tab/window closes,
// so a fast close right after scrolling never loses the position.
window.addEventListener('beforeunload', () => {
  if (pendingLastRead) Storage.setLastRead(pendingLastRead);
});
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pendingLastRead) Storage.setLastRead(pendingLastRead);
});

// ---------------- player <-> reader sync (highlighting + auto-scroll) ----------------

player.addEventListener('trackchange', () => {
  const cur = player.current();
  if (!cur) return;
  document.querySelectorAll('.ayah.is-playing').forEach((el) => el.classList.remove('is-playing'));
  const el = document.querySelector(`.ayah[data-ayah="${cur.numberInSurah}"]`);
  if (el) {
    el.classList.add('is-playing');
    activeAyahEl = el;
    const rect = el.getBoundingClientRect();
    const inView = rect.top > 140 && rect.bottom < window.innerHeight - 100;
    if (!inView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
});
player.addEventListener('stopped', () => {
  document.querySelectorAll('.ayah.is-playing').forEach((el) => el.classList.remove('is-playing'));
});

// ---------------- topbar: font popover, theme popover, focus mode ----------------

function wireTopbarControls(container) {
  container.querySelector('#btn-font').addEventListener('click', (e) => toggleFontPopover(e.currentTarget, container));
  container.querySelector('#btn-theme').addEventListener('click', (e) => toggleThemePopover(e.currentTarget, container));
  container.querySelector('#btn-focus').addEventListener('click', () => toggleFocusMode(container));
  document.addEventListener('click', closePopoversOnOutsideClick);
}

function closePopoversOnOutsideClick(e) {
  if (e.target.closest('.popover') || e.target.closest('#btn-font') || e.target.closest('#btn-theme')) return;
  document.querySelectorAll('.popover').forEach((p) => p.remove());
}

function toggleFontPopover(anchor) {
  const existing = document.querySelector('.popover[data-kind="font"]');
  if (existing) { existing.remove(); return; }
  document.querySelectorAll('.popover').forEach((p) => p.remove());
  const settings = Storage.getSettings();
  const pop = document.createElement('div');
  pop.className = 'popover';
  pop.dataset.kind = 'font';
  pop.innerHTML = `
    <div class="popover-row">
      <label>Arabic font size</label>
      <div class="stepper">
        <button data-act="dec-size" aria-label="Decrease font size">−</button>
        <span id="size-val">${settings.arabicSize}</span>
        <button data-act="inc-size" aria-label="Increase font size">+</button>
      </div>
    </div>
    <div class="popover-row" style="flex-direction:column;align-items:stretch;gap:6px">
      <label>Line height</label>
      <div class="range-row"><input type="range" min="1.6" max="3.2" step="0.05" value="${settings.lineHeight}" id="line-height-range" /></div>
    </div>
    <div class="popover-row" style="flex-direction:column;align-items:stretch;gap:6px">
      <label>Reader width</label>
      <div class="reader-width-select">
        <button data-width="narrow" class="${settings.readerWidth === 'narrow' ? 'active' : ''}">Narrow</button>
        <button data-width="comfortable" class="${settings.readerWidth === 'comfortable' ? 'active' : ''}">Comfortable</button>
        <button data-width="wide" class="${settings.readerWidth === 'wide' ? 'active' : ''}">Wide</button>
      </div>
    </div>
    <div class="popover-row">
      <label>Translation</label>
      <button class="switch ${settings.translationOn ? 'on' : ''}" id="translation-switch" aria-label="Toggle translation"></button>
    </div>
    <div class="popover-row" style="flex-direction:column;align-items:stretch;gap:6px">
      <label>Translation size</label>
      <div class="range-row"><input type="range" min="12" max="22" step="1" value="${settings.translationSize}" id="translation-size-range" /></div>
    </div>
    <div class="popover-row" style="flex-direction:column;align-items:stretch;gap:6px">
      <label>Translation edition</label>
      <select id="translation-select" style="width:100%;padding:7px;border-radius:8px;border:1px solid var(--paper-line)">
        ${TRANSLATIONS.map((t) => `<option value="${t.id}" ${t.id === settings.translationId ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
      </select>
    </div>
  `;
  anchor.parentElement.style.position = 'relative';
  anchor.parentElement.appendChild(pop);

  const applyAndRerender = (patch) => {
    const s = Storage.updateSettings(patch);
    applyReaderStyleVars(s);
  };

  pop.querySelector('[data-act="inc-size"]').addEventListener('click', () => {
    const s = Storage.updateSettings({ arabicSize: Math.min(52, Storage.getSettings().arabicSize + 2) });
    applyReaderStyleVars(s);
    pop.querySelector('#size-val').textContent = s.arabicSize;
  });
  pop.querySelector('[data-act="dec-size"]').addEventListener('click', () => {
    const s = Storage.updateSettings({ arabicSize: Math.max(18, Storage.getSettings().arabicSize - 2) });
    applyReaderStyleVars(s);
    pop.querySelector('#size-val').textContent = s.arabicSize;
  });
  pop.querySelector('#line-height-range').addEventListener('input', (e) => applyAndRerender({ lineHeight: parseFloat(e.target.value) }));
  pop.querySelector('#translation-size-range').addEventListener('input', (e) => applyAndRerender({ translationSize: parseInt(e.target.value, 10) }));
  pop.querySelectorAll('[data-width]').forEach((btn) => btn.addEventListener('click', () => {
    applyAndRerender({ readerWidth: btn.dataset.width });
    pop.querySelectorAll('[data-width]').forEach((b) => b.classList.toggle('active', b === btn));
  }));
  pop.querySelector('#translation-switch').addEventListener('click', (e) => {
    const s = Storage.updateSettings({ translationOn: !Storage.getSettings().translationOn });
    e.currentTarget.classList.toggle('on', s.translationOn);
    if (currentSurah && readerContainerRef) {
      const anchor = document.querySelector(`.ayah.is-playing, .ayah.is-selected`);
      const keepAyah = anchor ? parseInt(anchor.dataset.ayah, 10) : 1;
      renderSurahBody(readerContainerRef, currentSurah, keepAyah);
    }
  });
  pop.querySelector('#translation-select').addEventListener('change', async (e) => {
    Storage.updateSettings({ translationId: e.target.value });
    toast('Translation updated');
    if (currentSurah && readerContainerRef) {
      const anchor = document.querySelector('.ayah.is-playing, .ayah.is-selected');
      const keepAyah = anchor ? parseInt(anchor.dataset.ayah, 10) : 1;
      navigate(`/quran/${currentSurah.number}/${keepAyah}`);
    }
  });
}

function toggleThemePopover(anchor) {
  const existing = document.querySelector('.popover[data-kind="theme"]');
  if (existing) { existing.remove(); return; }
  document.querySelectorAll('.popover').forEach((p) => p.remove());
  const current = Storage.getTheme();
  const pop = document.createElement('div');
  pop.className = 'popover';
  pop.dataset.kind = 'theme';
  pop.innerHTML = `
    <div class="popover-row" style="flex-direction:column;align-items:stretch;gap:10px">
      <label>Reading theme</label>
      <div class="theme-swatches">
        ${THEMES.map((t) => `<button class="theme-swatch ${t.id === current ? 'active' : ''}" data-theme-choice="${t.id}" title="${THEME_NAMES[t.id]}" style="${themeSwatchStyle(t.id)}">${t.label}</button>`).join('')}
      </div>
    </div>
  `;
  anchor.parentElement.style.position = 'relative';
  anchor.parentElement.appendChild(pop);
  pop.querySelectorAll('[data-theme-choice]').forEach((btn) => btn.addEventListener('click', () => {
    const theme = btn.dataset.themeChoice;
    document.documentElement.setAttribute('data-theme', theme);
    Storage.setTheme(theme);
    pop.querySelectorAll('.theme-swatch').forEach((b) => b.classList.toggle('active', b === btn));
  }));
}

function themeSwatchStyle(id) {
  const map = {
    classic: 'background:#FBF6EA;color:#1C1408;border-color:#E7DAB6',
    paper: 'background:#F4EFE4;color:#28241C;border-color:#E1D8C2',
    dark: 'background:#14181A;color:#F2EFE6;border-color:#2B3236',
    'sakina-green': 'background:#F1F6F0;color:#16281C;border-color:#D9E6D6',
    modern: 'background:#FFFFFF;color:#101113;border-color:#EAEAE7',
  };
  return map[id] || '';
}

function toggleFocusMode(container) {
  const on = document.body.classList.toggle('focus-mode');
  const btn = container.querySelector('#btn-focus');
  btn.innerHTML = on ? Icon.compress : Icon.expand;
  btn.setAttribute('aria-label', on ? 'Exit distraction-free mode' : 'Distraction-free mode');
  if (on) toast('Distraction-free mode — press Esc to exit');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) {
    document.body.classList.remove('focus-mode');
    const btn = document.querySelector('#btn-focus');
    if (btn) {
      btn.innerHTML = Icon.expand;
      btn.setAttribute('aria-label', 'Distraction-free mode');
    }
  }
});
