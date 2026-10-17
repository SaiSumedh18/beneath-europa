# Beneath Europa

**Live:** https://saisumedh18.github.io/beneath-europa/

A scroll-driven WebGL story for **Halcyon**, a concept mission to melt through the ice shell of Jupiter's moon Europa and reach the ocean underneath.

Scroll from Jovian orbit to touchdown, then ride a cryobot down through 20 km of ice into a dark, bioluminescent ocean. Live telemetry (altitude, depth, temperature) updates as you go.

> Halcyon is a design concept, not a real mission, and is not affiliated with NASA or ESA. Figures for Europa are published scientific estimates.

## What's in it

- **Procedural planets in GLSL.** Europa and Jupiter are drawn by custom shaders: simplex-noise fBm for ice albedo, ridged noise for the rust-coloured lineae and chaos terrain, turbulent banding and a Great Red Spot for Jupiter. No textures are downloaded.
- **Two scenes, one camera.** A space scene and a depth scene. A white-out "breakthrough" flash hides the swap as the probe enters the ice.
- **Scroll choreography.** Scroll position becomes a continuous story position (chapter + fraction). The camera path, lighting, fog colour, bloom and telemetry are all functions of it.
- **Instancing and GPU particles.** 650 instanced ice shards, meltwater bubbles rising off the probe, and 3,200 bioluminescent particles animated entirely in the vertex shader.
- **Post-processing.** UnrealBloom, with strength and threshold retuned per scene.
- **Smooth scroll.** Lenis wired into GSAP ScrollTrigger so the two never fight.
- **Accessible fallbacks.** Respects `prefers-reduced-motion`, and the story stays readable if WebGL is unavailable.

## Stack

Three.js r128 · GSAP 3.12 + ScrollTrigger · Lenis · UnrealBloomPass · plain HTML/CSS/JS (no build step)

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173.

## Deploy

It is a static site, so drop the folder onto Vercel, Netlify or GitHub Pages as-is.

## Files

- `index.html`: markup and story copy
- `styles.css`: layout, type and HUD
- `main.js`: scenes, shaders, scroll choreography and telemetry
