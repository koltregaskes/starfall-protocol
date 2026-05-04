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
  private readonly down = new Set<ActionKey>();

  private readonly pressed = new Set<ActionKey>();

  private readonly keydownHandler = (event: KeyboardEvent) => {
    const action = KEY_MAP[event.code];
    if (!action) {
      return;
    }

    if (action === "intel" || action === "pause") {
      event.preventDefault();
    }

    if (!this.down.has(action)) {
      this.pressed.add(action);
    }

    this.down.add(action);
  };

  private readonly keyupHandler = (event: KeyboardEvent) => {
    const action = KEY_MAP[event.code];
    if (!action) {
      return;
    }

    this.down.delete(action);
  };

  constructor() {
    window.addEventListener("keydown", this.keydownHandler);
    window.addEventListener("keyup", this.keyupHandler);
  }

  destroy() {
    window.removeEventListener("keydown", this.keydownHandler);
    window.removeEventListener("keyup", this.keyupHandler);
  }

  sample(): InputSnapshot {
    const moveX = Number(this.down.has("moveRight")) - Number(this.down.has("moveLeft"));
    const moveY = Number(this.down.has("moveForward")) - Number(this.down.has("moveBackward"));

    const snapshot: InputSnapshot = {
      moveX,
      moveY,
      sprint: this.down.has("sprint"),
      interactHeld: this.down.has("interact"),
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
