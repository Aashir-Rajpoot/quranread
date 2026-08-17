// js/api.js
// All Quran data (Arabic text, translations, surah metadata, per-ayah audio)
// comes from the AlQuran Cloud API (api.alquran.cloud) — a free, established
// Quran data source. We never hand-type or invent Quran text.
//
// Responses are cached in localStorage (Quran text never changes, so this
// is safe indefinitely) and mirrored in-memory for the current session.

const API_BASE = 'https://api.alquran.cloud/v1';
const CACHE_PREFIX = 'qr_cache_v1:';
const memCache = new Map();

export const TEXT_EDITION = 'quran-uthmani';
export const TRANSLATIONS = [
  { id: 'en.sahih', label: 'English — Saheeh International' },
  { id: 'en.pickthall', label: 'English — Pickthall' },
  { id: 'en.yusufali', label: 'English — Yusuf Ali' },
  { id: 'ur.jalandhry', label: 'Urdu — Jalandhry' },
  { id: 'fr.hamidullah', label: 'French — Hamidullah' },
  { id: 'id.indonesian', label: 'Indonesian — Kemenag' },
];

export const QARIS = [
  { id: 'ar.alafasy', label: 'Mishary Rashid Al-Afasy' },
  { id: 'ar.husary', label: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.abdulbasitmurattal', label: 'Abdul Basit (Murattal)' },
  { id: 'ar.minshawi', label: 'Mohamed Siddiq Al-Minshawi' },
  { id: 'ar.mahermuaiqly', label: 'Maher Al-Muaiqly' },
  { id: 'ar.hudhaify', label: 'Ali Al-Hudhaify' },
];

class ApiError extends Error {
  constructor(message, { offline = false, status = null } = {}) {
    super(message);
    this.offline = offline;
    this.status = status;
  }
}

function readCache(key) {
  if (memCache.has(key)) return memCache.get(key);
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  memCache.set(key, value);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — non-fatal, session cache still works
  }
}

async function apiFetch(path, cacheKey, { timeout = 12000 } = {}) {
  const cached = cacheKey ? readCache(cacheKey) : null;
  if (!navigator.onLine) {
    if (cached) return cached;
    throw new ApiError('You appear to be offline.', { offline: true });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(API_BASE + path, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new ApiError(`Request failed (${res.status})`, { status: res.status });
    const json = await res.json();
    if (json.code !== 200 || !json.data) throw new ApiError('Unexpected response from Quran API.');
    if (cacheKey) writeCache(cacheKey, json.data);
    return json.data;
  } catch (err) {
    clearTimeout(timer);
    if (cached) return cached; // graceful fallback to last-known-good data
    if (err.name === 'AbortError') throw new ApiError('The request timed out. Please try again.');
    if (err instanceof ApiError) throw err;
    throw new ApiError('Unable to reach the Quran data source right now.');
  }
}

/** List of all 114 surahs with Arabic/English names, ayah counts, revelation type. */
export async function getSurahList() {
  return apiFetch('/surah', 'surah-list');
}

/**
 * Full surah: Arabic (Uthmani), a translation, and per-ayah audio links —
 * fetched together in a single request against the "editions" endpoint.
 */
export async function getSurah(surahNumber, translationId = 'en.sahih', qariId = 'ar.alafasy') {
  const editions = [TEXT_EDITION, translationId, qariId].join(',');
  const cacheKey = `surah-${surahNumber}-${translationId}-${qariId}`;
  const data = await apiFetch(`/surah/${surahNumber}/editions/${editions}`, cacheKey);
  const [arabic, translation, audio] = data;
  return {
    number: arabic.number,
    name: arabic.name,
    englishName: arabic.englishName,
    englishNameTranslation: arabic.englishNameTranslation,
    revelationType: arabic.revelationType,
    ayahCount: arabic.ayahs.length,
    ayahs: arabic.ayahs.map((a, i) => ({
      number: a.number, // global ayah number across the whole Quran
      numberInSurah: a.numberInSurah,
      text: a.text,
      juz: a.juz,
      translation: translation?.ayahs?.[i]?.text ?? '',
      audioUrl: audio?.ayahs?.[i]?.audio ?? null,
      sajda: a.sajda === true,
    })),
  };
}

/** Search Arabic + translation text across the whole Quran or one surah. */
export async function searchQuran(keyword, translationId = 'en.sahih', surah = 'all') {
  const [arabicHits, translationHits] = await Promise.all([
    apiFetch(`/search/${encodeURIComponent(keyword)}/${surah}/${TEXT_EDITION}`, null).catch(() => ({ matches: [] })),
    apiFetch(`/search/${encodeURIComponent(keyword)}/${surah}/${translationId}`, null).catch(() => ({ matches: [] })),
  ]);
  const bySurahAyah = new Map();
  for (const m of arabicHits?.matches || []) {
    const key = `${m.surah.number}:${m.numberInSurah}`;
    bySurahAyah.set(key, { ...m, arabicText: m.text, translationText: '' });
  }
  for (const m of translationHits?.matches || []) {
    const key = `${m.surah.number}:${m.numberInSurah}`;
    const existing = bySurahAyah.get(key);
    if (existing) existing.translationText = m.text;
    else bySurahAyah.set(key, { ...m, arabicText: '', translationText: m.text });
  }
  return [...bySurahAyah.values()];
}

export { ApiError };
