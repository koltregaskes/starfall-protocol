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

const canvas = document.getElementById("starfield");
const context = canvas.getContext("2d");
const stars = Array.from({ length: 160 }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: Math.random() * 0.8 + 0.2,
}));

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function drawStarfield() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(16, 29, 54, 0.45)");
  gradient.addColorStop(1, "rgba(2, 4, 10, 0.65)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of stars) {
    const x = star.x * canvas.width;
    const y = star.y * canvas.height;
    const radius = star.z * 2.4;
    context.fillStyle = `rgba(182, 227, 255, ${0.3 + star.z * 0.5})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    star.y += 0.0006 * star.z;
    if (star.y > 1.02) {
      star.y = -0.02;
      star.x = Math.random();
    }
  }

  requestAnimationFrame(drawStarfield);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
drawStarfield();
