import { onPress } from './input.js';

export const ROLES = ['Pilot', 'Engineer', 'Shields'];
export const MAX_CREW = 6;

// Per-role bonuses. Injured crew contribute at half strength.
export const SHIELD_REGEN_BONUS = 0.1; // +10% passive shield regeneration each
export const PILOT_EVASION = 0.05; // −5% enemy hit chance each
export const ENGINEER_REPAIR = 3; // hull repaired per jump each

const NAMES = [
  'Ada', 'Bram', 'Cass', 'Dex', 'Eira', 'Finn', 'Gus', 'Hana', 'Ivo', 'Juno',
  'Kai', 'Lena', 'Milo', 'Nia', 'Oren', 'Pia', 'Quin', 'Rhea', 'Sol', 'Tova',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** The ship's crew: who is aboard, what they're assigned to, and how hurt they are. */
export class Crew {
  constructor(onChange) {
    this.onChange = onChange;
    this.nextId = 1;
    this.members = [];
    for (const role of ROLES) this.add(role);
  }

  get count() {
    return this.members.length;
  }

  get isFull() {
    return this.members.length >= MAX_CREW;
  }

  add(role = pick(ROLES)) {
    if (this.isFull) return null;
    const used = new Set(this.members.map((m) => m.name));
    const name = pick(NAMES.filter((n) => !used.has(n)));
    const member = { id: this.nextId++, name, role, status: 'healthy' };
    this.members.push(member);
    this.onChange?.();
    return member;
  }

  /** Healthy → injured; injured → dead (removed). Returns a sentence describing it. */
  injure(member) {
    if (member.status === 'injured') return this.kill(member, 'succumbs to their injuries');
    member.status = 'injured';
    this.onChange?.();
    return `${member.name} (${member.role}) is injured.`;
  }

  kill(member, how = 'is killed') {
    this.members = this.members.filter((m) => m !== member);
    this.onChange?.();
    return `${member.name} (${member.role}) ${how}.`;
  }

  heal(member) {
    member.status = 'healthy';
    this.onChange?.();
  }

  random(filter = () => true) {
    const options = this.members.filter(filter);
    return options.length ? pick(options) : null;
  }

  injureRandom() {
    const member = this.random();
    return member ? this.injure(member) : '';
  }

  cycleRole(id) {
    const member = this.members.find((m) => m.id === id);
    if (!member) return;
    member.role = ROLES[(ROLES.indexOf(member.role) + 1) % ROLES.length];
    this.onChange?.();
  }

  /** Crew strength on a role: healthy members count 1, injured 0.5. */
  strength(role) {
    return this.members
      .filter((m) => m.role === role)
      .reduce((sum, m) => sum + (m.status === 'healthy' ? 1 : 0.5), 0);
  }

  has(role) {
    return this.members.some((m) => m.role === role && m.status === 'healthy');
  }

  get shieldRegenMultiplier() {
    return 1 + SHIELD_REGEN_BONUS * this.strength('Shields');
  }

  get evasion() {
    return PILOT_EVASION * this.strength('Pilot');
  }

  get repairPerJump() {
    return Math.round(ENGINEER_REPAIR * this.strength('Engineer'));
  }
}

const pct = (x) => `${Math.round(x * 100)}%`;

/** Renders the crew side panel and wires role reassignment. */
export class CrewPanel {
  constructor(crew, el) {
    this.crew = crew;
    this.el = el;
    this.list = el.querySelector('#crew-list');
    this.count = el.querySelector('#crew-count');
    this.effects = el.querySelector('#crew-effects');
  }

  render() {
    const { crew } = this;
    this.count.textContent = `${crew.count}/${MAX_CREW}`;
    this.list.replaceChildren(
      ...crew.members.map((m) => {
        const li = document.createElement('li');
        li.className = `crew-member ${m.status}`;
        const dot = document.createElement('span');
        dot.className = 'status-dot';
        dot.title = m.status === 'healthy' ? 'Healthy' : 'Injured';
        const name = document.createElement('span');
        name.className = 'crew-name';
        name.textContent = m.name;
        const status = document.createElement('span');
        status.className = 'crew-status';
        status.textContent = m.status === 'healthy' ? 'OK' : 'Injured';
        const role = document.createElement('button');
        role.type = 'button';
        role.className = `role role-${m.role.toLowerCase()}`;
        role.textContent = m.role;
        role.setAttribute('aria-label', `${m.name}: ${m.role}. Press to reassign.`);
        onPress(role, () => crew.cycleRole(m.id));
        li.append(dot, name, status, role);
        return li;
      })
    );

    const lines = [
      ['Shield regen', `+${pct(crew.shieldRegenMultiplier - 1)}`, crew.strength('Shields') > 0],
      ['Evasion', `+${pct(crew.evasion)}`, crew.strength('Pilot') > 0],
      ['Repairs', `+${crew.repairPerJump} hull/jump`, crew.repairPerJump > 0],
    ];
    this.effects.replaceChildren(
      ...lines.map(([label, value, active]) => {
        const row = document.createElement('div');
        row.className = active ? 'effect' : 'effect inactive';
        row.innerHTML = `<span></span><span></span>`;
        row.children[0].textContent = label;
        row.children[1].textContent = value;
        return row;
      })
    );
  }
}
