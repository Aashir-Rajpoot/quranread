// js/audio.js
// Thin wrapper around a single <audio> element that plays a queue of ayahs.
// Emits events the UI subscribes to, so the player bar / reader highlighting
// stay in sync without polling.

export class AyahAudioPlayer extends EventTarget {
  constructor() {
    super();
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.queue = [];      // [{surah, numberInSurah, audioUrl, ...}]
    this.index = -1;
    this.repeatMode = 'off'; // off | ayah | surah
    this.autoNext = true;

    this.audio.addEventListener('timeupdate', () => this._emit('timeupdate'));
    this.audio.addEventListener('loadedmetadata', () => this._emit('loadedmetadata'));
    this.audio.addEventListener('play', () => this._emit('play'));
    this.audio.addEventListener('pause', () => this._emit('pause'));
    this.audio.addEventListener('waiting', () => this._emit('buffering'));
    this.audio.addEventListener('canplay', () => this._emit('canplay'));
    this.audio.addEventListener('ended', () => this._onEnded());
    this.audio.addEventListener('error', () => this._emit('error', { message: 'This recitation could not be loaded.' }));
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail: { ...detail, current: this.current() } }));
  }

  current() {
    return this.index >= 0 ? this.queue[this.index] : null;
  }

  /** Load a full ayah list (a surah) and start playing from a given index. */
  playQueue(ayahs, startIndex = 0) {
    this.queue = ayahs;
    this._playIndex(startIndex);
  }

  /** Play a single ayah without replacing an existing surah queue context. */
  playSingle(ayah) {
    this.queue = [ayah];
    this._playIndex(0);
  }

  _playIndex(i) {
    if (i < 0 || i >= this.queue.length) return;
    this.index = i;
    const ayah = this.queue[i];
    if (!ayah?.audioUrl) {
      this._emit('error', { message: 'Recitation audio is unavailable for this ayah.' });
      return;
    }
    this.audio.src = ayah.audioUrl;
    this.audio.playbackRate = this._rate ?? 1;
    const p = this.audio.play();
    if (p?.catch) p.catch(() => this._emit('error', { message: 'Playback was blocked. Tap play again.' }));
    this._emit('trackchange');
  }

  toggle() {
    if (!this.current()) return;
    if (this.audio.paused) this.audio.play().catch(() => {});
    else this.audio.pause();
  }

  pause() { this.audio.pause(); }

  next() {
    if (this.index + 1 < this.queue.length) this._playIndex(this.index + 1);
    else this._emit('queueend');
  }

  prev() {
    if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
    if (this.index - 1 >= 0) this._playIndex(this.index - 1);
    else this.audio.currentTime = 0;
  }

  seekTo(fraction) {
    if (!isFinite(this.audio.duration)) return;
    this.audio.currentTime = fraction * this.audio.duration;
  }

  setRate(rate) {
    this._rate = rate;
    this.audio.playbackRate = rate;
  }

  setRepeatMode(mode) { this.repeatMode = mode; }
  setAutoNext(v) { this.autoNext = v; }

  stop() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.queue = [];
    this.index = -1;
    this._emit('stopped');
  }

  _onEnded() {
    if (this.repeatMode === 'ayah') {
      this._playIndex(this.index);
      return;
    }
    const atEnd = this.index + 1 >= this.queue.length;
    if (atEnd && this.repeatMode === 'surah') {
      this._playIndex(0);
      return;
    }
    if (!atEnd && this.autoNext) {
      this._playIndex(this.index + 1);
      return;
    }
    this._emit('queueend');
  }
}

export const player = new AyahAudioPlayer();
