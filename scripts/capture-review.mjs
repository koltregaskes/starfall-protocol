// Review captures for Starfall Protocol: the safehouse, insertion, mission, walkthrough
// and both debriefs, at desktop and phone size, plus a DOM dump of the safehouse.
//
// It replaces capture-review.ps1, which needed a helper script that no longer exists
// (..\prepare-starfall-protocol-local.ps1), a python server on port 4304 and a W: path.
// This version opens no port: it builds the game (`npm run build:local`, base "/") and
// answers the headless browser's requests from dist/ by Playwright request routing.
//
// Usage:  npm run capture:review [-- --tag 2026-10-31] [--out review-local/captures]
// Needs Playwright with its Chromium. It is not a dependency of the game; install it
// locally, globally, or point STARFALL_PLAYWRIGHT at an existing playwright package folder.
// Exits non-zero if any page logs an error or fails to load.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const TAG = arg('tag', new Date().toISOString().slice(0, 10));
const OUT = path.resolve(ROOT, arg('out', 'review-local/captures'), TAG);
const ORIGIN = 'http://starfall.test';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const dir = process.env.STARFALL_PLAYWRIGHT
      || path.join(execSync('npm root -g').toString().trim(), 'playwright');
    return import(pathToFileURL(path.join(dir, 'index.mjs')).href);
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary',
};

const SHOTS = [
  ['review-safehouse', '?review=1', 4000],
  ['review-insert', '?review=1&reviewState=insert', 7000],
  ['review-mission', '?autostart=1&review=1', 7000],
  ['review-walkthrough', '?review=1&reviewState=walkthrough', 15000],
  ['review-result-complete', '?review=1&reviewState=complete', 4000],
  ['review-result-failed', '?review=1&reviewState=failed', 4000],
];
const SIZES = [
  ['desktop', { width: 1440, height: 1100 }],
  ['mobile', { width: 390, height: 844 }],
];

console.log('building dist/ (npm run build:local)');
execSync('npm run build:local', { cwd: ROOT, stdio: 'inherit' });
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(OUT, { recursive: true });

const pw = await loadPlaywright();
const chromium = pw.chromium || (pw.default && pw.default.chromium);
const browser = await chromium.launch({
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const problems = [];
try {
  for (const [sizeName, viewport] of SIZES) {
    for (const [name, query, waitMs] of SHOTS) {
      const page = await browser.newPage({ viewport });
      await page.route(`${ORIGIN}/**`, (route) => {
        let p = decodeURIComponent(new URL(route.request().url()).pathname);
        if (p.endsWith('/')) p += 'index.html';
        const file = path.join(DIST, p);
        if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '404' });
        return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' } });
      });
      page.on('pageerror', (e) => problems.push(`${name}-${sizeName}: page error ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`${name}-${sizeName}: console ${m.text().slice(0, 200)}`); });
      page.on('requestfailed', (r) => problems.push(`${name}-${sizeName}: failed ${r.url()}`));
      await page.goto(`${ORIGIN}/${query}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(waitMs);
      const file = path.join(OUT, `${name}-${sizeName}-${TAG}.png`);
      await page.screenshot({ path: file });
      console.log('wrote', path.relative(ROOT, file));
      if (sizeName === 'desktop' && name === 'review-safehouse') {
        const dom = path.join(OUT, `review-safehouse-dom-${TAG}.html`);
        fs.writeFileSync(dom, await page.content());
        console.log('wrote', path.relative(ROOT, dom));
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (problems.length) {
  console.error(`${problems.length} problem(s):\n` + problems.join('\n'));
  process.exit(1);
}
console.log(`done: ${SHOTS.length * SIZES.length} captures and 1 DOM dump in ${path.relative(ROOT, OUT)}`);
