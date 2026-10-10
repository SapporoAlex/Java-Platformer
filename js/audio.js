// Sound effects. Every effect is triggered by name - sfx.play('coin') - and
// looks for a matching file in sfx/ first:
//
//   sfx/<name>.mp3   (or .ogg / .wav)
//
// Names: jump, land, attack, hit, enemyDie, hurt, die, coin, heal, buy, door,
// locked, fireball, windup, bossSlash, bossRoar, bossDefeat, pause, menu
//
// Until a file exists, a short synthesized placeholder blip plays instead, so
// dropping in real audio never requires a code change. unlock() must be
// called from a real user gesture or browsers keep audio suspended.
export const SFX_NAMES = [
  'jump', 'land', 'attack', 'hit', 'enemyDie', 'hurt', 'die', 'coin', 'heal', 'buy', 'door',
  'locked', 'fireball', 'windup', 'bossSlash', 'bossRoar', 'bossDefeat', 'pause', 'menu',
];
const EXTENSIONS = ['mp3', 'ogg', 'wav'];

const SYNTH = {
  jump: [{ type: 'square', f0: 330, f1: 660, d: 0.11, v: 0.08 }],
  land: [{ type: 'triangle', f0: 140, f1: 60, d: 0.07, v: 0.12 }],
  attack: [{ type: 'noise', d: 0.09, v: 0.12, hp: 2400 }, { type: 'triangle', f0: 900, f1: 300, d: 0.08, v: 0.05 }],
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
    this.buffers = new Map(); // name -> AudioBuffer (only for files that exist)
    this.noise = null;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.loadFiles();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  async loadFiles() {
    await Promise.all(SFX_NAMES.map(async (name) => {
      for (const ext of EXTENSIONS) {
        try {
          const res = await fetch(`sfx/${name}.${ext}`);
          if (!res.ok) continue;
          const data = await res.arrayBuffer();
          this.buffers.set(name, await this.ctx.decodeAudioData(data));
          return;
        } catch {
          // not there / not decodable - try the next extension
        }
      }
    }));
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    const buffer = this.buffers.get(name);
    if (buffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.master);
      src.start();
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
