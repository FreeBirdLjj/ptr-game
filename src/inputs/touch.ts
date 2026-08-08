import { Keys, type InputHost, type PointerEvent } from "excalibur";
import type { Vector } from "excalibur";

const SWIPE_THRESHOLD = 10;

export function setupTouchInput(input: InputHost): void {
  const keyboard = input.keyboard;
  const pointers = input.pointers;
  let pointerDownPos: Vector | null = null;

  pointers.on("down", (evt: PointerEvent) => {
    pointerDownPos = evt.worldPos.clone();
  });

  pointers.on("up", (evt: PointerEvent) => {
    if (!pointerDownPos) return;
    const dx = evt.worldPos.x - pointerDownPos.x;
    const dy = evt.worldPos.y - pointerDownPos.y;
    pointerDownPos = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
      keyboard.triggerEvent("down", Keys.Space);
      keyboard.triggerEvent("up", Keys.Space);
      return;
    }

    const key =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? Keys.Right
          : Keys.Left
        : dy > 0
          ? Keys.Down
          : Keys.Up;

    keyboard.triggerEvent("down", key);
    keyboard.triggerEvent("up", key);
  });
}
