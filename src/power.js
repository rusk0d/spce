import { onPress } from './input.js';

export const REACTOR_POWER = 4;

/**
 * Ship systems that draw reactor power. `effect(level)` is the short summary
 * shown next to the bars.
 */
export const SYSTEMS = [
  {
    id: 'weapons',
    name: 'Weapons',
    max: 3,
    effect: (lvl) => ['Offline', 'Laser', 'Laser + Missile', 'Overcharged'][lvl],
  },
  {
    id: 'shields',
    name: 'Shields',
    max: 3,
    effect: (lvl) => (lvl ? `Regen ×${lvl}` : 'No regen'),
  },
  {
    id: 'engines',
    name: 'Engines',
    max: 3,
    effect: (lvl) => (lvl ? `Evasion +${lvl * 6}%` : 'Offline · can’t jump'),
  },
];

// Gameplay tuning that depends on power levels
export const SHIELD_REGEN_PER_BAR_TURN = 3; // shield regen per combat exchange, per bar
export const SHIELD_REGEN_PER_BAR_JUMP = 6; // shield regen per jump, per bar
export const EVASION_PER_ENGINE_BAR = 0.06;

/** How the 4 reactor bars are split between systems. */
export class PowerGrid {
  constructor(onChange) {
    this.onChange = onChange;
    this.levels = { weapons: 2, shields: 1, engines: 1 };
  }

  get used() {
    return Object.values(this.levels).reduce((a, b) => a + b, 0);
  }

  get free() {
    return REACTOR_POWER - this.used;
  }

  level(id) {
    return this.levels[id];
  }

  /**
   * Tapping bar `n` (1-based) of a system: tapping a lit bar powers the system
   * down to just below it; tapping an unlit bar powers it up to that bar, as far
   * as free reactor power allows. Returns false if nothing could change.
   */
  tap(id, n) {
    const current = this.levels[id];
    const target = n <= current ? n - 1 : Math.min(n, current + this.free);
    if (target === current) return false;
    this.levels[id] = target;
    this.onChange?.();
    return true;
  }

  add(id) {
    const sys = SYSTEMS.find((s) => s.id === id);
    if (this.free <= 0 || this.levels[id] >= sys.max) return false;
    this.levels[id] += 1;
    this.onChange?.();
    return true;
  }

  remove(id) {
    if (this.levels[id] <= 0) return false;
    this.levels[id] -= 1;
    this.onChange?.();
    return true;
  }
}

/**
 * Power allocation UI: a reactor gauge plus one row of tappable bars per
 * system, with − / + buttons. Several panels can share one grid (e.g. the
 * standalone panel and the copy inside the combat panel).
 */
export class PowerPanel {
  constructor(grid, container, { extra } = {}) {
    this.grid = grid;
    this.container = container;
    this.extra = extra; // optional (systemId) => string for extra info (e.g. ammo)

    container.classList.add('power-panel');
    container.innerHTML = `
      <div class="power-head">
        <span class="label">Reactor</span>
        <span class="reactor" aria-hidden="true"></span>
        <span class="reactor-free"></span>
      </div>
      <div class="power-rows"></div>`;
    this.reactor = container.querySelector('.reactor');
    this.freeText = container.querySelector('.reactor-free');
    for (let i = 0; i < REACTOR_POWER; i++) {
      this.reactor.append(Object.assign(document.createElement('span'), { className: 'reactor-pip' }));
    }

    const rows = container.querySelector('.power-rows');
    this.rows = SYSTEMS.map((sys) => {
      const row = document.createElement('div');
      row.className = `power-row power-${sys.id}`;
      row.innerHTML = `
        <div class="power-info">
          <span class="power-name"></span>
          <span class="power-effect"></span>
        </div>
        <div class="power-controls">
          <button type="button" class="power-step power-minus" aria-label="Remove power from ${sys.name}">−</button>
          <div class="power-bars" role="group" aria-label="${sys.name} power"></div>
          <button type="button" class="power-step power-plus" aria-label="Add power to ${sys.name}">+</button>
        </div>`;
      row.querySelector('.power-name').textContent = sys.name;
      const barsEl = row.querySelector('.power-bars');
      const bars = [];
      for (let n = 1; n <= sys.max; n++) {
        const bar = document.createElement('button');
        bar.type = 'button';
        bar.className = 'power-bar';
        onPress(bar, () => grid.tap(sys.id, n));
        barsEl.append(bar);
        bars.push(bar);
      }
      const minus = row.querySelector('.power-minus');
      const plus = row.querySelector('.power-plus');
      onPress(minus, () => grid.remove(sys.id));
      onPress(plus, () => grid.add(sys.id));
      rows.append(row);
      return { sys, bars, minus, plus, effect: row.querySelector('.power-effect') };
    });
  }

  render() {
    const { grid } = this;
    [...this.reactor.children].forEach((pip, i) => pip.classList.toggle('free', i < grid.free));
    this.freeText.textContent = `${grid.free}/${REACTOR_POWER} free`;
    for (const { sys, bars, minus, plus, effect } of this.rows) {
      const lvl = grid.level(sys.id);
      bars.forEach((bar, i) => {
        bar.classList.toggle('on', i < lvl);
        bar.setAttribute('aria-pressed', String(i < lvl));
        bar.setAttribute('aria-label', `${sys.name} bar ${i + 1} of ${sys.max}${i < lvl ? ', powered' : ''}`);
      });
      minus.disabled = lvl === 0;
      plus.disabled = lvl >= sys.max || grid.free === 0;
      const extra = this.extra?.(sys.id);
      effect.textContent = extra ? `${sys.effect(lvl)} · ${extra}` : sys.effect(lvl);
    }
  }
}
