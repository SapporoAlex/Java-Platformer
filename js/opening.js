// The opening sequence shown when the game is first opened, before the menu:
//
//   1. black -> opening1 fades in, held ~1s (slow push-in)
//   2. a black wipe with a feathered edge rolls down from the top
//   3. flash -> opening2, sword swish
//   4. flash to white, dissolving to opening3, kiai shout + thud
//   5. fade to black -> the menu fades in
//
// Browsers won't play sound before the player interacts, so it starts behind
// a "Press any key / Tap to begin" prompt; that first press unlocks audio and
// starts the sequence. Any press during the sequence skips to the menu.
export const OPENING_IMAGES = ['assets/opening1.jpg', 'assets/opening2.jpg', 'assets/opening3.jpg'];

export function preloadOpening() {
  return Promise.all(OPENING_IMAGES.map((src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve; // a missing image just shows black
    img.src = src;
  })));
}

const anim = (el, keyframes, duration, opts = {}) => el.animate(keyframes, {
  duration, easing: 'ease-out', fill: 'forwards', ...opts,
});

export class Opening {
  // onUnlock: called from the first key/tap (unlock audio there).
  // onDone: called once the menu starts fading in.
  constructor(root, { sfx, onUnlock, onDone }) {
    this.root = root;
    this.sfx = sfx;
    this.onUnlock = onUnlock;
    this.onDone = onDone;
    this.state = 'gate'; // 'gate' | 'playing' | 'done'
    this.timers = [];
    this.animations = [];
    this.q = (sel) => root.querySelector(sel);

    // Capture phase on window: this sees the key/tap before the menus and the
    // game's input do, and stops it there, so pressing a key to start the
    // opening can't also press "Start Game" underneath.
    this.onKey = (e) => {
      if (this.state === 'done') return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) this.press();
    };
    this.onPointer = (e) => {
      if (this.state === 'done') return;
      e.preventDefault();
      e.stopPropagation();
      this.press();
    };
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('pointerdown', this.onPointer, true);
  }

  get active() {
    return this.state !== 'done';
  }

  show() {
    this.root.classList.remove('hidden');
  }

  // A key, tap or gamepad button.
  press() {
    if (this.state === 'gate') {
      this.onUnlock?.();
      this.play();
    } else if (this.state === 'playing') {
      this.finish(true);
    }
  }

  at(ms, fn) {
    this.timers.push(setTimeout(fn, ms));
  }

  track(a) {
    this.animations.push(a);
    return a;
  }

  play() {
    this.state = 'playing';
    const img1 = this.q('.op-1');
    const img2 = this.q('.op-2');
    const img3 = this.q('.op-3');
    const wipe = this.q('.op-wipe');
    const white = this.q('.op-white');
    const black = this.q('.op-black');
    this.q('.op-gate').classList.add('hidden');

    // 1. Fade in, hold, slow push-in
    this.track(anim(img1, [{ opacity: 0 }, { opacity: 1 }], 600));
    this.track(anim(img1, [{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], 2300, { easing: 'linear' }));

    // 2. Black wipe from the top, feathered edge
    this.at(1600, () => {
      this.track(anim(wipe, [{ transform: 'translateY(-115%)' }, { transform: 'translateY(0%)' }], 700, { easing: 'ease-in' }));
    });

    // 3. Flash to the second image, sword swish
    this.at(2300, () => {
      img1.style.opacity = 0;
      wipe.style.opacity = 0;
      img2.style.opacity = 1;
      this.track(anim(white, [{ opacity: 0.95 }, { opacity: 0 }], 260));
      this.track(anim(img2, [{ transform: 'scale(1.14)' }, { transform: 'scale(1.03)' }], 1100, { easing: 'ease-out' }));
      this.sfx?.play('slash');
    });

    // 4. Flash to white, dissolve to the third image, kiai + thud
    this.at(3400, () => {
      this.track(anim(white, [{ opacity: 0 }, { opacity: 1 }], 110, { easing: 'linear' }));
      this.sfx?.play('attack');
      this.sfx?.play('hit');
    });
    this.at(3520, () => {
      img2.style.opacity = 0;
      img3.style.opacity = 1;
      this.track(anim(white, [{ opacity: 1 }, { opacity: 0 }], 750, { easing: 'ease-in' }));
      this.track(anim(img3, [{ transform: 'scale(1.07) translateX(-1%)' }, { transform: 'scale(1) translateX(0)' }], 1900));
    });

    // 5. Fade to black, then the menu
    this.at(5000, () => this.track(anim(black, [{ opacity: 0 }, { opacity: 1 }], 700, { easing: 'ease-in' })));
    this.at(5750, () => this.finish(false));
  }

  // Ends the sequence (skipped or finished) and fades the menu in.
  finish(skipped) {
    if (this.state === 'done') return;
    this.state = 'done';
    for (const t of this.timers) clearTimeout(t);
    for (const a of this.animations) a.cancel();
    this.timers = [];
    this.animations = [];
    const black = this.q('.op-black');
    black.style.opacity = 1;
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('pointerdown', this.onPointer, true);
    this.onDone?.(skipped);
    // Stop catching clicks right away; hide when the fade ends, with a timer
    // as backup (animations pause in background tabs).
    this.root.style.pointerEvents = 'none';
    const hide = () => this.root.classList.add('hidden');
    const fade = this.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, easing: 'ease-out', fill: 'forwards' });
    fade.onfinish = hide;
    setTimeout(hide, 900);
  }
}
