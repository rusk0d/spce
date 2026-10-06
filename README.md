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

## Layout

- `src/main.js` — scene, planet, game state, camera transitions, input
- `src/galaxy.js` — galaxy graph generation and the 3D map view
- `src/ship.js` — low-poly ship mesh (used in both views)

## Run

ES modules need to be served over HTTP:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.
