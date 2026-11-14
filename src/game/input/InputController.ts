import type { InputSnapshot } from "../simulation/types";

type ActionKey =
  | "moveForward"
  | "moveBackward"
  | "moveLeft"
  | "moveRight"
  | "sprint"
  | "interact"
  | "scan"
  | "fire"
  | "pause"
  | "intel";

const KEY_MAP: Record<string, ActionKey> = {
  KeyW: "moveForward",
  ArrowUp: "moveForward",
  KeyS: "moveBackward",
  ArrowDown: "moveBackward",
  KeyA: "moveLeft",
  ArrowLeft: "moveLeft",
  KeyD: "moveRight",
  ArrowRight: "moveRight",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  KeyE: "interact",
  KeyQ: "scan",
  KeyF: "fire",
  Escape: "pause",
  Tab: "intel",
  KeyI: "intel",
};

export class InputController {
  private readonly down = new Set<string>();

  private readonly pressed = new Set<ActionKey>();

  private readonly keydownHandler = (event: KeyboardEvent) => {
    const action = KEY_MAP[event.code];
    if (!action) {
      return;
    }

    if (action === "intel" || action === "pause") {
      event.preventDefault();
    }

    if (!this.isDown(action)) {
      this.pressed.add(action);
    }

    this.down.add(event.code);
  };

  private readonly keyupHandler = (event: KeyboardEvent) => {
    const action = KEY_MAP[event.code];
    if (!action) {
      return;
    }

    this.down.delete(event.code);
  };

  private readonly reset = () => {
    this.down.clear();
    this.pressed.clear();
  };

  private readonly visibilityHandler = () => {
    if (document.hidden) this.reset();
  };

  private isDown(action: ActionKey): boolean {
    return Object.keys(KEY_MAP).some((code) => KEY_MAP[code] === action && this.down.has(code));
  }

  constructor() {
    window.addEventListener("keydown", this.keydownHandler);
    window.addEventListener("keyup", this.keyupHandler);
    window.addEventListener("blur", this.reset);
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  destroy() {
    window.removeEventListener("keydown", this.keydownHandler);
    window.removeEventListener("keyup", this.keyupHandler);
    window.removeEventListener("blur", this.reset);
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    this.reset();
  }

  sample(): InputSnapshot {
    const moveX = Number(this.isDown("moveRight")) - Number(this.isDown("moveLeft"));
    const moveY = Number(this.isDown("moveForward")) - Number(this.isDown("moveBackward"));

    const snapshot: InputSnapshot = {
      moveX,
      moveY,
      sprint: this.isDown("sprint"),
      interactHeld: this.isDown("interact"),
      interactPressed: this.pressed.has("interact"),
      scanPressed: this.pressed.has("scan"),
      firePressed: this.pressed.has("fire"),
      pausePressed: this.pressed.has("pause"),
      intelPressed: this.pressed.has("intel"),
    };

    this.pressed.clear();
    return snapshot;
  }
}
