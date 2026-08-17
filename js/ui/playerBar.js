// js/ui/playerBar.js — the persistent sticky audio player.
import { player } from '../audio.js';
import { Storage } from '../storage.js';
import { Icon, toast, escapeHtml } from './common.js';
import { QARIS } from '../api.js';

let els = null;
let seeking = false;

export function mountPlayerBar(root) {
  root.innerHTML = `
    <div class="audio-player" id="audio-player" role="region" aria-label="Audio player">
      <div class="ap-meta">
        <span class="ap-surah" id="ap-surah">—</span>
        <span class="ap-ayah" id="ap-ayah">—</span>
      </div>
      <div class="ap-controls">
        <button class="ap-btn" id="ap-prev" aria-label="Previous ayah">${Icon.prev}</button>
        <button class="ap-btn play" id="ap-toggle" aria-label="Play">${Icon.play}</button>
        <button class="ap-btn" id="ap-next" aria-label="Next ayah">${Icon.next}</button>
      </div>
      <div class="ap-progress">
        <span class="ap-time" id="ap-time-cur">0:00</span>
        <div class="ap-seek" id="ap-seek" role="slider" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
          <div class="ap-seek-fill" id="ap-seek-fill" style="width:0%"></div>
          <div class="ap-seek-thumb" id="ap-seek-thumb" style="left:0%"></div>
        </div>
        <span class="ap-time end" id="ap-time-end">0:00</span>
      </div>
      <div class="ap-extra">
        <select class="ap-select" id="ap-qari" aria-label="Reciter"></select>
        <select class="ap-select" id="ap-speed" aria-label="Playback speed">
          ${[0.75, 1, 1.25, 1.5, 2].map((r) => `<option value="${r}">${r}×</option>`).join('')}
        </select>
        <button class="ap-btn" id="ap-repeat" aria-label="Repeat mode: off" title="Repeat">${Icon.repeat}</button>
        <button class="ap-btn" id="ap-autonext" aria-label="Auto-play next ayah" title="Auto-next">${Icon.next}</button>
      </div>
      <button class="ap-btn ap-close" id="ap-close" aria-label="Close player">${Icon.x}</button>
    </div>
  `;

  els = {
    bar: root.querySelector('#audio-player'),
    surah: root.querySelector('#ap-surah'),
    ayah: root.querySelector('#ap-ayah'),
    prev: root.querySelector('#ap-prev'),
    toggle: root.querySelector('#ap-toggle'),
    next: root.querySelector('#ap-next'),
    timeCur: root.querySelector('#ap-time-cur'),
    timeEnd: root.querySelector('#ap-time-end'),
    seek: root.querySelector('#ap-seek'),
    seekFill: root.querySelector('#ap-seek-fill'),
    seekThumb: root.querySelector('#ap-seek-thumb'),
    qari: root.querySelector('#ap-qari'),
    speed: root.querySelector('#ap-speed'),
    repeat: root.querySelector('#ap-repeat'),
    autonext: root.querySelector('#ap-autonext'),
    close: root.querySelector('#ap-close'),
  };

  const audioSettings = Storage.getAudioSettings();
  els.qari.innerHTML = QARIS.map((q) => `<option value="${q.id}" ${q.id === audioSettings.qari ? 'selected' : ''}>${escapeHtml(q.label)}</option>`).join('');
  els.speed.value = String(audioSettings.speed);
  player.setRate(audioSettings.speed);
  player.setAutoNext(audioSettings.autoNext);
  player.setRepeatMode(audioSettings.repeatMode);
  reflectAutoNext();
  reflectRepeat();

  els.toggle.addEventListener('click', () => player.toggle());
  els.prev.addEventListener('click', () => player.prev());
  els.next.addEventListener('click', () => player.next());
  els.close.addEventListener('click', () => { player.stop(); hideBar(); });

  els.speed.addEventListener('change', (e) => {
    const rate = parseFloat(e.target.value);
    player.setRate(rate);
    Storage.updateAudioSettings({ speed: rate });
  });
  els.qari.addEventListener('change', (e) => {
    Storage.updateAudioSettings({ qari: e.target.value });
    toast('Reciter changed — will apply on next play');
  });
  els.repeat.addEventListener('click', () => {
    const modes = ['off', 'ayah', 'surah'];
    const nextMode = modes[(modes.indexOf(player.repeatMode) + 1) % modes.length];
    player.setRepeatMode(nextMode);
    Storage.updateAudioSettings({ repeatMode: nextMode });
    reflectRepeat();
  });
  els.autonext.addEventListener('click', () => {
    const on = !player.autoNext;
    player.setAutoNext(on);
    Storage.updateAudioSettings({ autoNext: on });
    reflectAutoNext();
  });

  wireSeek();

  player.addEventListener('play', () => { els.toggle.innerHTML = Icon.pause; els.toggle.setAttribute('aria-label', 'Pause'); });
  player.addEventListener('pause', () => { els.toggle.innerHTML = Icon.play; els.toggle.setAttribute('aria-label', 'Play'); });
  player.addEventListener('trackchange', (e) => updateMeta(e.detail.current));
  player.addEventListener('timeupdate', updateProgress);
  player.addEventListener('loadedmetadata', updateProgress);
  player.addEventListener('error', (e) => toast(e.detail.message || 'Audio error'));
  player.addEventListener('queueend', () => { /* keep bar, playback simply stops */ });
}

