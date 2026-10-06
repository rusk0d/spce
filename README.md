# SPCE

A minimal Three.js space scene (loaded from CDN via an import map — no build step).

- Star particle field on a black background
- Planet with a fresnel atmosphere and a glowing ring
- Low-poly spaceship facing the planet
- HTML HUD overlay: Hull, Fuel, Scrap, current system
- Galaxy map (press **M**): a procedurally generated graph of 5–8 connected star
  systems. Click a system linked to your current one to jump there — the ship
  flies the hyperlane, 1 Fuel is spent, and the planet in the main view changes
  to that system's planet. Press **M** again to return.
- Pirate encounters: each jump has a 40% chance of a pirate ambush. The fight is
  turn-based — press **Attack** to fire a red laser at the raider (85% hit
  chance, 14–24 damage against 60 HP); it answers with a green laser (8–16
  hull damage). Destroying it salvages 15–30 Scrap; if your Hull reaches 0 it's
  Game Over, and **Restart** starts a fresh galaxy.

## Layout

- `src/main.js` — scene, planet, game state, camera transitions, input
- `src/galaxy.js` — galaxy graph generation and the 3D map view
- `src/combat.js` — pirate encounter: turn logic, lasers, hit flashes, explosions
- `src/ship.js` — low-poly player ship and pirate raider meshes
- `src/textures.js` — shared glow sprite texture

## Run

ES modules need to be served over HTTP:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.
