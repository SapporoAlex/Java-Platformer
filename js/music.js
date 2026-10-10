// Background music. Tracks live in music/ at the repo root; edit TRACKS to
// add or swap files - nothing else needs to change. A missing file just
// plays silence.
//
//   title     main menu
//   level     every stage picks one of these at random when it loads (and
//             keeps it if you lose a life and retry the same stage)
//   boss      each boss fight picks one at random when the arena seals
//   victory   the ending screen (plays once, no loop)
//
// Switching tracks crossfades rather than hard-cutting.
export const TRACKS = {
  title: ['menu.mp3'],
  level: ['level music 1.mp3', 'level music 2.mp3'],
  boss: ['boss 1.mp3', 'boss 2.mp3'],
  victory: ['win.mp3'],
};

const trackUrl = (file) => `music/${encodeURIComponent(file)}`;
const pickTrack = (list) => trackUrl(list[Math.floor(Math.random() * list.length)]);

export class MusicPlayer {
  constructor({ volume = 0.5, fadeMs = 1200 } = {}) {
    this.volume = volume;
    this.fadeMs = fadeMs;
    this.unlocked = false;
    this.queued = null;
    this.currentKey = null;
    this.current = null; // { audio }
    this.fadeHandle = null;
    this.levelNumber = null;
    this.levelTrack = null;
    this.hasBoss = false;
    this.bossActive = false;
    this.muted = false;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.current?.audio) this.current.audio.muted = muted;
  }

  // Must be called from inside a real user-gesture event handler (a click or
  // keydown), same requirement as Sfx#unlock - otherwise the browser refuses
  // to let any audio play at all.
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.queued) {
      const run = this.queued;
      this.queued = null;
      run();
    }
  }

  playTitle() {
    this.levelNumber = null; // the next stage started picks a fresh track
    this._crossfadeTo(pickTrack(TRACKS.title));
  }

  playVictory() {
    this._crossfadeTo(pickTrack(TRACKS.victory), { loop: false });
  }

  // Called whenever a stage loads (including a retry after losing a life).
  // `bossAssetPrefix` is truthy if the stage has a boss.
  playLevel(levelNumber, bossAssetPrefix) {
    if (levelNumber !== this.levelNumber || !this.levelTrack) {
      this.levelTrack = pickTrack(TRACKS.level);
    }
    this.levelNumber = levelNumber;
    this.hasBoss = !!bossAssetPrefix;
    this.bossActive = false;
    this._crossfadeTo(this.levelTrack);
  }

  // Called when a boss arena seals (true) and when the fight ends or the
  // player dies (false); only acts on an actual change.
  setBossActive(active) {
    if (active === this.bossActive) return;
    this.bossActive = active;
    if (active && this.hasBoss) {
      this._crossfadeTo(pickTrack(TRACKS.boss));
    } else if (this.levelTrack) {
      this._crossfadeTo(this.levelTrack);
    }
  }

  stop() {
    this._crossfadeTo(null);
  }

  _crossfadeTo(src, { loop = true } = {}) {
    if (!this.unlocked) {
      this.queued = () => this._crossfadeTo(src, { loop });
      return;
    }
    if (this.currentKey === src) return;
    this.currentKey = src;

    const prev = this.current;
    let next = null;
    if (src) {
      const audio = new Audio(src);
      audio.loop = loop;
      audio.volume = 0;
      audio.muted = this.muted;
      audio.addEventListener('error', () => {
        // Missing or undecodable file - just stay silent.
      });
      audio.play().catch(() => {}); // missing file, or a stricter autoplay policy - either way, silence is fine
      next = { audio };
    }
    this.current = next;

    const steps = 24;
    const stepMs = this.fadeMs / steps;
    let i = 0;
    if (this.fadeHandle) clearInterval(this.fadeHandle);
    this.fadeHandle = setInterval(() => {
      i++;
      const t = Math.min(1, i / steps);
      if (prev?.audio) prev.audio.volume = Math.max(0, this.volume * (1 - t));
      if (next?.audio) next.audio.volume = Math.min(this.volume, this.volume * t);
      if (t >= 1) {
        clearInterval(this.fadeHandle);
        this.fadeHandle = null;
        if (prev?.audio) {
          prev.audio.pause();
          prev.audio.src = '';
        }
      }
    }, stepMs);
  }
}
