# Starfall Protocol

`Starfall Protocol` is now a browser-playable preproduction repo for a third-person cyberpunk infiltration game.

The long-horizon production direction still lives in [DESIGN-BIBLE.md](./DESIGN-BIBLE.md), but the repo now hosts an actual Three.js mission slice instead of only a concept surface.

## Current state

- `Three.js + TypeScript + Vite` browser prototype
- contained orbital-dock infiltration demo with Phase 2 safehouse scaffolding
- third-person movement, stealth pressure, breach interaction, combat beat, extraction finish
- selectable contract profiles and loadout packages that change mission pressure and operator feel
- persistent local career log with contract records, consequence reports, and remembered staging selections
- permanent operator skill lattice across infiltration, combat, cyberwarfare, and mobility
- campaign pressure layer that tracks Black Glass heat, evacuation-lane stability, and safehouse exposure
- low-chrome HUD, title framing, and synthesized ambience/SFX

## Controls

- `WASD`: move
- `Shift`: sprint
- `Q`: scan
- `E`: interact / hold to breach or extract
- `F`: fire pulse carbine
- `Esc`: pause
- `Tab` or `I`: intel drawer

## Development

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run build:local`
- `npm run capture:review`
- `npm run preview`

GitHub Pages now deploys the built `dist/` output through the workflow in [.github/workflows/deploy.yml](./.github/workflows/deploy.yml).

## Review Flow

- Safehouse review state: `http://127.0.0.1:4304/?review=1`
- Insertion review state: `http://127.0.0.1:4304/?review=1&reviewState=insert`
- Walkthrough review state: `http://127.0.0.1:4304/?review=1&reviewState=walkthrough`
- Fast-entry mission review state: `http://127.0.0.1:4304/?autostart=1&review=1`
- Complete debrief review state: `http://127.0.0.1:4304/?review=1&reviewState=complete`
- Failed debrief review state: `http://127.0.0.1:4304/?review=1&reviewState=failed`
- Local cached-build launch: `powershell -File ..\prepare-starfall-protocol-local.ps1 -Serve -Port 4304`
- One-shot evidence refresh: `npm run capture:review -- -CaptureTag 2026-04-09`
- Recommended headless WebGL flags: `--enable-webgl --ignore-gpu-blocklist --use-angle=swiftshader --enable-unsafe-swiftshader --run-all-compositor-stages-before-draw`

`review=1` ignores normal browser save data and boots a fixed profile so the safehouse board, autostart mission, and seeded debrief states are deterministic for verification.

## Playable session regression

With Node 24 or later, run `node tests/playable-session.mjs`. No packages or browser are required.
The check starts the default mission with no unlocked skills, walks around the real obstacles,
stabilizes insertion, scans, breaches, collects the core, defeats the lockdown enemies, and extracts.
It drives normal keyboard-shaped inputs without changing player position, health, facing, enemies,
or mission flags. A bounded route planner chooses the movement path; this checks reachability and
the complete objective chain, rather than human difficulty or browser presentation.
The Playable session workflow runs it on every push and pull request.
