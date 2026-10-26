# Starfall Protocol

Starfall Protocol is a browser game. The whole game is the Aurelion Gate campaign: Ghost Signal, Storm Window, and Cinder Vector, in that order.

You win when the skiff clears the storm gate at the end of Cinder Vector. You lose the session if your vitals or the skiff hull hit zero before that gate is open. The safehouse board states those rules before the first deploy. The design is written out in [DESIGN-BIBLE.md](./DESIGN-BIBLE.md).

## Play

- `npm install`
- `npm run dev`
- Open the URL Vite prints, including the `/starfall-protocol/` base path.

Deploy Ghost Signal from the safehouse. Clear it, continue into Storm Window, then continue into Cinder Vector and fly into the blue gate.

## Controls

- `WASD`: move. On Cinder Vector this flies the skiff.
- `Shift`: sprint on foot
- `Q`: scan the overlook
- `E`: hold to insert, breach, secure the seed, or extract
- `F`: fire
- `Esc`: pause
- `Tab` or `I`: intel drawer

## Development

- `npm run build`
- `npm run build:local`
- `npm run preview`
- `npm run capture:review`

GitHub Pages deploys the built `dist/` output through [.github/workflows/deploy.yml](./.github/workflows/deploy.yml).

## Review routes

These URLs seed a fixed profile for layout checks. They do not play the campaign and a seeded debrief is not a win.

- Safehouse: `http://127.0.0.1:4304/starfall-protocol/?review=1`
- Insertion: `http://127.0.0.1:4304/starfall-protocol/?review=1&reviewState=insert`
- Walkthrough: `http://127.0.0.1:4304/starfall-protocol/?review=1&reviewState=walkthrough`
- Fast-entry mission: `http://127.0.0.1:4304/starfall-protocol/?autostart=1&review=1`
- Seeded complete debrief: `http://127.0.0.1:4304/starfall-protocol/?review=1&reviewState=complete`
- Seeded failed debrief: `http://127.0.0.1:4304/starfall-protocol/?review=1&reviewState=failed`

`review=1` ignores the normal browser save. Recommended headless WebGL flags: `--enable-webgl --ignore-gpu-blocklist --use-angle=swiftshader --enable-unsafe-swiftshader --run-all-compositor-stages-before-draw`.
