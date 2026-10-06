/**
 * Fires `handler` as soon as a button is pressed (pointerdown) instead of
 * waiting for the click that follows release, which feels laggy on touch.
 * The click that follows a press is swallowed so the action never runs twice;
 * clicks with no preceding press (keyboard Enter/Space) still activate it.
 */
export function onPress(element, handler) {
  let lastPress = -Infinity;
  element.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    lastPress = performance.now();
    if (!element.disabled) handler(e);
  });
  element.addEventListener('click', (e) => {
    if (performance.now() - lastPress < 1000) return;
    if (!element.disabled) handler(e);
  });
}

/**
 * Collects horizontal drag distance from one pointer. Move events only add to
 * an accumulator; the render loop drains it through consume(), which hands out
 * at most `maxStep` per sample and samples at most every `intervalMs`, so a
 * fast swipe turns into a series of small, evenly spaced rotation steps.
 */
export class SwipeTracker {
  constructor({ intervalMs = 32, maxStep = 18 } = {}) {
    this.intervalMs = intervalMs;
    this.maxStep = maxStep;
    this.pointerId = null;
    this.lastX = 0;
    this.pendingDx = 0;
    this.lastSample = 0;
  }

  get active() {
    return this.pointerId !== null;
  }

  begin(e) {
    this.pointerId = e.pointerId;
    this.lastX = e.clientX;
    e.target.setPointerCapture?.(e.pointerId);
  }

  move(e) {
    if (e.pointerId !== this.pointerId) return;
    // Cap the backlog so a long fling doesn't keep rotating after release
    this.pendingDx = Math.max(-120, Math.min(120, this.pendingDx + e.clientX - this.lastX));
    this.lastX = e.clientX;
  }

  end(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
  }

  /** Returns the pixel delta to apply now (0 if throttled or idle). */
  consume(now) {
    if (this.pendingDx === 0 || now - this.lastSample < this.intervalMs) return 0;
    this.lastSample = now;
    const step = Math.max(-this.maxStep, Math.min(this.maxStep, this.pendingDx));
    this.pendingDx -= step;
    return step;
  }
}
