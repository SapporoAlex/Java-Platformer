// Background music, driven entirely by file naming convention under
// web/music/ - none of these files exist yet; everything here is written to
// fail silently (no thrown errors, no broken game) until they're added, then
// just start working. Drop in:
//
//   web/music/title.mp3      - start screen
//   web/music/level1.mp3     - level 1's looping bg music
//   web/music/level2.mp3     - level 2's, and so on for every level (see
//                               LEVELS in levels-data.js - "level" + the
//                               level's 1-based number)
//   web/music/boss.mp3       - boss music for a boss using assetPrefix 'boss'
//   web/music/boss2.mp3      - ...assetPrefix 'boss2' (Fortress Approach)
//   web/music/boss3.mp3      - ...assetPrefix 'boss3' (the final boss)
//   web/music/victory.mp3    - the "You Win!" end screen
//
// Boss tracks are matched by the same `assetPrefix` each boss already uses
// for its sprite set (see the `boss` field in levels-data.js), so adding a
// 4th boss later with assetPrefix 'boss4' just needs a boss4.mp3 alongside
// its boss4_*.png frames - nothing in this file has to change.
//
// All tracks loop. Switching tracks crossfades rather than hard-cutting.
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
    this.bossTrackSrc = null;
    this.bossActive = false;
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
    this._crossfadeTo('title', 'music/title.mp3');
  }

  playVictory() {
    this._crossfadeTo('victory', 'music/victory.mp3');
  }

  // Called once when a level loads. `bossAssetPrefix` is the boss's
  // assetPrefix (e.g. 'boss2') if this level has one, else null/undefined.
  playLevel(levelNumber, bossAssetPrefix) {
    this.levelNumber = levelNumber;
    this.bossTrackSrc = bossAssetPrefix ? `music/${bossAssetPrefix}.mp3` : null;
    this.bossActive = false;
    this._crossfadeTo(`level${levelNumber}`, `music/level${levelNumber}.mp3`);
  }

  // Called every tick a level with a boss is playing; only actually swaps
  // tracks on a true -> false or false -> true transition.
  setBossActive(active) {
    if (active === this.bossActive) return;
    this.bossActive = active;
    if (active && this.bossTrackSrc) {
      this._crossfadeTo(`boss:${this.bossTrackSrc}`, this.bossTrackSrc);
    } else if (this.levelNumber != null) {
      this._crossfadeTo(`level${this.levelNumber}`, `music/level${this.levelNumber}.mp3`);
    }
  }

  stop() {
    this._crossfadeTo(null, null);
  }

  _crossfadeTo(key, src) {
    if (!this.unlocked) {
      this.queued = () => this._crossfadeTo(key, src);
      return;
    }
    if (this.currentKey === key) return;
    this.currentKey = key;

    const prev = this.current;
    let next = null;
    if (src) {
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = 0;
      audio.addEventListener('error', () => {
        // Expected until this specific mp3 has been added - just stay silent.
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
