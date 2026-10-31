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

- `npm ci` (or `npm install`)
- `npm run dev`: starts Vite and prints the local URL to open (Vite's default is `http://localhost:5173/`)
- `npm run build`: type-checks and builds `dist/` for GitHub Pages (base `/starfall-protocol/`)
- `npm run build:local`: the same build with base `/`, for local review
- `npm run preview`: serves the last build and prints its URL
- `npm test`: headless tests of the mission simulation (Node 22.18 or later, no browser)
- `npm run capture:review`: review captures (see below)

GitHub Pages deploys the built `dist/` output through [.github/workflows/deploy.yml](./.github/workflows/deploy.yml) on every push to `main`. Pull requests run the build and tests only ([.github/workflows/ci.yml](./.github/workflows/ci.yml)).

## Review Flow

Add these to the address `npm run dev` or `npm run preview` prints:

- Safehouse review state: `?review=1`
- Insertion review state: `?review=1&reviewState=insert`
- Walkthrough review state: `?review=1&reviewState=walkthrough`
- Fast-entry mission review state: `?autostart=1&review=1`
- Complete debrief review state: `?review=1&reviewState=complete`
- Failed debrief review state: `?review=1&reviewState=failed`
- One-shot evidence refresh: `npm run capture:review -- --tag 2026-10-31` builds with base `/`, opens every review state headless at desktop and phone size with no local server or port (Playwright serves `dist/` by request routing), and writes the PNGs and a DOM dump to `review-local/captures/<tag>/` (git-ignored). It needs Playwright with Chromium installed locally or globally, or `STARFALL_PLAYWRIGHT` set to a playwright package folder, and it fails if any page logs an error.
- Recommended headless WebGL flags: `--enable-webgl --ignore-gpu-blocklist --use-angle=swiftshader --enable-unsafe-swiftshader --run-all-compositor-stages-before-draw`

`review=1` ignores normal browser save data and boots a fixed profile so the safehouse board, autostart mission, and seeded debrief states are deterministic for verification.