export function openAudioPlayerFor(surahData) {
  els?.bar.classList.add('is-open');
  document.body.classList.add('player-open');
  if (els) {
    els.surah.textContent = surahData.englishName;
  }
}

function hideBar() {
  els?.bar.classList.remove('is-open');
  document.body.classList.remove('player-open');
}

function updateMeta(current) {
  if (!current || !els) return;
  els.bar.classList.add('is-open');
  document.body.classList.add('player-open');
  els.surah.textContent = current.surahName || els.surah.textContent;
  els.ayah.textContent = `Ayah ${current.numberInSurah}${current.surahAyahCount ? ` / ${current.surahAyahCount}` : ''}`;
}

function fmt(t) {
  if (!isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateProgress() {
  if (!els || seeking) return;
  const { currentTime, duration } = player.audio;
  const pct = duration ? (currentTime / duration) * 100 : 0;
  els.seekFill.style.width = pct + '%';
  els.seekThumb.style.left = pct + '%';
  els.seek.setAttribute('aria-valuenow', Math.round(pct));
  els.timeCur.textContent = fmt(currentTime);
  els.timeEnd.textContent = fmt(duration);
}

function wireSeek() {
  const setFromEvent = (clientX) => {
    const rect = els.seek.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    els.seekFill.style.width = fraction * 100 + '%';
    els.seekThumb.style.left = fraction * 100 + '%';
    return fraction;
  };
  els.seek.addEventListener('pointerdown', (e) => {
    seeking = true;
    const fraction = setFromEvent(e.clientX);
    const move = (ev) => setFromEvent(ev.clientX);
    const up = (ev) => {
      const f = setFromEvent(ev.clientX);
      player.seekTo(f);
      seeking = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  els.seek.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') player.seekTo(Math.min(1, (player.audio.currentTime + 5) / (player.audio.duration || 1)));
    if (e.key === 'ArrowLeft') player.seekTo(Math.max(0, (player.audio.currentTime - 5) / (player.audio.duration || 1)));
  });
}

function reflectRepeat() {
  if (!els) return;
  const labels = { off: 'Repeat: off', ayah: 'Repeat: this ayah', surah: 'Repeat: whole surah' };
  els.repeat.classList.toggle('toggled', player.repeatMode !== 'off');
  els.repeat.setAttribute('aria-label', labels[player.repeatMode]);
  els.repeat.title = labels[player.repeatMode];
}
function reflectAutoNext() {
  if (!els) return;
  els.autonext.classList.toggle('toggled', player.autoNext);
  els.autonext.setAttribute('aria-label', player.autoNext ? 'Auto-next: on' : 'Auto-next: off');
  els.autonext.title = player.autoNext ? 'Auto-next: on' : 'Auto-next: off';
}
