const briefs = [
  {
    title: "Ghost Signal at Aurelion Gate",
    body: "Board a torn-open transit fortress, recover the navigation seed, and escape before the station folds into the atmosphere below.",
    tone: "Cold precision",
    threat: "Synthetic guardians",
    extraction: "Hull breach skydive",
  },
  {
    title: "Black Ice on Meridian Halo",
    body: "Drop into a drifting climate ring, secure the atmospheric core, and hold the rail line long enough for civilian lifts to clear.",
    tone: "Holding action",
    threat: "Railgun interceptors",
    extraction: "Mag-rail burn",
  },
  {
    title: "Wakefall Beneath Nysa",
    body: "Descend through a dead orbital cathedral, retrieve the archive spine, and outrun the gravity shear tearing the station apart.",
    tone: "Desperate salvage",
    threat: "Fanatic scavenger cells",
    extraction: "Thruster pod plunge",
  },
];

const elements = {
  title: document.getElementById("briefTitle"),
  body: document.getElementById("briefBody"),
  tone: document.getElementById("briefTone"),
  threat: document.getElementById("briefThreat"),
  extraction: document.getElementById("briefExtraction"),
  button: document.getElementById("cycleBriefButton"),
  focusButton: document.getElementById("focusHotspotButton"),
  zoneName: document.getElementById("zoneName"),
  hotspotName: document.getElementById("hotspotName"),
  hotspotDetail: document.getElementById("hotspotDetail"),
};

let currentBrief = 0;

function applyBrief(index) {
  const brief = briefs[index];
  elements.title.textContent = brief.title;
  elements.body.textContent = brief.body;
  elements.tone.textContent = brief.tone;
  elements.threat.textContent = brief.threat;
  elements.extraction.textContent = brief.extraction;
}

elements.button.addEventListener("click", () => {
  currentBrief = (currentBrief + 1) % briefs.length;
  applyBrief(currentBrief);
});

applyBrief(currentBrief);

const starCanvas = document.getElementById("starfield");
const starContext = starCanvas.getContext("2d");
const stars = Array.from({ length: 160 }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: Math.random() * 0.8 + 0.2,
}));

function resizeCanvas() {
  starCanvas.width = window.innerWidth;
  starCanvas.height = window.innerHeight;
}

function drawStarfield() {
  starContext.clearRect(0, 0, starCanvas.width, starCanvas.height);

  const gradient = starContext.createLinearGradient(0, 0, 0, starCanvas.height);
  gradient.addColorStop(0, "rgba(16, 29, 54, 0.45)");
  gradient.addColorStop(1, "rgba(2, 4, 10, 0.65)");
  starContext.fillStyle = gradient;
  starContext.fillRect(0, 0, starCanvas.width, starCanvas.height);

  for (const star of stars) {
    const x = star.x * starCanvas.width;
    const y = star.y * starCanvas.height;
    const radius = star.z * 2.4;
    starContext.fillStyle = `rgba(182, 227, 255, ${0.3 + star.z * 0.5})`;
    starContext.beginPath();
    starContext.arc(x, y, radius, 0, Math.PI * 2);
    starContext.fill();

    star.y += 0.0006 * star.z;
    if (star.y > 1.02) {
      star.y = -0.02;
      star.x = Math.random();
    }
  }

  requestAnimationFrame(drawStarfield);
}

const dockCanvas = document.getElementById("dockCanvas");
const dockContext = dockCanvas.getContext("2d");
const keys = new Set();
const hotspots = [
  { x: 265, y: 510, r: 56, title: "Breach Door", detail: "Mag-sealed entry point to the lower archive. This is where the first proper combat breach would begin." },
  { x: 615, y: 452, r: 64, title: "Ops Terminal", detail: "A live tactical console for squad telemetry, route control, and system scans." },
  { x: 930, y: 266, r: 68, title: "Observation Glass", detail: "A view across the ring to the storm-wrapped planet below. This is the mood anchor for the room." },
  { x: 845, y: 570, r: 54, title: "Salvage Cradle", detail: "Recovered cores, cargo frames, and mission loot staging point." },
];

