const TRACKED_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'Space',
]);

export class Input {
  constructor(target) {
    this.down = new Set();
    this.pressedThisFrame = new Set();

    target.addEventListener('keydown', (e) => {
      if (!TRACKED_KEYS.has(e.code)) return;
      e.preventDefault();
      if (!this.down.has(e.code)) this.pressedThisFrame.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      if (!TRACKED_KEYS.has(e.code)) return;
      e.preventDefault();
      this.down.delete(e.code);
    });
  }

  isDown(code) {
    return this.down.has(code);
  }

  // Used by the on-screen touch buttons - same edge-triggered semantics as
  // a real keydown/keyup, so wasPressed()/isDown() can't tell the difference.
  simulateDown(code) {
    if (!TRACKED_KEYS.has(code)) return;
    if (!this.down.has(code)) this.pressedThisFrame.add(code);
    this.down.add(code);
  }

  simulateUp(code) {
    if (!TRACKED_KEYS.has(code)) return;
    this.down.delete(code);
  }

  // True only on the single tick the key transitioned from up to down.
  wasPressed(code) {
    return this.pressedThisFrame.has(code);
  }

  endFrame() {
    this.pressedThisFrame.clear();
  }

  reset() {
    this.down.clear();
    this.pressedThisFrame.clear();
  }
}
