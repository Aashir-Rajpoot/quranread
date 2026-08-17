// js/ui/settings.js
import { Storage } from '../storage.js';
import { TRANSLATIONS, QARIS } from '../api.js';
import { confirmModal, toast, escapeHtml } from './common.js';

const THEME_OPTIONS = [
  { id: 'classic', label: 'Classic Quran' },
  { id: 'paper', label: 'Paper' },
  { id: 'dark', label: 'Dark' },
  { id: 'sakina-green', label: 'Green' },
  { id: 'modern', label: 'Modern' },
];

export function renderSettings(container) {
  const settings = Storage.getSettings();
  const audio = Storage.getAudioSettings();
  const theme = Storage.getTheme();

  container.innerHTML = `
    <div class="container">
      <div class="page-hero">
        <h1>Settings</h1>
        <p>Everything here is saved on this device — no account needed.</p>
      </div>
      <div class="settings-grid">
        <div class="settings-card">
          <h3>Reading</h3>
          <div class="settings-row">
            <label for="s-theme">Theme</label>
            <select id="s-theme">${THEME_OPTIONS.map((t) => `<option value="${t.id}" ${t.id === theme ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
          </div>
          <div class="settings-row">
            <label for="s-width">Reader width</label>
            <select id="s-width">
              <option value="narrow" ${settings.readerWidth === 'narrow' ? 'selected' : ''}>Narrow</option>
              <option value="comfortable" ${settings.readerWidth === 'comfortable' ? 'selected' : ''}>Comfortable</option>
              <option value="wide" ${settings.readerWidth === 'wide' ? 'selected' : ''}>Wide</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="s-translation-on">Show translation</label>
            <select id="s-translation-on">
              <option value="on" ${settings.translationOn ? 'selected' : ''}>On</option>
              <option value="off" ${!settings.translationOn ? 'selected' : ''}>Off</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="s-translation-id">Translation edition</label>
            <select id="s-translation-id">
              ${TRANSLATIONS.map((t) => `<option value="${t.id}" ${t.id === settings.translationId ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="settings-card">
          <h3>Audio</h3>
          <div class="settings-row">
            <label for="a-qari">Reciter (Qari)</label>
            <select id="a-qari">${QARIS.map((q) => `<option value="${q.id}" ${q.id === audio.qari ? 'selected' : ''}>${escapeHtml(q.label)}</option>`).join('')}</select>
          </div>
          <div class="settings-row">
            <label for="a-speed">Playback speed</label>
            <select id="a-speed">${[0.75, 1, 1.25, 1.5, 2].map((r) => `<option value="${r}" ${r === audio.speed ? 'selected' : ''}>${r}×</option>`).join('')}</select>
          </div>
          <div class="settings-row">
            <label for="a-autonext">Auto-play next ayah</label>
            <select id="a-autonext">
              <option value="on" ${audio.autoNext ? 'selected' : ''}>On</option>
              <option value="off" ${!audio.autoNext ? 'selected' : ''}>Off</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="a-repeat">Repeat mode</label>
            <select id="a-repeat">
              <option value="off" ${audio.repeatMode === 'off' ? 'selected' : ''}>Off</option>
              <option value="ayah" ${audio.repeatMode === 'ayah' ? 'selected' : ''}>Repeat ayah</option>
              <option value="surah" ${audio.repeatMode === 'surah' ? 'selected' : ''}>Repeat surah</option>
            </select>
          </div>
        </div>

        <div class="settings-card">
          <h3>Your data</h3>
          <div class="settings-row">
            <label>Recently read history</label>
            <button class="btn btn-sm btn-outline" id="clear-recent">Clear</button>
          </div>
          <div class="settings-row">
            <label>Bookmarks</label>
            <button class="btn btn-sm btn-outline" id="clear-bookmarks">Clear</button>
          </div>
          <div class="settings-row danger-row">
            <label>Reset everything (last read, bookmarks, theme, preferences)</label>
            <button class="btn btn-sm" id="reset-all">Reset</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#s-theme').addEventListener('change', (e) => {
    Storage.setTheme(e.target.value);
    document.documentElement.setAttribute('data-theme', e.target.value);
    toast('Theme updated');
  });
  container.querySelector('#s-width').addEventListener('change', (e) => Storage.updateSettings({ readerWidth: e.target.value }));
  container.querySelector('#s-translation-on').addEventListener('change', (e) => Storage.updateSettings({ translationOn: e.target.value === 'on' }));
  container.querySelector('#s-translation-id').addEventListener('change', (e) => Storage.updateSettings({ translationId: e.target.value }));

  container.querySelector('#a-qari').addEventListener('change', (e) => Storage.updateAudioSettings({ qari: e.target.value }));
  container.querySelector('#a-speed').addEventListener('change', (e) => Storage.updateAudioSettings({ speed: parseFloat(e.target.value) }));
  container.querySelector('#a-autonext').addEventListener('change', (e) => Storage.updateAudioSettings({ autoNext: e.target.value === 'on' }));
  container.querySelector('#a-repeat').addEventListener('change', (e) => Storage.updateAudioSettings({ repeatMode: e.target.value }));

  container.querySelector('#clear-recent').addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Clear recently read?', message: 'This clears your recently-read history on this device.', confirmLabel: 'Clear' });
    if (ok) { Storage.clearRecent(); toast('Recently read cleared'); }
  });
  container.querySelector('#clear-bookmarks').addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Clear all bookmarks?', message: 'This removes every saved bookmark. This cannot be undone.', confirmLabel: 'Clear all' });
    if (ok) { Storage.clearBookmarks(); toast('Bookmarks cleared'); }
  });
  container.querySelector('#reset-all').addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Reset everything?', message: 'This erases your last-read position, bookmarks, theme, and all preferences on this device.', confirmLabel: 'Reset everything' });
    if (ok) { Storage.resetAll(); toast('Everything has been reset'); setTimeout(() => location.reload(), 600); }
  });
}