const player = { x: 520, y: 530, angle: -0.2 };
let focusedHotspot = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawDock() {
  dockContext.clearRect(0, 0, dockCanvas.width, dockCanvas.height);

  const bg = dockContext.createLinearGradient(0, 0, 0, dockCanvas.height);
  bg.addColorStop(0, "#081120");
  bg.addColorStop(1, "#03070f");
  dockContext.fillStyle = bg;
  dockContext.fillRect(0, 0, dockCanvas.width, dockCanvas.height);

  dockContext.fillStyle = "#0b1628";
  dockContext.beginPath();
  dockContext.moveTo(90, 120);
  dockContext.lineTo(1030, 120);
  dockContext.lineTo(1100, 210);
  dockContext.lineTo(1100, 610);
  dockContext.lineTo(980, 650);
  dockContext.lineTo(160, 650);
  dockContext.lineTo(90, 560);
  dockContext.closePath();
  dockContext.fill();

  dockContext.strokeStyle = "rgba(138, 198, 255, 0.16)";
  dockContext.lineWidth = 2;
  for (let x = 140; x <= 1030; x += 92) {
    dockContext.beginPath();
    dockContext.moveTo(x, 152);
    dockContext.lineTo(x, 620);
    dockContext.stroke();
  }
  for (let y = 170; y <= 605; y += 78) {
    dockContext.beginPath();
    dockContext.moveTo(120, y);
    dockContext.lineTo(1070, y);
    dockContext.stroke();
  }

  dockContext.fillStyle = "#0e243a";
  dockContext.fillRect(770, 160, 220, 180);
  dockContext.fillStyle = "#152c44";
  dockContext.fillRect(786, 176, 188, 148);
  dockContext.fillStyle = "#7bb7ff";
  dockContext.fillRect(810, 204, 140, 92);
  dockContext.fillStyle = "#22364a";
  dockContext.fillRect(120, 420, 180, 134);
  dockContext.fillRect(350, 190, 150, 106);
  dockContext.fillRect(760, 480, 160, 116);
  dockContext.fillRect(550, 380, 130, 96);

  dockContext.fillStyle = "#1a3149";
  for (let i = 0; i < 4; i += 1) {
    dockContext.fillRect(365 + i * 34, 206, 20, 72);
  }

  dockContext.strokeStyle = "rgba(81, 246, 255, 0.55)";
  dockContext.lineWidth = 4;
  dockContext.strokeRect(212, 470, 106, 84);
  dockContext.strokeRect(573, 402, 84, 62);
  dockContext.strokeRect(786, 480, 128, 94);

  dockContext.fillStyle = "#091728";
  dockContext.fillRect(530, 120, 110, 560);
  dockContext.fillStyle = "#1f9ab5";
  dockContext.fillRect(580, 120, 8, 560);

  hotspots.forEach((hotspot, index) => {
    const active = index === focusedHotspot;
    dockContext.strokeStyle = active ? "rgba(255, 202, 120, 0.95)" : "rgba(103, 224, 255, 0.65)";
    dockContext.lineWidth = active ? 4 : 2;
    dockContext.beginPath();
    dockContext.arc(hotspot.x, hotspot.y, hotspot.r, 0, Math.PI * 2);
    dockContext.stroke();
  });

  dockContext.fillStyle = "#52b7ff";
  dockContext.beginPath();
  dockContext.arc(935, 250, 44, 0, Math.PI * 2);
  dockContext.fill();
  dockContext.fillStyle = "#101f34";
  dockContext.beginPath();
  dockContext.arc(948, 236, 12, 0, Math.PI * 2);
  dockContext.fill();

  dockContext.save();
  dockContext.translate(player.x, player.y);
  dockContext.rotate(player.angle);
  dockContext.fillStyle = "#f5f7ff";
  dockContext.beginPath();
  dockContext.moveTo(22, 0);
  dockContext.lineTo(-16, -14);
  dockContext.lineTo(-10, 0);
  dockContext.lineTo(-16, 14);
  dockContext.closePath();
  dockContext.fill();
  dockContext.fillStyle = "#7dd7ff";
  dockContext.fillRect(-18, -7, 16, 14);
  dockContext.restore();
}

function updateDemo() {
  const moveX = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
  const moveY = (keys.has("s") ? 1 : 0) - (keys.has("w") ? 1 : 0);
  const sprint = keys.has("shift");
  const length = Math.hypot(moveX, moveY) || 1;
  const speed = sprint ? 4.4 : 2.7;

  if (moveX || moveY) {
    player.x = clamp(player.x + (moveX / length) * speed, 124, 1050);
    player.y = clamp(player.y + (moveY / length) * speed, 146, 620);
    player.angle = Math.atan2(moveY, moveX);
  }

  let bestIndex = 0;
  let bestDistance = Infinity;
  hotspots.forEach((hotspot, index) => {
    const distance = Math.hypot(player.x - hotspot.x, player.y - hotspot.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  if (bestDistance < 120) {
    focusedHotspot = bestIndex;
  }

  const active = hotspots[focusedHotspot];
  elements.hotspotName.textContent = active.title;
  elements.hotspotDetail.textContent = active.detail;
  elements.zoneName.textContent = player.x > 700 ? "Aurelion Dock // Observation Wing" : "Aurelion Dock // Hangar Spine";

  drawDock();
  requestAnimationFrame(updateDemo);
}

elements.focusButton.addEventListener("click", () => {
  focusedHotspot = (focusedHotspot + 1) % hotspots.length;
});

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key.toLowerCase() === "e") {
    focusedHotspot = (focusedHotspot + 1) % hotspots.length;
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
drawStarfield();
drawDock();
updateDemo();
