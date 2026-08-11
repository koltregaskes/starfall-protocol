# Starfall Protocol — Gauntlet Log

Protocol: `W:\repos\_My Games\GAUNTLET.md`.
Bar (camera-matched): **Sable · Neon White · Ghostrunner · Superhot** — stylised
3rd-person, not photoreal. Kol's standard: AAA quality at indie scope.

## Art-direction thesis

Chasing Watch Dogs-grade fidelity in WebGL produces mud — the frame loses on
detail-per-pixel and has nothing left to win on. Starfall wins instead on
**silhouette, palette, contrast, lighting and composition**. Commit to
stylisation; never half-chase realism.

## Shot list

- S1 skiff berth, insertion (player + guards in frame) — `?autostart=1&review=1`
- S2 archive interior *(todo)*
- S3 extraction *(todo)*
- S4 title / front-end *(todo)*

Captured headless at 1280×720 via Playwright + swiftshader.

## Log

| Iter | Verdict | Action |
|---|---|---|
| 0 | **~2/10.** A blockout, not a game. Untextured grey boxes for architecture; flat ambient light with no key or real shadows; no atmosphere; muddy blue-grey palette with no neon identity; arbitrary camera framing; bright **yellow cartoon mascot robots** in a stealth game. HUD typography was the best thing in frame. | Diagnosed the root cause as light flood: `HemisphereLight` 0.78 + `environmentIntensity` 0.45 filled every shadow and destroyed the value range — the same "lit like a product turntable" finding Nitro hit at its iteration 2, so it cleared the two-round repeated-signal rule immediately. |
| 1 | **Partial.** Panel detail and value range landed, but two regressions: bloom blew out into a white blob that ate the frame, and the hostile re-skin caught *most* of the mascot so guards glowed **pink** — worse than yellow. Chromatic aberration fringed visibly. | Bloom threshold 0.72→0.98, strength 0.62→0.34. Hostile luminance threshold 0.34→0.72 and emissive 1.5→0.55, so only a visor-sized area glows. Aberration 0.0016→0.0007. |
| 2 | **~4/10.** Both regressions cleared. Guards read as dark armoured threats; bloom is a halo on real light sources only; deck and wall panelling catch the raking key; genuine darks and lights coexist. | Remaining gaps ranked below. |

## Ranked gaps (next iteration)

1. **Architecture is still boxes.** Needs modular sci-fi forms — greebled hull
   sections, gantries, pipe runs, recessed bays — not `BoxGeometry` slabs.
2. **World density is thin.** Big empty deck; needs set dressing, crates,
   cabling, signage, mid-ground occluders for depth layering.
3. **Composition is arbitrary.** Camera should frame the objective with
   foreground occlusion and leading lines.
4. **Palette is cyan-monotone.** The warm complementary accent survives in only
   one corner; it needs to be a deliberate, repeated second note.
5. **Player silhouette is tonally off** — a beige/tan soldier in a neon
   stealth game. Needs a dark suit with a signature emissive trim.

## Systems implemented (for the critic's "which of these REGISTER?" question)

Raking 24° key with 2048 shadow map · suppressed ambient/IBL flood · directional
rim for silhouette separation · warm complementary point fill · procedural panel
roughness + normal maps on deck and walls · UnrealBloom (high threshold) ·
cinematic grade pass (filmic contrast, cool-shadow/warm-highlight split tone,
vignette, chromatic aberration, animated grain) · hostile re-skin.
