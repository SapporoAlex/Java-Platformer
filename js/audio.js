// Sound effects. Every effect is triggered by name - sfx.play('coin') - and
// looks for a matching file in sfx/ first:
//
//   sfx/<name>.wav   (or .mp3 / .ogg)
//
// Names: jump, land, slash (sword swish), attack (her shout), hit, enemyDie,
// hurt, die, coin, heal, buy, door, locked, fireball, windup, bossSlash,
// bossRoar, bossDefeat, pause, menu, jigoku (her opening line, 地獄に帰れ!),
// chop (axe into flesh, under the opening line)
//
// Variants: attack.wav, attack2.wav, attack3.wav, ... are all loaded and one
// is picked at random each time (never the same one twice in a row).
//
// The heroine's voice lines (VOICE_NAMES) share one "voice": a new line cuts
// off the one still playing, like a real voice would.
//
// tools/make_sfx.py generates the current set of files.
//
// Until a file exists, a short synthesized placeholder blip plays instead, so
// dropping in real audio never requires a code change. unlock() must be
// called from a real user gesture or browsers keep audio suspended.
export const SFX_NAMES = [
  'jump', 'land', 'slash', 'attack', 'hit', 'enemyDie', 'hurt', 'die', 'coin', 'heal', 'buy', 'door',
  'locked', 'fireball', 'windup', 'bossSlash', 'bossRoar', 'bossDefeat', 'pause', 'menu', 'jigoku', 'chop',
];
const EXTENSIONS = ['wav', 'mp3', 'ogg'];
const MAX_VARIANTS = 8;
const VOICE_NAMES = new Set(['attack', 'hurt', 'die', 'jigoku']);
// Minimum seconds between two plays of the same sound - stops rapid slashing
// from turning her shout into a stutter.
const MIN_GAP = { attack: 0.32 };
// Per-sound volume boosts (1 = as recorded). The master limiter below keeps
// a boosted sound from clipping.
const GAIN = { chop: 3 };

const SYNTH = {
  jump: [{ type: 'square', f0: 330, f1: 660, d: 0.11, v: 0.08 }],
  land: [{ type: 'triangle', f0: 140, f1: 60, d: 0.07, v: 0.12 }],
  slash: [{ type: 'noise', d: 0.09, v: 0.12, hp: 2400 }, { type: 'triangle', f0: 900, f1: 300, d: 0.08, v: 0.05 }],
  hit: [{ type: 'square', f0: 220, f1: 90, d: 0.09, v: 0.12 }, { type: 'noise', d: 0.06, v: 0.12 }],
  enemyDie: [{ type: 'square', f0: 400, f1: 60, d: 0.25, v: 0.1 }, { type: 'noise', d: 0.2, v: 0.1 }],
  hurt: [{ type: 'sawtooth', f0: 300, f1: 70, d: 0.22, v: 0.14 }],
  die: [{ type: 'square', f0: 520, f1: 60, d: 0.8, v: 0.12 }],
  coin: [{ type: 'square', f0: 988, d: 0.06, v: 0.07 }, { type: 'square', f0: 1319, d: 0.16, v: 0.07, delay: 0.06 }],
  heal: [{ type: 'sine', f0: 523, f1: 1046, d: 0.3, v: 0.14 }],
  buy: [{ type: 'square', f0: 660, d: 0.08, v: 0.08 }, { type: 'square', f0: 880, d: 0.08, v: 0.08, delay: 0.08 },
    { type: 'square', f0: 1320, d: 0.16, v: 0.08, delay: 0.16 }],
  door: [{ type: 'triangle', f0: 200, f1: 400, d: 0.2, v: 0.14 }],
  locked: [{ type: 'square', f0: 120, d: 0.08, v: 0.1 }, { type: 'square', f0: 100, d: 0.12, v: 0.1, delay: 0.1 }],
  fireball: [{ type: 'noise', d: 0.25, v: 0.08, lp: 900 }],
  windup: [{ type: 'sine', f0: 200, f1: 600, d: 0.45, v: 0.06 }],
  bossSlash: [{ type: 'noise', d: 0.18, v: 0.18, hp: 1200 }, { type: 'sawtooth', f0: 180, f1: 50, d: 0.2, v: 0.08 }],
  bossRoar: [{ type: 'sawtooth', f0: 90, f1: 55, d: 0.9, v: 0.14 }, { type: 'noise', d: 0.7, v: 0.08, lp: 500 }],
  bossDefeat: [{ type: 'noise', d: 1.2, v: 0.16, lp: 700 }, { type: 'square', f0: 300, f1: 40, d: 1.2, v: 0.08 }],
  pause: [{ type: 'square', f0: 784, d: 0.06, v: 0.06 }, { type: 'square', f0: 523, d: 0.08, v: 0.06, delay: 0.07 }],
  menu: [{ type: 'square', f0: 880, d: 0.04, v: 0.05 }],
};

