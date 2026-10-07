/**
 * Star-node crew events. Each event offers one or more choices; a choice's
 * run(ctx) applies its effects and returns the outcome text to show.
 * `available(ctx)` (optional) greys a choice out with a reason.
 *
 * ctx = { crew, state, hazard } — hazard (0 in sector 1, rising each sector)
 * makes mishaps more likely.
 */
const chance = (p) => Math.random() < p;

export const CREW_EVENTS = [
  {
    title: 'Drifting Escape Pod',
    text: 'Sensors pick up a single life sign aboard a battered escape pod.',
    weight: 3,
    choices: [
      {
        label: 'Bring them aboard',
        available: ({ crew }) => (crew.isFull ? 'Crew quarters are full' : null),
        run: ({ crew }) => {
          const m = crew.add();
          return `${m.name} is grateful for the rescue and joins your crew as ${m.role}.`;
        },
      },
      { label: 'Leave it', run: () => 'You log the pod’s position and move on.' },
    ],
  },
  {
    title: 'Coolant Leak',
    text: 'A coolant line ruptures in the engine room, venting freezing vapour.',
    weight: 3,
    choices: [
      {
        label: 'Seal the leak',
        run: ({ crew, hazard }) => {
          if (crew.has('Engineer') && chance(0.6 - hazard)) {
            return 'Your engineer clamps the line before anyone is hurt.';
          }
          return `The leak is sealed, but not cleanly. ${crew.injureRandom()}`;
        },
      },
    ],
  },
  {
    title: 'Boarding Party',
    text: 'Scavengers latch onto your hull and start cutting through the airlock.',
    weight: 2,
    choices: [
      {
        label: 'Fight them off',
        run: ({ crew, hazard }) => {
          const roll = Math.random() + hazard;
          if (roll < 0.35) return 'Your crew drives the scavengers back without a scratch.';
          const victim = crew.random();
          if (!victim) return 'The scavengers find nothing worth taking.';
          if (roll < 0.75) return `The scavengers retreat. ${crew.injure(victim)}`;
          return `The scavengers retreat, but ${crew.kill(victim, 'is lost in the fighting').replace(/\.$/, '')}.`;
        },
      },
      {
        label: 'Pay them off (10 scrap)',
        available: ({ state }) => (state.scrap < 10 ? 'Not enough scrap' : null),
        run: ({ state }) => {
          state.scrap -= 10;
          return 'The scavengers take the scrap and detach.';
        },
      },
    ],
  },
  {
    title: 'Medical Outpost',
    text: 'A small clinic station offers to treat any wounded aboard.',
    weight: 2,
    choices: [
      {
        label: 'Dock for treatment',
        run: ({ crew }) => {
          const injured = crew.members.filter((m) => m.status === 'injured');
          if (!injured.length) return 'Your crew is already fit for duty. The medics wave you off.';
          injured.forEach((m) => crew.heal(m));
          return `${injured.map((m) => m.name).join(', ')} ${injured.length > 1 ? 'are' : 'is'} patched up and back on duty.`;
        },
      },
    ],
  },
  {
    title: 'Dockside Volunteer',
    text: 'A spacer at the station bar asks to sign on with your ship.',
    weight: 2,
    choices: [
      {
        label: 'Hire them (5 scrap)',
        available: ({ crew, state }) =>
          crew.isFull ? 'Crew quarters are full' : state.scrap < 5 ? 'Not enough scrap' : null,
        run: ({ crew, state }) => {
          state.scrap -= 5;
          const m = crew.add();
          return `${m.name} signs on as ${m.role}.`;
        },
      },
      { label: 'Decline', run: () => 'You finish your drink and head back to the ship.' },
    ],
  },
  {
    title: 'Space Fever',
    text: 'A fever spreads through the crew quarters after a stop at a quarantine buoy.',
    weight: 1,
    choices: [
      {
        label: 'Quarantine the sick',
        run: ({ crew, hazard }) => {
          const injured = crew.random((m) => m.status === 'injured');
          if (injured && chance(0.4 + hazard)) return crew.kill(injured, 'succumbs to the fever');
          const healthy = crew.random((m) => m.status === 'healthy');
          return healthy ? crew.injure(healthy) : 'The fever passes without further harm.';
        },
      },
    ],
  },
];

export function pickCrewEvent() {
  const total = CREW_EVENTS.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const event of CREW_EVENTS) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return CREW_EVENTS[0];
}
