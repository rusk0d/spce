# SPCE

A minimal Three.js space scene (loaded from CDN via an import map — no build step).

- Star particle field on a black background
- Planet with a fresnel atmosphere and a glowing ring
- Low-poly spaceship facing the planet
- HTML HUD overlay: Hull, Fuel, Scrap, current system
- Galaxy map (press **M** or the **Galaxy Map** button): each **sector** is an
  FTL-style route that runs left to right, from your start on the far left to
  the **Hyperdrive Gate** on the far right.
  - 5–6 columns of 1–3 nodes each; 2–7 nodes are **planets** (the start is
    always one) and the rest are open-space **anomalies** (ion storms, nebulae,
    asteroid belts… — no planet in the ship view).
  - Hyperlanes only join nearby nodes in the *next* column and never cross, so
    there's no backtracking, every node is reachable, and every route leads to
    the gate (no dead ends).
  - Click/tap a linked system ahead of you to jump there (−1 Fuel). Reaching
    the Hyperdrive Gate offers the jump to the next sector, which generates a
    fresh map; the HUD shows the current sector.
- Pirate encounters: each jump has a 40% chance of a pirate ambush. The fight is
  turn-based — press **Attack** to fire a red laser at the raider (85% hit
  chance, 14–24 damage against 60 HP); it answers with a green laser (8–16
  hull damage). Destroying it salvages 15–30 Scrap; if your Hull reaches 0 it's
  Game Over, and **Restart** starts a fresh galaxy.

- Crew: you start with three crew (Pilot, Engineer, Shields), shown in the crew
  panel (top-right, or behind the **Crew** button on small screens). Tap/click
  a role to reassign it. Each crew member on a role adds a bonus (injured crew
  count half):
  - **Shields** — +10% passive shield regeneration
  - **Pilot** — −5% pirate hit chance
  - **Engineer** — +3 hull repaired per jump
- Shields (max 40) absorb pirate damage before the hull and regenerate
  passively based on Shields power (see below), scaled by the crew bonus.
  Hull hits can injure a crew member; an injured member hit again is lost.
- Star-node events: arriving without pirates may trigger an event (escape pod,
  coolant leak, boarding party, medical outpost, volunteer, space fever) where
  crew can be injured, lost, healed or recruited (up to 6). Injured crew may
  also recover on their own between jumps.
- Game Over when the hull is destroyed **or** the whole crew is lost.
- Weapons & reactor power: the reactor has 4 power bars to split between
  **Weapons**, **Shields** and **Engines** (up to 3 each). Tap a bar to power a
  system up to it (or tap a lit bar to power down), or use − / +. The grid sits
  under the HUD on desktop, behind the **Power** button on small screens, and
  inside the combat panel during fights; power can be moved at any time.
  - Weapons: 1 bar = **Laser** (fast: 2 bolts × 6–10 dmg), 2 bars = also the
    **Missile Launcher** (slow: one 26–34 dmg missile, 95% hit, uses 1 missile,
    then reloads for a turn), 3 bars = overcharged laser (+3 dmg per bolt).
    Start with 4 missiles; stations sell more.
  - Shields: passive regen of 3 per combat turn and 6 per jump, per bar
    (0 bars = no regen), still boosted +10% per Shields crew member.
  - Engines: +6% evasion per bar; with 0 bars the ship can't jump.
- Space stations: 1–2 planets per sector (one in the first couple of columns)
  are friendly stations, marked on the map with a gold diamond and a
  STATION tag. Docking is safe (no pirates or crew events) and opens the
  **Sector Shop**; reopen it with the **Shop** button while docked:
  - Fuel Cell — 3 scrap for +1 Fuel
  - Hull Repair — 5 scrap for +10 Hull (up to max)
  - Missile — 6 scrap for +1 missile ammo
  - Reactor Upgrade — 50 scrap to permanently raise max Shields by 1

## Mobile

- Works on touch screens: buttons and map systems respond on `pointerdown`
  (no tap delay), and keyboard Enter/Space still activates buttons.
- Tap a system's star or its label to jump; taps are matched to the nearest
  star within a finger-sized radius.
- Swipe left/right in the ship view (or drag with a mouse) to orbit the camera
  around the ship. Swipe movement is consumed in small, throttled steps and
  eased, and the orbit is limited to about ±50°.
- The layout scales with screen size: fluid type, a two-row HUD on narrow
  phones, side-docked combat and map controls in landscape, safe-area insets,
  and a camera that pulls back on portrait screens to keep scenes in frame.
  Map labels are placed to avoid overlapping each other or leaving the screen.

## Layout

- `src/main.js` — scene, planet, game state, camera transitions, input
- `src/galaxy.js` — sector route generation (columns, forward hyperlanes,
  planets/anomalies/gate, stations) and the 3D map view
- `src/crew.js` — crew model, role bonuses and the crew panel
- `src/events.js` — star-node crew events
- `src/shop.js` — Sector Shop catalogue and panel
- `src/power.js` — reactor power grid model and power allocation panel
- `src/combat.js` — pirate encounter: turn logic, laser & missile weapons, effects
- `src/ship.js` — low-poly player ship, pirate raider and space station meshes
- `src/textures.js` — shared glow sprite texture
- `src/input.js` — press-on-pointerdown buttons and throttled swipe tracking

## Run

ES modules need to be served over HTTP:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.
