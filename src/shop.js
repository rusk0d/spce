import { onPress } from './input.js';

/**
 * Sector Shop catalogue. `blocked(state)` returns a reason the item can't be
 * bought right now (besides price), or null.
 */
export const SHOP_ITEMS = [
  {
    id: 'fuel',
    name: 'Fuel Cell',
    effect: '+1 Fuel',
    price: 3,
    stat: (s) => `Fuel ${s.fuel}`,
    blocked: () => null,
    buy: (s) => {
      s.fuel += 1;
    },
  },
  {
    id: 'hull',
    name: 'Hull Repair',
    effect: '+10 Hull',
    price: 5,
    stat: (s) => `Hull ${s.hull}/${s.maxHull}`,
    blocked: (s) => (s.hull >= s.maxHull ? 'Hull fully repaired' : null),
    buy: (s) => {
      s.hull = Math.min(s.maxHull, s.hull + 10);
    },
  },
  {
    id: 'missile',
    name: 'Missile',
    effect: '+1 Missile ammo',
    price: 6,
    stat: (s) => `Missiles ${s.missiles}`,
    blocked: () => null,
    buy: (s) => {
      s.missiles += 1;
    },
  },
  {
    id: 'reactor',
    name: 'Reactor Upgrade',
    effect: '+1 max Shields (permanent)',
    price: 50,
    stat: (s) => `Max shields ${s.maxShields}`,
    blocked: () => null,
    buy: (s) => {
      s.maxShields += 1;
      s.shields += 1;
    },
  },
];

/**
 * The shop panel. Rows are built once and updated in place so rapid repeated
 * taps on a Buy button always hit the same element.
 */
export class Shop {
  constructor({ el, state, onOpen, onPurchase, onClose }) {
    this.el = el;
    this.state = state;
    this.onOpen = onOpen;
    this.onPurchase = onPurchase;
    this.onClose = onClose;
    this.title = el.querySelector('#shop-station');
    this.balance = el.querySelector('#shop-scrap');
    this.status = el.querySelector('#shop-status');
    this.isOpen = false;

    const list = el.querySelector('#shop-items');
    this.rows = SHOP_ITEMS.map((item) => {
      const li = document.createElement('li');
      li.className = `shop-item shop-${item.id}`;
      li.innerHTML = `
        <div class="shop-info">
          <span class="shop-name"></span>
          <span class="shop-effect"></span>
          <span class="shop-stat"></span>
        </div>
        <button type="button" class="shop-buy">
          <span class="shop-buy-label">Buy</span>
          <span class="shop-price"></span>
        </button>`;
      li.querySelector('.shop-name').textContent = item.name;
      li.querySelector('.shop-effect').textContent = item.effect;
      li.querySelector('.shop-price').textContent = `${item.price} scrap`;
      const button = li.querySelector('.shop-buy');
      button.setAttribute('aria-label', `Buy ${item.name}, ${item.effect}, for ${item.price} scrap`);
      onPress(button, () => this.buy(item, li));
      list.append(li);
      return { item, li, button, stat: li.querySelector('.shop-stat'), label: li.querySelector('.shop-buy-label') };
    });

    onPress(el.querySelector('#shop-close'), () => this.close());
  }

  open(stationName) {
    this.title.textContent = `${stationName} Station`;
    this.status.textContent = 'Docked. What do you need, captain?';
    this.isOpen = true;
    this.onOpen?.();
    this.el.classList.add('show');
    this.render();
    this.rows.find((r) => !r.button.disabled)?.button.focus({ preventScroll: true });
  }

  close(viaKeyboard = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('show');
    this.onClose?.(viaKeyboard);
  }

  buy(item, li) {
    const reason = this.reason(item);
    if (reason) return;
    this.state.scrap -= item.price;
    item.buy(this.state);
    this.status.textContent = `Purchased ${item.name}: ${item.effect}.`;
    li.classList.remove('bought');
    void li.offsetWidth; // restart the flash animation
    li.classList.add('bought');
    this.render();
    this.onPurchase?.(item);
  }

  reason(item) {
    return item.blocked(this.state) ?? (this.state.scrap < item.price ? `Need ${item.price} scrap` : null);
  }

  render() {
    this.balance.textContent = this.state.scrap;
    for (const row of this.rows) {
      const reason = this.reason(row.item);
      row.stat.textContent = row.item.stat(this.state);
      row.button.disabled = Boolean(reason);
      row.label.textContent = reason ?? 'Buy';
      row.li.classList.toggle('unavailable', Boolean(reason));
    }
  }
}