export class Sfx {
  constructor({ volume = 0.8 } = {}) {
    this.ctx = null;
    this.master = null;
    this.volume = volume;
    this.buffers = new Map(); // name -> [AudioBuffer, ...] (only for files that exist)
    this.lastVariant = new Map();
    this.lastPlayed = new Map();
    this.voice = null; // the voice line currently playing
    this.noise = null;
    this.muted = false;
  }

  // Creates the audio context and starts downloading/decoding every sound
  // right away - called during the loading screen, before any user input, so
  // the sounds are ready the moment they're needed (e.g. the opening's cues).
  // The context starts suspended until unlock() runs from a user gesture.
  // Returns a promise that settles once the files are loaded.
  init() {
    if (this.ctx) return this.ready;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      this.ready = Promise.resolve();
      return this.ready;
    }
    this.ctx = new AudioContextClass();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    // A limiter on the way out: transparent at normal levels, it only catches
    // peaks (e.g. a GAIN-boosted sound) that would otherwise clip and crackle.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.12;
    this.master.connect(this.limiter).connect(this.ctx.destination);
    this.ready = this.loadFiles();
    return this.ready;
  }

  // Must run inside a user gesture (key / tap / click): resumes the context
  // and plays one silent sample, which is what Safari / iOS need to fully
  // allow sound from then on.
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    if (!this.warmedUp) {
      this.warmedUp = true;
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      src.connect(this.ctx.destination);
      src.start();
    }
  }

  async fetchBuffer(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null; // not there / not decodable
    }
  }

  async loadFiles() {
    await Promise.all(SFX_NAMES.map(async (name) => {
      for (const ext of EXTENSIONS) {
        const first = await this.fetchBuffer(`sfx/${name}.${ext}`);
        if (!first) continue;
        const list = [first];
        // Numbered variants use the same extension as the base file.
        for (let i = 2; i <= MAX_VARIANTS; i++) {
          const more = await this.fetchBuffer(`sfx/${name}${i}.${ext}`);
          if (!more) break;
          list.push(more);
        }
        this.buffers.set(name, list);
        return;
      }
    }));
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (MIN_GAP[name] && now - (this.lastPlayed.get(name) ?? -1) < MIN_GAP[name]) return;
    this.lastPlayed.set(name, now);
    const list = this.buffers.get(name);
    if (list) {
      let i = Math.floor(Math.random() * list.length);
      if (list.length > 1 && i === this.lastVariant.get(name)) i = (i + 1) % list.length;
      this.lastVariant.set(name, i);
      const src = this.ctx.createBufferSource();
      src.buffer = list[i];
      if (GAIN[name]) {
        const boost = this.ctx.createGain();
        boost.gain.value = GAIN[name];
        src.connect(boost).connect(this.master);
      } else {
        src.connect(this.master);
      }
      src.start();
      if (VOICE_NAMES.has(name)) {
        try { this.voice?.stop(); } catch { /* already finished */ }
        this.voice = src;
      }
      return;
    }
    for (const voice of SYNTH[name] ?? []) this.synth(voice);
  }

  noiseBuffer() {
    if (!this.noise) {
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  synth({ type, f0, f1 = f0, d, v, delay = 0, hp, lp }) {
    const t = this.ctx.currentTime + delay;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(v, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let src;
    if (type === 'noise') {
      src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
    } else {
      src = this.ctx.createOscillator();
      src.type = type;
      src.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + d);
    }
    let node = src;
    if (hp || lp) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = hp ? 'highpass' : 'lowpass';
      filter.frequency.value = hp || lp;
      node.connect(filter);
      node = filter;
    }
    node.connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + d + 0.02);
  }
}
