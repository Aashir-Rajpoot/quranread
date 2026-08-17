# QuranRead

A peaceful, distraction-free Qur'an reading web app. Pure HTML/CSS/JavaScript —
no build step, no framework, no backend required.

---

## 1. Run it locally

Because the app uses native ES modules (`<script type="module">`), it must be
served over `http://`, not opened directly as a `file://` path.

Any static server works. From this folder:

```bash
# Python
python3 -m http.server 8080

# Node (if you have it)
npx serve .
```

Then open `http://localhost:8080`.

## 2. Deploy to GitHub Pages

1. Push this folder's contents to a GitHub repo (files at the repo root, or in `/docs`).
2. In the repo: **Settings → Pages → Source**, pick the branch/folder above.
3. Your site will be live at `https://<username>.github.io/<repo>/`.

No environment variables, API keys, or build step are needed — everything
ships as static files.

## 3. Data & audio sources

- **Arabic text** (Uthmani script, `quran-uthmani` edition), **translations**,
  and **per-ayah recitation audio** all come from the free, established
  [AlQuran Cloud API](https://alquran.cloud/api) (`api.alquran.cloud`).
- No Quran text is hand-typed anywhere in this codebase — see `js/api.js`.
- No API key is required for AlQuran Cloud, so there is nothing secret to
  protect in the frontend. If you swap in a provider that *does* require a
  key, put that call behind a small serverless function instead of the
  browser — never hardcode a secret key into client-side JS.

## 4. Where things are stored

Everything below lives in the browser's `localStorage` on the reader's own
device. There is no account system and nothing is sent to a server.

| Key                     | What it holds                                             |
|--------------------------|------------------------------------------------------------|
| `quran_last_read`        | Surah, ayah, and progress % of the last position read      |
| `quran_bookmarks`        | Saved ayahs (surah, ayah, short preview, date saved)        |
| `quran_recent`           | Last 10 surahs/ayahs opened                                 |
| `quran_settings`         | Font size, line height, reader width, translation on/off, translation edition |
| `quran_theme`            | Selected reading theme                                      |
| `quran_audio_settings`   | Selected reciter, playback speed, auto-next, repeat mode     |
| `qr_cache_v1:*`          | Cached API responses (surah list, surah text/translation/audio) so previously-opened surahs still open offline |

**Last-read / resume:** while reading, an `IntersectionObserver` tracks which
ayah is centered in the viewport and debounces a save (~600ms) to avoid
excessive writes. The last known position is also flushed immediately on
`beforeunload` and on tab/visibility change, so closing the browser right
after scrolling doesn't lose your place.

## 5. How audio works

Tapping ▶ on an ayah (or the surah-wide play control) loads that ayah's
audio URL from the selected reciter's edition and starts a queue that walks
forward through the surah. The player supports play/pause, previous/next
ayah, seeking, playback speed, repeat-ayah, repeat-surah, and auto-advance.
The currently-playing ayah is highlighted and scrolled into view.

## 6. Word-by-word display — and its real limitation

Each ayah is rendered with every Arabic word wrapped in its own `<span>`,
so the UI is structurally ready for word-level highlighting. However, the
Quran data source used here does not provide reliable word-level audio
timing data, so **highlighting during playback is done at the ayah level**,
not the word level. Faking a per-word timer against ayah-length audio would
drift out of sync with the actual recitation, so the app deliberately does
not pretend to do this — it's an explicit, honest fallback rather than a
missing feature.

## 7. Implemented features

- Full 114-surah Qur'an in Uthmani Arabic script + selectable translation
- Automatic last-read tracking and a "Continue Reading" home card
- Bookmark any ayah, with a dedicated Bookmarks page
- Ayah selection with a contextual toolbar: play, bookmark, copy, share
- Per-ayah recitation audio with a sticky player: play/pause, prev/next,
  seek, speed, repeat ayah/surah, auto-next, reciter selection
- 5 reading themes (Classic, Paper, Dark, Green, Modern), persisted
- Arabic font size, line height, reader width, translation size/toggle —
  all persisted
- Search across surah names/numbers, Arabic text, and translation text,
  plus direct `surah:ayah` lookups (e.g. `2:255`)
- Deep links to any ayah (`#/quran/2/255`) that scroll to and highlight it
- Recently-read list (last 10), clearable
- Distraction-free / fullscreen focus mode (Esc to exit)
- Fully responsive layout with a mobile bottom nav and a mobile-optimized
  ayah toolbar
- Loading skeletons, and dedicated empty/error states for every major
  screen (no blank screens, no raw stack traces)
- Offline app-shell caching via a small service worker, plus a persistent
  localStorage cache of previously-opened surahs
- Semantic HTML, keyboard-operable controls, visible focus states, `aria-label`s

## 8. Genuine limitations (caused by external services, not by design)

- **Word-level recitation sync** is not available — see §6.
- **Full offline Qur'an reading** only covers surahs you've already opened
  at least once (they're cached); a surah you've never opened still needs a
  connection the first time.
- Translation availability and audio reciter availability depend on what
  the AlQuran Cloud API currently publishes; if an edition identifier is
  ever retired upstream, that option would need to be swapped for a
  current one in `js/api.js`.
