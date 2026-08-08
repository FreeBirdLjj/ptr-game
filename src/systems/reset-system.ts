import {
  System,
  SystemType,
  World,
  Keys,
  Keyboard,
  type Scene,
} from "excalibur";
import { resetWorld } from "../interactions/world";
import { WithGameStateFilter } from "./util";

export class ResetSystem extends WithGameStateFilter(System) {
  override systemType = SystemType.Update;

  private keyboard!: Keyboard;
  private scene!: Scene;

  override onInitialize(_world: World, scene: Scene): void {
    this.scene = scene;
    this.keyboard = scene.input.keyboard;
  }

  override gameStatusHandlers = {
    gameOver: (_elapsedMs: number): void => {
      if (!this.keyboard.wasPressed(Keys.Space)) return;

      resetWorld(this.scene.world);
    },
  };
}
