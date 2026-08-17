// js/storage.js
// A small, explicit browser-storage structure. Everything here survives
// refresh, tab close, and browser restart — no login required.
//
//   quran_last_read      -> { surah, surahName, ayah, timestamp, progressPct }
//   quran_bookmarks      -> [{ surah, surahName, ayah, arabicPreview, dateAdded }]
//   quran_recent         -> [{ surah, surahName, ayah, timestamp }]  (max 10)
//   quran_settings       -> { arabicSize, lineHeight, readerWidth, translationOn,
//                              translationSize, translationId, hasSeenWelcome }
//   quran_theme          -> "classic" | "paper" | "dark" | "sakina-green" | "modern"
//   quran_audio_settings -> { qari, speed, autoNext, repeatMode }

const KEYS = {
  lastRead: 'quran_last_read',
  bookmarks: 'quran_bookmarks',
  recent: 'quran_recent',
  settings: 'quran_settings',
  theme: 'quran_theme',
  audio: 'quran_audio_settings',
};

const DEFAULT_SETTINGS = {
  arabicSize: 30,
  lineHeight: 2.35,
  readerWidth: 'comfortable', // narrow | comfortable | wide
  translationOn: true,
  translationSize: 16,
  translationId: 'en.sahih',
  hasSeenWelcome: false,
};

const DEFAULT_AUDIO_SETTINGS = {
  qari: 'ar.alafasy',
  speed: 1,
  autoNext: true,
  repeatMode: 'off', // off | ayah | surah
};

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch {
    // corrupted entry — don't crash the app, just fall back
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded / storage disabled — non-fatal
  }
}

export const Storage = {
  // ---------- last read / resume ----------
  getLastRead() {
    return safeGet(KEYS.lastRead, null);
  },
  setLastRead({ surah, surahName, ayah, progressPct }) {
    safeSet(KEYS.lastRead, {
      surah, surahName, ayah, progressPct: progressPct ?? 0,
      timestamp: Date.now(),
    });
  },

  // ---------- bookmarks ----------
  getBookmarks() {
    return safeGet(KEYS.bookmarks, []);
  },
  isBookmarked(surah, ayah) {
    return this.getBookmarks().some((b) => b.surah === surah && b.ayah === ayah);
  },
  addBookmark({ surah, surahName, ayah, arabicPreview }) {
    const list = this.getBookmarks();
    if (list.some((b) => b.surah === surah && b.ayah === ayah)) return list;
    list.unshift({ surah, surahName, ayah, arabicPreview, dateAdded: Date.now() });
    safeSet(KEYS.bookmarks, list);
    return list;
  },
  removeBookmark(surah, ayah) {
    const list = this.getBookmarks().filter((b) => !(b.surah === surah && b.ayah === ayah));
    safeSet(KEYS.bookmarks, list);
    return list;
  },
  toggleBookmark(entry) {
    return this.isBookmarked(entry.surah, entry.ayah)
      ? this.removeBookmark(entry.surah, entry.ayah)
      : this.addBookmark(entry);
  },
  clearBookmarks() {
    safeSet(KEYS.bookmarks, []);
  },

  // ---------- recently read ----------
  getRecent() {
    return safeGet(KEYS.recent, []);
  },
  pushRecent({ surah, surahName, ayah }) {
    let list = this.getRecent().filter((r) => r.surah !== surah);
    list.unshift({ surah, surahName, ayah, timestamp: Date.now() });
    list = list.slice(0, 10);
    safeSet(KEYS.recent, list);
    return list;
  },
  clearRecent() {
    safeSet(KEYS.recent, []);
  },

  // ---------- reading settings ----------
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...safeGet(KEYS.settings, {}) };
  },
  updateSettings(patch) {
    const merged = { ...this.getSettings(), ...patch };
    safeSet(KEYS.settings, merged);
    return merged;
  },

  // ---------- theme ----------
  getTheme() {
    return safeGet(KEYS.theme, 'classic');
  },
  setTheme(theme) {
    safeSet(KEYS.theme, theme);
  },

  // ---------- audio settings ----------
  getAudioSettings() {
    return { ...DEFAULT_AUDIO_SETTINGS, ...safeGet(KEYS.audio, {}) };
  },
  updateAudioSettings(patch) {
    const merged = { ...this.getAudioSettings(), ...patch };
    safeSet(KEYS.audio, merged);
    return merged;
  },

  // ---------- reset ----------
  resetAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
