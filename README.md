# SPCE

A minimal Three.js space scene (loaded from CDN via an import map — no build step).

- Star particle field on a black background
- Planet with a fresnel atmosphere and a glowing ring
- Low-poly spaceship facing the planet
- HTML HUD overlay: Hull, Fuel, Scrap

## Run

ES modules need to be served over HTTP:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.
