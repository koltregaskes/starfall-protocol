/**
 * Art-direction toolkit: procedural surface detail + a cinematic grade pass.
 *
 * The gauntlet's core finding (see W:\repos\_My Games\GAUNTLET.md) is that AAA
 * quality at indie scope comes from art direction, not asset budget. Two things
 * do most of the work here:
 *
 *  1. Surfaces must have detail that CATCHES LIGHT. Flat-coloured boxes read as
 *     a blockout no matter how good the lighting is, because there is nothing
 *     for a highlight to break across. These textures are generated at runtime
 *     (no asset downloads, nothing to license).
 *  2. The raw render must be GRADED. Games look "designed" because of contrast
 *     shaping, colour separation between lights and shadows, vignette, grain and
 *     a touch of chromatic aberration - not because of more polygons.
 */

import * as THREE from "three";

/** Shared canvas helper - returns a 2D context sized for a tiling texture. */
function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for procedural texture");
  return { canvas, ctx };
}

/** Deterministic pseudo-random so the look is identical every run (gauntlet needs stable shots). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Sci-fi panelling: recessed seams, bolts, wear streaks and grime blotches.
 * Used as a roughness map so panels break up specular highlights, which is what
 * actually sells "manufactured surface" under a raking key light.
 */
export function makePanelRoughness(size = 512, seed = 7): THREE.Texture {
  const { canvas, ctx } = makeCanvas(size);
  const rnd = seeded(seed);

  // Base roughness - mid grey, so the material's own roughness stays in control.
  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(0, 0, size, size);

  // Large grime blotches: broad low-frequency variation stops it looking tiled.
  for (let i = 0; i < 26; i += 1) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = size * (0.06 + rnd() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() > 0.5;
    g.addColorStop(0, dark ? "rgba(150,150,150,0.5)" : "rgba(60,60,60,0.42)");
    g.addColorStop(1, "rgba(128,128,128,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Panel seams: darker (smoother) recessed lines catch a different specular.
  const cell = size / 4;
  ctx.strokeStyle = "rgba(38,38,38,0.85)";
  ctx.lineWidth = Math.max(2, size / 220);
  for (let i = 0; i <= 4; i += 1) {
    const p = i * cell;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }
  // Sub-panel detail on a subset of cells - variety without noise.
  ctx.lineWidth = Math.max(1, size / 400);
  ctx.strokeStyle = "rgba(58,58,58,0.6)";
  for (let cx = 0; cx < 4; cx += 1) {
    for (let cy = 0; cy < 4; cy += 1) {
      if (rnd() > 0.55) continue;
      const inset = cell * (0.12 + rnd() * 0.2);
      ctx.strokeRect(cx * cell + inset, cy * cell + inset, cell - inset * 2, cell - inset * 2);
    }
  }

  // Bolts: tiny bright (rough) dots at seam intersections.
  ctx.fillStyle = "rgba(196,196,196,0.75)";
  const bolt = Math.max(1.5, size / 260);
  for (let i = 0; i <= 4; i += 1) {
    for (let j = 0; j <= 4; j += 1) {
      if (rnd() > 0.62) continue;
      ctx.beginPath();
      ctx.arc(i * cell, j * cell, bolt, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Vertical wear streaks - reads as run-off/age, a classic sci-fi grounding cue.
  for (let i = 0; i < 34; i += 1) {
    const x = rnd() * size;
    const y = rnd() * size;
    const h = size * (0.08 + rnd() * 0.3);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "rgba(72,72,72,0.30)");
    g.addColorStop(1, "rgba(128,128,128,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, Math.max(1, size / 300) * (1 + rnd() * 2.4), h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/**
 * A matching normal map derived from the same panel layout, so seams read as
 * actual geometry relief rather than a painted-on line.
 */
export function makePanelNormal(size = 512, seed = 7): THREE.Texture {
  const { canvas, ctx } = makeCanvas(size);
  const rnd = seeded(seed);

  // Flat normal (pointing straight out) = (0.5, 0.5, 1.0).
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  const cell = size / 4;
  const lw = Math.max(2, size / 200);

  // Each seam gets a light/dark pair, which tilts the normal into a groove.
  for (let i = 0; i <= 4; i += 1) {
    const p = i * cell;
    ctx.lineWidth = lw;
    // vertical seam: shift the red channel either side
    ctx.strokeStyle = "#a080ff";
    ctx.beginPath(); ctx.moveTo(p - lw * 0.5, 0); ctx.lineTo(p - lw * 0.5, size); ctx.stroke();
    ctx.strokeStyle = "#6080ff";
    ctx.beginPath(); ctx.moveTo(p + lw * 0.5, 0); ctx.lineTo(p + lw * 0.5, size); ctx.stroke();
    // horizontal seam: shift the green channel either side
    ctx.strokeStyle = "#80a0ff";
    ctx.beginPath(); ctx.moveTo(0, p - lw * 0.5); ctx.lineTo(size, p - lw * 0.5); ctx.stroke();
    ctx.strokeStyle = "#8060ff";
    ctx.beginPath(); ctx.moveTo(0, p + lw * 0.5); ctx.lineTo(size, p + lw * 0.5); ctx.stroke();
  }

  // Scattered rivets as small bumps.
  for (let i = 0; i < 90; i += 1) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = Math.max(1.5, size / 200) * (0.6 + rnd());
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, "#a89aff");
    g.addColorStop(1, "#6070ff");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Cinematic grade: filmic contrast, cool-shadow/warm-highlight split toning,
 * vignette, chromatic aberration and animated grain.
 *
 * This is the single cheapest "looks like a real game" pass available - it costs
 * one fullscreen shader and changes the read of every frame.
 */
export const CinematicGradeShader = {
  name: "CinematicGradeShader",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    contrast: { value: 1.18 },
    saturation: { value: 1.12 },
    lift: { value: 0.012 },
    shadowTint: { value: new THREE.Color("#2b4c78") },
    highlightTint: { value: new THREE.Color("#ffd9b0") },
    tintStrength: { value: 0.26 },
    vignette: { value: 0.42 },
    aberration: { value: 0.0007 },
    grain: { value: 0.035 },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    uniform float lift;
    uniform vec3 shadowTint;
    uniform vec3 highlightTint;
    uniform float tintStrength;
    uniform float vignette;
    uniform float aberration;
    uniform float grain;
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);

      // Chromatic aberration: sample RGB with a radial offset that grows toward
      // the edges, which mimics a real lens and hides the flat digital look.
      vec2 off = centered * aberration * (0.35 + r2 * 2.2);
      vec3 color;
      color.r = texture2D(tDiffuse, vUv + off).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv - off).b;

      // Filmic contrast around mid grey, plus a small shadow lift so blacks
      // read as photographed rather than clipped.
      color = (color - 0.5) * contrast + 0.5;
      color = color + lift * (1.0 - color);

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

      // Split tone: push shadows cool and highlights warm. This colour
      // SEPARATION is what stops a scene reading as one flat wash.
      vec3 tint = mix(shadowTint, highlightTint, smoothstep(0.15, 0.85, luma));
      color = mix(color, color * tint * 2.0, tintStrength);

      // Saturation around the (re-derived) luma.
      luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);

      // Vignette - focuses the eye and adds depth.
      color *= 1.0 - vignette * smoothstep(0.15, 0.78, r2);

      // Animated grain, strongest in the shadows where sensors are noisiest.
      float n = hash(vUv * 850.0 + fract(time) * 97.0) - 0.5;
      color += n * grain * (1.0 - smoothstep(0.0, 0.75, luma));

      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};
