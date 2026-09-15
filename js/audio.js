// No sound assets exist in assets/, so these are short synthesized blips
// (Web Audio oscillators) rather than sample playback. unlock() must be
// called from a real user-gesture handler (e.g. the Start button click) or
// browsers will keep the AudioContext suspended.
export class Sfx {
  constructor() {
    this.ctx = null;
  }

  unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  playTone({ type = 'sine', startFreq, endFreq = startFreq, duration = 0.12, volume = 0.2 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  attack() {
    this.playTone({ type: 'triangle', startFreq: 520, endFreq: 180, duration: 0.09, volume: 0.18 });
  }

  jump() {
    this.playTone({ type: 'sine', startFreq: 260, endFreq: 560, duration: 0.12, volume: 0.18 });
  }

  damage() {
    this.playTone({ type: 'sawtooth', startFreq: 180, endFreq: 55, duration: 0.18, volume: 0.22 });
  }
}
