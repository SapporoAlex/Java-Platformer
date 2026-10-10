// Maps physical keys / gamepad buttons / touch buttons onto abstract
// actions, so gameplay code only ever asks "is jump held?" and never cares
// which device produced it.
export const KEY_BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'KeyK', 'Space'],
  attack: ['KeyX', 'KeyJ'],
  pause: ['Escape', 'KeyP'],
};

// Standard gamepad layout: A / B jump, X / Y attack, Start pauses.
const PAD_BUTTONS = {
  jump: [0, 1],
  attack: [2, 3],
  pause: [9],
  up: [12],
  down: [13],
  left: [14],
  right: [15],
};
const STICK_DEADZONE = 0.4;

const CODE_TO_ACTIONS = new Map();
for (const [action, codes] of Object.entries(KEY_BINDINGS)) {
  for (const code of codes) {
    if (!CODE_TO_ACTIONS.has(code)) CODE_TO_ACTIONS.set(code, []);
    CODE_TO_ACTIONS.get(code).push(action);
  }
}

export class Input {
  constructor(target) {
    this.keysDown = new Set();
    this.virtualDown = new Set(); // touch buttons
    this.padDown = new Set();
    this.held = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.queuedPresses = new Set();
    // When false (menus open), keys are left alone so the browser's own
    // button focus/activation keeps working.
    this.captureKeys = true;

    target.addEventListener('keydown', (e) => {
      const actions = CODE_TO_ACTIONS.get(e.code);
      if (!actions || !this.captureKeys) return;
      e.preventDefault();
      if (e.repeat) return;
      this.keysDown.add(e.code);
      for (const a of actions) this.queuedPresses.add(a);
    });
    target.addEventListener('keyup', (e) => {
      if (!CODE_TO_ACTIONS.has(e.code)) return;
      if (this.captureKeys) e.preventDefault();
      this.keysDown.delete(e.code);
    });
    window.addEventListener('blur', () => this.reset());
  }

  pollGamepads() {
    this.padDown.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      for (const [action, buttons] of Object.entries(PAD_BUTTONS)) {
        if (buttons.some((b) => pad.buttons[b]?.pressed)) this.padDown.add(action);
      }
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      if (x < -STICK_DEADZONE) this.padDown.add('left');
      if (x > STICK_DEADZONE) this.padDown.add('right');
      if (y < -STICK_DEADZONE * 1.5) this.padDown.add('up');
      if (y > STICK_DEADZONE * 1.5) this.padDown.add('down');
    }
  }

  // Called once per simulation tick, before the game reads input.
  update() {
    this.pollGamepads();
    const now = new Set(this.padDown);
    for (const code of this.keysDown) {
      for (const a of CODE_TO_ACTIONS.get(code) ?? []) now.add(a);
    }
    for (const a of this.virtualDown) now.add(a);

    this.pressed.clear();
    this.released.clear();
    for (const a of now) if (!this.held.has(a)) this.pressed.add(a);
    // A key tapped and released between two ticks still registers.
    for (const a of this.queuedPresses) this.pressed.add(a);
    for (const a of this.held) if (!now.has(a)) this.released.add(a);
    this.queuedPresses.clear();
    this.held = now;
  }

  isDown(action) {
    return this.held.has(action);
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  wasReleased(action) {
    return this.released.has(action);
  }

  anyPressed() {
    return this.pressed.size > 0;
  }

  // On-screen touch buttons feed in here.
  simulateDown(action) {
    this.virtualDown.add(action);
    this.queuedPresses.add(action);
  }

  simulateUp(action) {
    this.virtualDown.delete(action);
  }

  reset() {
    this.keysDown.clear();
    this.virtualDown.clear();
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.queuedPresses.clear();
  }
}
