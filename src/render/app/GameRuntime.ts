import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

import { CinematicGradeShader, makePanelNormal, makePanelRoughness } from "./artDirection";

import { DOOR_OBSTACLE, MISSION_POINTS, STATIC_OBSTACLES, WORLD_BOUNDS } from "../../game/content/mission";
import type { GuardState, SimulationState } from "../../game/simulation/types";

type ActorVisual = {
  root: THREE.Group;
  vision: THREE.Mesh;
};

type ObjectiveMarkerKey = "deploy" | "survey" | "terminal" | "core" | "extraction" | "turret";

type TransitShuttle = {
  root: THREE.Group;
  baseX: number;
  baseY: number;
  span: number;
  speed: number;
  phase: number;
};

function makeMetal(color: string, emissive = "#000000", roughness = 0.42, metalness = 0.72) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: emissive === "#000000" ? 0 : 0.9,
    roughness,
    metalness,
  });
}

function createBox(size: [number, number, number], material: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(...size), material);
}

function createCharacter(accent: string): THREE.Group {
  const group = new THREE.Group();
  const material = makeMetal("#dfe8ff", accent, 0.3, 0.12);
  const dark = makeMetal("#10233e");

  const legs = createBox([0.42, 0.78, 0.32], dark);
  legs.position.y = 0.39;
  group.add(legs);

  const torso = createBox([0.68, 0.92, 0.42], material);
  torso.position.y = 1.2;
  group.add(torso);

  const pack = createBox([0.22, 0.5, 0.18], makeMetal("#2fd6ff", accent));
  pack.position.set(0, 1.22, -0.28);
  group.add(pack);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 18), makeMetal("#f0f6ff"));
  head.position.y = 1.86;
  group.add(head);

  return group;
}

function createVisionCone(color: string): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(8.6, 36, -0.62, 1.24);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

function createProjectileMesh(color: string): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    new THREE.MeshBasicMaterial({ color }),
  );
}

function createObjectiveMarker(color: string): THREE.Group {
  const group = new THREE.Group();

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.28, 3.4, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  beam.position.y = 1.7;
  group.add(beam);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.07, 12, 28),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 14, 14),
    new THREE.MeshBasicMaterial({ color }),
  );
  orb.position.y = 3.35;
  group.add(orb);

  return group;
}

function directionFromAngle(angle: number) {
  return { x: Math.sin(angle), z: Math.cos(angle) };
}

export class GameRuntime {
  private readonly container: HTMLElement;

  private readonly renderer: THREE.WebGLRenderer;

  private readonly scene: THREE.Scene;

  private readonly camera: THREE.PerspectiveCamera;

  private readonly composer: EffectComposer;

  private readonly mixers: THREE.AnimationMixer[] = [];

  private guardModel: { scene: THREE.Group; clips: THREE.AnimationClip[] } | null = null;

  private playerActions: { idle: THREE.AnimationAction; walk: THREE.AnimationAction; run: THREE.AnimationAction } | null = null;

  private activePlayerAction: THREE.AnimationAction | null = null;

  private readonly prevPlayerPos = new THREE.Vector3();

  private readonly playerMesh: THREE.Group;

  private readonly guardMeshes = new Map<string, ActorVisual>();

  private readonly projectileMeshes = new Map<number, THREE.Mesh>();

  private readonly doorMesh: THREE.Group;

  private readonly turretRoot: THREE.Group;

  private readonly turretHead: THREE.Group;

  private readonly coreMesh: THREE.Mesh;

  private readonly scanPulse: THREE.Mesh;

  private readonly alarmLights: THREE.PointLight[] = [];

  private readonly objectiveMarkers: Record<ObjectiveMarkerKey, THREE.Group>;

  private readonly relayMarker: THREE.Group;

  private readonly transitShuttles: TransitShuttle[] = [];

  private readonly desiredCamera = new THREE.Vector3();

  private readonly lookTarget = new THREE.Vector3();

  private readonly viewport = new THREE.Vector2();

  private readonly reviewMode = new URLSearchParams(window.location.search).get("review") === "1";

  private gradePass!: ShaderPass;

  private panelMaps!: { wallRough: THREE.Texture; wallNormal: THREE.Texture };

  private elapsed = 0;

  private contextLost = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#050b13");
    this.scene.fog = new THREE.FogExp2("#050b13", 0.026);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 120);
    this.camera.position.set(-9, 5.8, 16);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost, false);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.handleContextRestored, false);

    // Image-based lighting: gives every PBR (MeshStandardMaterial) surface real reflections.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    // Kept deliberately low. IBL flood is the single biggest cause of the
    // "lit like a product turntable" look - it fills every shadow and destroys
    // the value range that makes a frame read as designed.
    this.scene.environmentIntensity = 0.16;
    void this.loadHdri();

    // Ambient is a floor, not a light source. High hemisphere intensity washes
    // out shape; this only keeps shadows from going fully black.
    this.scene.add(new THREE.HemisphereLight("#4d84c8", "#03060c", 0.22));

    // Key: low and raking (~24 deg) so every object throws a long, readable
    // shadow and surfaces get a grazing highlight that reveals their relief.
    const key = new THREE.DirectionalLight("#dbe8ff", 3.4);
    key.position.set(-17, 7.6, 9);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(2048);
    key.shadow.camera.left = -28;
    key.shadow.camera.right = 28;
    key.shadow.camera.top = 28;
    key.shadow.camera.bottom = -28;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 70;
    key.shadow.bias = -0.0009;
    key.shadow.normalBias = 0.022;
    this.scene.add(key);

    // Rim from behind-right: separates silhouettes from the background, which is
    // what makes characters read instantly at gameplay distance.
    const rim = new THREE.DirectionalLight("#59d6ff", 2.4);
    rim.position.set(16, 6.5, -12);
    this.scene.add(rim);

    // Warm practical bounce - the complementary accent against all that cyan.
    const fill = new THREE.PointLight("#ff8a46", 2.6, 26, 2.0);
    fill.position.set(-13, 4.2, 12);
    this.scene.add(fill);

    this.buildEnvironment();

    this.playerMesh = createCharacter("#6ff3ff");
    this.playerMesh.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) child.castShadow = true;
    });
    this.scene.add(this.playerMesh);

    this.doorMesh = this.buildDoor();
    this.scene.add(this.doorMesh);

    const turret = this.buildTurret();
    this.turretRoot = turret.root;
    this.turretHead = turret.head;
    this.scene.add(this.turretRoot);

    this.coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      makeMetal("#c8f2ff", "#61ecff", 0.16, 0.1),
    );
    this.coreMesh.position.set(MISSION_POINTS.core.x, 1.8, MISSION_POINTS.core.z);
    this.scene.add(this.coreMesh);

    this.scanPulse = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.05, 14, 48),
      new THREE.MeshBasicMaterial({ color: "#59e8ff", transparent: true, opacity: 0, depthWrite: false }),
    );
    this.scanPulse.rotation.x = Math.PI / 2;
    this.scanPulse.visible = false;
    this.scene.add(this.scanPulse);

    this.objectiveMarkers = {
      deploy: createObjectiveMarker("#6ff3ff"),
      survey: createObjectiveMarker("#75ebff"),
      terminal: createObjectiveMarker("#ffc875"),
      core: createObjectiveMarker("#8afff2"),
      extraction: createObjectiveMarker("#7dcfff"),
      turret: createObjectiveMarker("#ff9b68"),
    };
    this.objectiveMarkers.deploy.position.set(MISSION_POINTS.deployPad.x, 0, MISSION_POINTS.deployPad.z);
    this.objectiveMarkers.survey.position.set(MISSION_POINTS.surveyPoint.x, 0, MISSION_POINTS.surveyPoint.z);
    this.objectiveMarkers.terminal.position.set(MISSION_POINTS.terminal.x, 0, MISSION_POINTS.terminal.z);
    this.objectiveMarkers.core.position.set(MISSION_POINTS.core.x, 0, MISSION_POINTS.core.z);
    this.objectiveMarkers.extraction.position.set(MISSION_POINTS.extraction.x, 0, MISSION_POINTS.extraction.z);
    this.objectiveMarkers.turret.position.set(MISSION_POINTS.turret.x, 0, MISSION_POINTS.turret.z);
    Object.values(this.objectiveMarkers).forEach((marker) => {
      marker.visible = false;
      this.scene.add(marker);
    });

    this.relayMarker = createObjectiveMarker("#ffb778");
    this.relayMarker.visible = false;
    this.scene.add(this.relayMarker);

    void this.loadModels();

    // Post-processing: bloom on the emissive accents, then the cinematic grade
    // (contrast, split-tone, vignette, aberration, grain) which is what makes the
    // raw render read as a finished game frame. Grade sits AFTER OutputPass so it
    // works in display space, where contrast and vignette behave predictably.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Threshold high and strength modest: bloom should be a halo on genuine
    // light sources, never a wash. Low thresholds bloom lit diffuse surfaces
    // too and blow the frame out.
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.85, 0.98);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
    this.gradePass = new ShaderPass(CinematicGradeShader);
    this.composer.addPass(this.gradePass);

    window.addEventListener("resize", this.handleResize);
    this.handleResize();
    (window as unknown as { __sfRuntime?: GameRuntime }).__sfRuntime = this;
  }

  debugSnapshot() {
    const describe = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      return {
        children: object.children.length,
        visible: object.visible,
        position: object.position.toArray().map((v) => Number(v.toFixed(2))),
        scale: object.scale.toArray().map((v) => Number(v.toFixed(4))),
        boxSize: size.toArray().map((v) => Number(v.toFixed(2))),
        childScales: object.children.map((c) => Number(c.scale.x.toFixed(4))),
      };
    };
    return {
      player: describe(this.playerMesh),
      guardCount: this.guardMeshes.size,
      guards: [...this.guardMeshes.values()].slice(0, 2).map((v) => describe(v.root)),
      guardModelLoaded: Boolean(this.guardModel),
      mixers: this.mixers.length,
    };
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost, false);
    this.renderer.domElement.removeEventListener("webglcontextrestored", this.handleContextRestored, false);
    this.disposeSceneResources();
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.container.replaceChildren();
  }

  render(state: SimulationState, dt: number) {
    if (this.contextLost) {
      return;
    }

    this.elapsed += dt;
    // Animated grain: a static grain pattern reads as a dirty lens, a moving one
    // reads as film. Wrapped so the uniform never loses float precision.
    this.gradePass.uniforms.time.value = this.elapsed % 1000;

    for (const mixer of this.mixers) mixer.update(dt);
    this.updatePlayerLocomotion(state, dt);
    this.updatePlayer(state, dt);
    this.updateGuards(state);
    this.updateTurret(state, dt);
    this.updateDoor(state, dt);
    this.updateProjectiles(state);
    this.updateCore(state, dt);
    this.updateScanPulse(state);
    this.updateAlarmLights(state);
    this.updateObjectiveMarkers(state);
    this.updateBackdrop(state);
    this.updateCamera(state, dt);
    this.composer.render();
  }

  private readonly handleResize = () => {
    this.viewport.set(this.container.clientWidth, this.container.clientHeight);
    this.camera.aspect = this.viewport.x / Math.max(this.viewport.y, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.getPixelRatioCap()));
    this.renderer.setSize(this.viewport.x, this.viewport.y);
    this.composer.setSize(this.viewport.x, this.viewport.y);
  };

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
  };

  private readonly handleContextRestored = () => {
    this.contextLost = false;
    this.handleResize();
  };

  private getPixelRatioCap(): number {
    if (this.viewport.x <= 520) {
      return 1;
    }

    if (this.viewport.x <= 960) {
      return 1.25;
    }

    return this.reviewMode ? 1.5 : 1.75;
  }

  private disposeSceneResources() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        if (object.geometry) {
          geometries.add(object.geometry);
        }

        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.forEach((material) => {
          if (!material) {
            return;
          }

          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) {
              textures.add(value);
            }
          });
        });
      }
    });

    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
  }

  private buildEnvironment() {
    // Procedural panelling. Without surface detail there is nothing for the
    // raking key light to break across, and every box reads as a blockout.
    const deckRough = makePanelRoughness(512, 7);
    const deckNormal = makePanelNormal(512, 7);
    deckRough.repeat.set(9, 8);
    deckNormal.repeat.set(9, 8);

    const wallRough = makePanelRoughness(512, 21);
    const wallNormal = makePanelNormal(512, 21);
    wallRough.repeat.set(7, 1.4);
    wallNormal.repeat.set(7, 1.4);

    const floorMaterial = makeMetal("#0a1623", "#0d2b3d", 0.24, 0.82);
    floorMaterial.roughnessMap = deckRough;
    floorMaterial.normalMap = deckNormal;
    floorMaterial.normalScale.set(0.7, 0.7);
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX, 0.35, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ),
      floorMaterial,
    );
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.panelMaps = { wallRough, wallNormal };

    const trimMaterial = makeMetal("#19324e", "#4ad7ff", 0.18, 0.44);
    for (let x = -16; x <= 16; x += 4) {
      const strip = createBox([0.15, 0.06, 28], trimMaterial);
      strip.position.set(x, 0.03, 0);
      this.scene.add(strip);
    }

    const returnStrip = createBox([22, 0.08, 0.22], makeMetal("#1b4058", "#ffc86f", 0.18, 0.4));
    returnStrip.position.set(-4, 0.05, 12.2);
    this.scene.add(returnStrip);

    const outerWallMaterial = makeMetal("#0d1626", "#081c2b", 0.42, 0.84);
    outerWallMaterial.roughnessMap = this.panelMaps.wallRough;
    outerWallMaterial.normalMap = this.panelMaps.wallNormal;
    outerWallMaterial.normalScale.set(0.85, 0.85);
    const walls = [
      { position: [0, 3.2, WORLD_BOUNDS.minZ] as [number, number, number], size: [38, 6.6, 0.7] as [number, number, number] },
      { position: [0, 3.2, WORLD_BOUNDS.maxZ] as [number, number, number], size: [38, 6.6, 0.7] as [number, number, number] },
      { position: [WORLD_BOUNDS.minX, 3.2, 0] as [number, number, number], size: [0.7, 6.6, 33] as [number, number, number] },
      { position: [WORLD_BOUNDS.maxX, 3.2, 0] as [number, number, number], size: [0.7, 6.6, 33] as [number, number, number] },
    ];

    for (const wall of walls) {
      const mesh = createBox(wall.size, outerWallMaterial);
      mesh.position.set(...wall.position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    const windowFrame = createBox([0.7, 4.8, 13], makeMetal("#102235", "#163653", 0.3, 0.88));
    windowFrame.position.set(WORLD_BOUNDS.maxX - 0.35, 3.2, 4.5);
    this.scene.add(windowFrame);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 4.2),
      new THREE.MeshPhysicalMaterial({
        color: "#92d8ff",
        transparent: true,
        opacity: 0.14,
        roughness: 0.05,
        metalness: 0.1,
        transmission: 0.65,
      }),
    );
    glass.rotation.y = -Math.PI / 2;
    glass.position.set(WORLD_BOUNDS.maxX - 0.76, 3.15, 4.5);
    this.scene.add(glass);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(5.8, 36, 36),
      new THREE.MeshStandardMaterial({ color: "#2f76ff", emissive: "#14316f", roughness: 0.84, metalness: 0.05 }),
    );
    planet.position.set(32, 1.5, 7.4);
    this.scene.add(planet);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(6.2, 24, 24),
      new THREE.MeshBasicMaterial({ color: "#76d9ff", transparent: true, opacity: 0.08, side: THREE.BackSide }),
    );
    atmosphere.position.copy(planet.position);
    this.scene.add(atmosphere);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(270 * 3);
    for (let index = 0; index < 270; index += 1) {
      starPositions[index * 3] = 20 + Math.random() * 26;
      starPositions[index * 3 + 1] = Math.random() * 20 - 2;
      starPositions[index * 3 + 2] = Math.random() * 30 - 4;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    this.scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({ color: "#d7ecff", size: 0.08, transparent: true, opacity: 0.9 }),
      ),
    );

    const trafficLane = createBox([0.25, 0.25, 22], makeMetal("#204461", "#5fe7ff", 0.16, 0.22));
    trafficLane.position.set(24.5, 1.3, 0);
    trafficLane.rotation.y = 0.12;
    this.scene.add(trafficLane);

    for (let index = 0; index < 3; index += 1) {
      const shuttle = new THREE.Group();
      const hull = createBox(
        [1 + index * 0.16, 0.16, 2 + index * 0.28],
        makeMetal("#dff8ff", "#79eeff", 0.1, 0.16),
      );
      shuttle.add(hull);

      const wing = createBox([0.16, 0.05, 1.7], makeMetal("#7eeaff", "#7eeaff", 0.08, 0.14));
      wing.position.x = 0.46;
      shuttle.add(wing);

      const mirroredWing = wing.clone();
      mirroredWing.position.x = -0.46;
      shuttle.add(mirroredWing);

      const beacon = createBox([0.12, 0.08, 0.44], makeMetal("#ffc57b", "#ffc57b", 0.08, 0.12));
      beacon.position.set(0, 0.12, 0.92);
      shuttle.add(beacon);

      const baseY = 2 + index * 1.15;
      const baseX = 24.4 + index * 1.2;
      shuttle.position.set(baseX, baseY, -7 + index * 5);
      shuttle.rotation.y = -0.24;
      this.scene.add(shuttle);
      this.transitShuttles.push({
        root: shuttle,
        baseX,
        baseY,
        span: 22 + index * 4,
        speed: 1.5 + index * 0.25,
        phase: index * 3.6,
      });
    }

    for (const obstacle of STATIC_OBSTACLES) {
      const crate = createBox(
        [obstacle.halfWidth * 2, obstacle.height, obstacle.halfDepth * 2],
        obstacle.id === "archive-pylon" ? makeMetal("#132535", "#12334b", 0.3, 0.86) : makeMetal("#15293a", "#112234", 0.36, 0.78),
      );
      crate.position.set(obstacle.x, obstacle.height / 2, obstacle.z);
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.scene.add(crate);
    }

    const skiffPad = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.55, 48),
      new THREE.MeshBasicMaterial({ color: "#69e9ff", side: THREE.DoubleSide, transparent: true, opacity: 0.72 }),
    );
    skiffPad.rotation.x = -Math.PI / 2;
    skiffPad.position.set(MISSION_POINTS.extraction.x, 0.03, MISSION_POINTS.extraction.z);
    this.scene.add(skiffPad);

    const skiffHull = createBox([2.8, 0.55, 5.1], makeMetal("#101a2b", "#1b4867", 0.2, 0.78));
    skiffHull.position.set(MISSION_POINTS.deployPad.x + 1.4, 1.2, MISSION_POINTS.deployPad.z);
    skiffHull.rotation.y = 0.18;
    this.scene.add(skiffHull);

    const skiffWingA = createBox([0.26, 0.14, 4.2], makeMetal("#6ae8ff", "#6ae8ff", 0.12, 0.28));
    skiffWingA.position.set(MISSION_POINTS.deployPad.x, 1.05, MISSION_POINTS.deployPad.z);
    skiffWingA.rotation.z = 0.16;
    this.scene.add(skiffWingA);

    const skiffWingB = skiffWingA.clone();
    skiffWingB.rotation.z = -0.16;
    this.scene.add(skiffWingB);

    const surveyRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.24, 40),
      new THREE.MeshBasicMaterial({ color: "#5edfff", side: THREE.DoubleSide, transparent: true, opacity: 0.86 }),
    );
    surveyRing.rotation.x = -Math.PI / 2;
    surveyRing.position.set(MISSION_POINTS.surveyPoint.x, 0.04, MISSION_POINTS.surveyPoint.z);
    this.scene.add(surveyRing);

    const surveyPole = createBox([0.2, 2, 0.2], makeMetal("#13283b", "#4ad7ff", 0.18, 0.5));
    surveyPole.position.set(MISSION_POINTS.surveyPoint.x, 1, MISSION_POINTS.surveyPoint.z);
    this.scene.add(surveyPole);

    const terminal = createBox([0.8, 1.8, 0.8], makeMetal("#162a40", "#123149", 0.28, 0.75));
    terminal.position.set(MISSION_POINTS.terminal.x, 0.9, MISSION_POINTS.terminal.z);
    terminal.castShadow = true;
    this.scene.add(terminal);

    const terminalScreen = createBox([0.64, 0.46, 0.06], makeMetal("#73f0ff", "#73f0ff", 0.1, 0.05));
    terminalScreen.position.set(MISSION_POINTS.terminal.x, 1.4, MISSION_POINTS.terminal.z + 0.43);
    this.scene.add(terminalScreen);

    const pedestal = createBox([1.2, 1.3, 1.2], makeMetal("#122538", "#11304b", 0.28, 0.8));
    pedestal.position.set(MISSION_POINTS.core.x, 0.65, MISSION_POINTS.core.z);
    pedestal.castShadow = true;
    this.scene.add(pedestal);

    const archiveColumn = createBox([1.7, 3.8, 1.7], makeMetal("#12263a", "#10243a", 0.28, 0.82));
    archiveColumn.position.set(11.8, 1.9, -9.6);
    this.scene.add(archiveColumn);

    for (const x of [-14, -6, 2, 10]) {
      const light = new THREE.PointLight("#ff6d47", 0.3, 10, 2);
      light.position.set(x, 5.2, -4.2);
      this.scene.add(light);
      this.alarmLights.push(light);
    }
  }

  private buildDoor(): THREE.Group {
    const group = new THREE.Group();
    const frame = createBox([DOOR_OBSTACLE.halfWidth * 2 + 0.6, DOOR_OBSTACLE.height + 0.6, 0.75], makeMetal("#0f1e2d", "#152a3f", 0.28, 0.88));
    frame.position.y = DOOR_OBSTACLE.height / 2;
    group.add(frame);

    const leaf = createBox([DOOR_OBSTACLE.halfWidth * 2, DOOR_OBSTACLE.height, 0.45], makeMetal("#17324a", "#5ce8ff", 0.14, 0.42));
    leaf.name = "doorLeaf";
    leaf.position.y = DOOR_OBSTACLE.height / 2;
    group.add(leaf);

    group.position.set(DOOR_OBSTACLE.x, 0, DOOR_OBSTACLE.z);
    return group;
  }

  private buildTurret() {
    const root = new THREE.Group();
    root.position.set(MISSION_POINTS.turret.x, 3.6, MISSION_POINTS.turret.z);

    const stem = createBox([0.35, 1.2, 0.35], makeMetal("#162739", "#0f2536", 0.24, 0.82));
    stem.position.y = -0.6;
    root.add(stem);

    const head = new THREE.Group();
    const shell = createBox([1, 0.7, 0.9], makeMetal("#1b334a", "#ff7f4a", 0.16, 0.34));
    shell.castShadow = true;
    head.add(shell);
    const barrel = createBox([0.22, 0.18, 1.1], makeMetal("#ffc476", "#ffc476", 0.12, 0.16));
    barrel.position.z = 0.72;
    head.add(barrel);
    root.add(head);
    return { root, head };
  }

  private fitModel(object: THREE.Object3D, targetHeight: number) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const scale = targetHeight / Math.max(size.y, 0.0001);
    object.scale.setScalar(scale);
    const grounded = new THREE.Box3().setFromObject(object);
    const center = grounded.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= grounded.min.y;
  }

  private playClip(object: THREE.Object3D, clips: THREE.AnimationClip[], preferred: string) {
    if (!clips.length) return;
    const clip = THREE.AnimationClip.findByName(clips, preferred)
      ?? clips.find((c) => /idle/i.test(c.name))
      ?? clips[0];
    const mixer = new THREE.AnimationMixer(object);
    mixer.clipAction(clip).play();
    this.mixers.push(mixer);
  }

  private async loadHdri() {
    try {
      const texture = await new RGBELoader().loadAsync(new URL("hdri/hangar_2k.hdr", document.baseURI).href);
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromEquirectangular(texture).texture;
      this.scene.environmentIntensity = 0.65;
      texture.dispose();
      pmrem.dispose();
    } catch {
      /* keep the RoomEnvironment fallback set in the constructor */
    }
  }

  private async loadModels() {
    const loader = new GLTFLoader();
    const url = (path: string) => new URL(path, document.baseURI).href;

    try {
      const gltf = await loader.loadAsync(url("models/soldier.glb"));
      this.applyPlayerModel(gltf.scene, gltf.animations);
      console.info("[starfall] player model ready");
    } catch (error) {
      console.warn("[starfall] player model failed to load, using placeholder", error);
    }

    try {
      const gltf = await loader.loadAsync(url("models/robot.glb"));
      this.guardModel = { scene: gltf.scene, clips: gltf.animations };
      this.refreshGuardVisuals();
      console.info("[starfall] guard model ready");
    } catch (error) {
      console.warn("[starfall] guard model failed to load, using placeholder", error);
    }

    try {
      const gltf = await loader.loadAsync(url("models/turret.glb"));
      this.applyTurretModel(gltf.scene);
      console.info("[starfall] turret model ready");
    } catch (error) {
      console.warn("[starfall] turret model failed to load, using placeholder", error);
    }
  }

  private prepareSkinned(model: THREE.Object3D) {
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        // Skinned meshes animate outside their bind-pose bounds; never cull them.
        child.frustumCulled = false;
      }
    });
  }

  private applyPlayerModel(scene: THREE.Group, clips: THREE.AnimationClip[]) {
    const model = cloneSkeleton(scene) as THREE.Group;
    this.prepareSkinned(model);
    // three.js Soldier.glb is authored human-sized (~1.7 units); auto-fitting a
    // skinned mesh measures its bind-space geometry and mis-scales wildly.
    model.scale.setScalar(1);
    model.rotation.y = Math.PI;
    this.playerMesh.clear();
    this.playerMesh.add(model);

    const find = (name: string) => THREE.AnimationClip.findByName(clips, name);
    const idleClip = find("Idle");
    const walkClip = find("Walk");
    const runClip = find("Run");
    if (idleClip && walkClip && runClip) {
      const mixer = new THREE.AnimationMixer(model);
      this.playerActions = {
        idle: mixer.clipAction(idleClip),
        walk: mixer.clipAction(walkClip),
        run: mixer.clipAction(runClip),
      };
      this.playerActions.idle.play();
      this.activePlayerAction = this.playerActions.idle;
      this.mixers.push(mixer);
    } else {
      this.playClip(model, clips, "Idle");
    }
  }

  private updatePlayerLocomotion(state: SimulationState, dt: number) {
    if (!this.playerActions || dt <= 0) return;
    const speed = Math.hypot(
      state.player.position.x - this.prevPlayerPos.x,
      state.player.position.z - this.prevPlayerPos.z,
    ) / dt;
    this.prevPlayerPos.set(state.player.position.x, 0, state.player.position.z);

    const next = speed > 4.4 ? this.playerActions.run : speed > 0.4 ? this.playerActions.walk : this.playerActions.idle;
    if (next !== this.activePlayerAction) {
      next.reset().fadeIn(0.22).play();
      this.activePlayerAction?.fadeOut(0.22);
      this.activePlayerAction = next;
    }
  }

  private applyTurretModel(scene: THREE.Group) {
    const model = scene.clone(true);
    model.traverse((child: THREE.Object3D) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
    this.fitModel(model, 1.4);
    this.turretHead.clear();
    this.turretHead.add(model);
  }

  private updatePlayer(state: SimulationState, dt: number) {
    this.playerMesh.position.set(state.player.position.x, 0, state.player.position.z);
    this.playerMesh.rotation.y = state.player.facing;
    this.playerMesh.position.y = Math.sin(state.elapsed * 8) * Math.min(0.06, dt * 2);
  }

  private ensureGuardVisual(guard: GuardState): ActorVisual {
    const existing = this.guardMeshes.get(guard.id);
    if (existing) return existing;

    let root: THREE.Group;
    if (this.guardModel) {
      root = new THREE.Group();
      const model = cloneSkeleton(this.guardModel.scene) as THREE.Group;
      this.prepareSkinned(model);
      // RobotExpressive ships as a bright yellow cartoon mascot, which is
      // tonally wrong for a stealth game - hostiles must read as a THREAT.
      // Re-skin to gunmetal with a hot emissive eye-line so they stay readable
      // against the dark deck without looking friendly.
      this.makeHostile(model, guard.type === "drone" ? "#ff7a2f" : "#ff3355");
      // RobotExpressive is ~2.6 units tall natively; use fixed scales per role.
      model.scale.setScalar(guard.type === "drone" ? 0.5 : 0.62);
      model.rotation.y = Math.PI;
      root.add(model);
      // Guards patrol constantly; the Walking clip reads correctly in motion.
      this.playClip(model, this.guardModel.clips, "Walking");
    } else {
      root = createCharacter(guard.type === "drone" ? "#ffb26d" : "#ff7a52");
      if (guard.type === "drone") {
        root.scale.setScalar(0.92);
        root.position.y = 0.5;
      }
      root.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) child.castShadow = true;
      });
    }

    const vision = createVisionCone(guard.type === "drone" ? "#ffcf7d" : "#ff7a52");
    root.add(vision);
    this.scene.add(root);

    const visual = { root, vision };
    this.guardMeshes.set(guard.id, visual);
    return visual;
  }

  /**
   * Re-skins a loaded model into a hostile silhouette: dark gunmetal body so it
   * sits back in the palette, with the brightest original parts promoted to a
   * hot emissive accent so the eye still finds the threat instantly.
   */
  private makeHostile(model: THREE.Object3D, accent: string) {
    const accentColor = new THREE.Color(accent);
    model.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) return;
      const wasArray = Array.isArray(child.material);
      const source = wasArray ? (child.material as THREE.Material[]) : [child.material as THREE.Material];
      const replaced = source.map((entry) => {
        const base = entry as THREE.MeshStandardMaterial;
        const replacement = new THREE.MeshStandardMaterial({
          color: "#232b36",
          roughness: 0.52,
          metalness: 0.86,
        });
        // Only the very brightest original parts become the glowing accent - a
        // low threshold here promotes most of the mascot and the guard ends up
        // glowing like a lamp instead of reading as armour with a lit visor.
        const luminance = base.color
          ? base.color.r * 0.2126 + base.color.g * 0.7152 + base.color.b * 0.0722
          : 0;
        if (luminance > 0.72) {
          replacement.color.set("#1a2029");
          replacement.emissive = accentColor;
          replacement.emissiveIntensity = 0.55;
        }
        return replacement;
      });
      child.material = wasArray ? replaced : replaced[0];
    });
  }

  private refreshGuardVisuals() {
    // Guards created before the model finished loading are placeholder boxes;
    // drop them so the next frame recreates them from the loaded model.
    for (const visual of this.guardMeshes.values()) {
      this.scene.remove(visual.root);
      visual.root.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => material.dispose());
        }
      });
    }
    this.guardMeshes.clear();
  }

  private updateGuards(state: SimulationState) {
    for (const guard of state.guards) {
      const visual = this.ensureGuardVisual(guard);
      visual.root.visible = !guard.down;
      if (guard.down) continue;

      visual.root.position.set(guard.position.x, guard.type === "drone" ? 0.85 + Math.sin(state.elapsed * 4.4 + guard.position.x) * 0.12 : 0, guard.position.z);
      visual.root.rotation.y = guard.facing;

      const visibleVision = state.player.scanRevealTimer > 0 || state.alert || guard.suspicion > 0.18;
      visual.vision.visible = visibleVision;
      visual.vision.rotation.z = -Math.PI / 2;
      if (visual.vision.material instanceof THREE.MeshBasicMaterial) {
        visual.vision.material.opacity = state.alert ? 0.24 : 0.08 + guard.suspicion * 0.14;
      }
    }
  }

  private updateTurret(state: SimulationState, dt: number) {
    this.turretRoot.visible = state.turret.active && !state.turret.destroyed;
    this.turretRoot.position.y = THREE.MathUtils.lerp(this.turretRoot.position.y, state.turret.active ? 3.6 : 4.2, 1 - Math.exp(-dt * 4));
    this.turretHead.rotation.y = -state.turret.facing;
  }

  private updateDoor(state: SimulationState, dt: number) {
    const leaf = this.doorMesh.getObjectByName("doorLeaf");
    if (!(leaf instanceof THREE.Mesh)) return;

    const openY = DOOR_OBSTACLE.height + 2.2;
    const closedY = DOOR_OBSTACLE.height / 2;
    leaf.position.y = THREE.MathUtils.lerp(leaf.position.y, state.doorOpen ? openY : closedY, 1 - Math.exp(-dt * 4.2));
  }

  private updateProjectiles(state: SimulationState) {
    const active = new Set<number>();
    for (const projectile of state.projectiles) {
      let mesh = this.projectileMeshes.get(projectile.id);
      if (!mesh) {
        mesh = createProjectileMesh(projectile.owner === "player" ? "#7decff" : "#ff8d5a");
        this.scene.add(mesh);
        this.projectileMeshes.set(projectile.id, mesh);
      }

      mesh.position.set(projectile.position.x, projectile.height, projectile.position.z);
      active.add(projectile.id);
    }

    for (const [id, mesh] of this.projectileMeshes) {
      if (active.has(id)) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
      this.projectileMeshes.delete(id);
    }
  }

  private updateCore(state: SimulationState, dt: number) {
    this.coreMesh.visible = !state.coreCollected;
    this.coreMesh.rotation.y += dt * 1.2;
    this.coreMesh.position.y = 1.8 + Math.sin(state.elapsed * 2.8) * 0.12;
  }

  private updateScanPulse(state: SimulationState) {
    if (state.player.scanRevealTimer <= 0) {
      this.scanPulse.visible = false;
      return;
    }

    this.scanPulse.visible = true;
    this.scanPulse.position.set(state.player.position.x, 0.08, state.player.position.z);
    const phase = 1 - state.player.scanRevealTimer / 3.6;
    const scale = 1 + phase * 8;
    this.scanPulse.scale.setScalar(scale);
    if (this.scanPulse.material instanceof THREE.MeshBasicMaterial) {
      this.scanPulse.material.opacity = 0.22 * (1 - phase);
    }
  }

  private updateAlarmLights(state: SimulationState) {
    const intensity = state.ui.alarm ? 0.35 + Math.sin(state.elapsed * 7.2) * 0.2 : 0.08;
    for (const light of this.alarmLights) {
      light.intensity = intensity;
    }
  }

  private updateObjectiveMarkers(state: SimulationState) {
    Object.values(this.objectiveMarkers).forEach((marker) => {
      marker.visible = false;
      const pulse = 1 + Math.sin(state.elapsed * 3.8) * 0.06;
      marker.scale.setScalar(pulse);
      marker.rotation.y += 0.01;
    });

    this.relayMarker.visible = false;

    switch (state.objective) {
      case "insert":
        this.objectiveMarkers.deploy.visible = true;
        break;
      case "survey":
        this.objectiveMarkers.survey.visible = true;
        break;
      case "hack":
        this.objectiveMarkers.terminal.visible = true;
        break;
      case "collect":
        this.objectiveMarkers.core.visible = true;
        break;
      case "combat": {
        this.objectiveMarkers.turret.visible = !state.turret.destroyed;
        const relayDrone = state.guards.find((guard) => guard.id === "relay-drone" && !guard.down);
        if (relayDrone) {
          this.relayMarker.visible = true;
          this.relayMarker.position.set(relayDrone.position.x, 0, relayDrone.position.z);
          this.relayMarker.scale.setScalar(1 + Math.sin(state.elapsed * 4.4) * 0.08);
        }
        break;
      }
      case "extract":
        this.objectiveMarkers.extraction.visible = true;
        break;
    }
  }

  private updateBackdrop(state: SimulationState) {
    this.transitShuttles.forEach((shuttle, index) => {
      const travel = ((state.elapsed * shuttle.speed + shuttle.phase) % shuttle.span) - shuttle.span / 2;
      shuttle.root.position.x = shuttle.baseX + Math.sin(state.elapsed * 0.32 + shuttle.phase) * 0.8;
      shuttle.root.position.y = shuttle.baseY + Math.sin(state.elapsed * 0.9 + shuttle.phase) * 0.18;
      shuttle.root.position.z = travel;
      shuttle.root.rotation.y = -0.24 + Math.sin(state.elapsed * 0.42 + index) * 0.05;
    });
  }

  private updateCamera(state: SimulationState, dt: number) {
    const forward = directionFromAngle(state.player.facing);
    this.desiredCamera.set(
      state.player.position.x - forward.x * 7.6 - 1.35,
      5.6,
      state.player.position.z - forward.z * 7.6 + 2.05,
    );
    this.desiredCamera.x = THREE.MathUtils.clamp(this.desiredCamera.x, WORLD_BOUNDS.minX + 2.6, WORLD_BOUNDS.maxX - 2.6);
    this.desiredCamera.z = THREE.MathUtils.clamp(this.desiredCamera.z, WORLD_BOUNDS.minZ + 2.4, WORLD_BOUNDS.maxZ - 2.4);

    this.camera.position.lerp(this.desiredCamera, 1 - Math.exp(-dt * 4.2));
    this.lookTarget.set(
      THREE.MathUtils.clamp(state.player.position.x + forward.x * 1.7, WORLD_BOUNDS.minX + 1.2, WORLD_BOUNDS.maxX - 1.2),
      1.45,
      THREE.MathUtils.clamp(state.player.position.z + forward.z * 1.7, WORLD_BOUNDS.minZ + 1.2, WORLD_BOUNDS.maxZ - 1.2),
    );
    this.camera.lookAt(this.lookTarget);
  }
}
