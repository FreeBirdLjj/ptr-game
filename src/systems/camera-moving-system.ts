import {
  System,
  SystemType,
  World,
  Query,
  MotionComponent,
  type Scene,
} from "excalibur";
import { CameraPositionComponent } from "../components/singletons/camera-position-component";
import { RunnerStateComponent } from "../components/singletons/runner-state-component";
import { RoadPositionComponent } from "../components/road-position-component";
import { getGameStateComponent } from "../components/singletons/game-state-component";
import { TILE_SIZE } from "../core/road-position";
import { WithGameStateFilter } from "./util";

const INITIAL_SPEED = 500;
const SPEED_STEP = 50;
const SPEED_INTERVAL = 10;

/**
 * 按照阶梯加速度计算当前速度，写入 Camera 和 Runner 的 MotionComponent.vel.y，
 * 由 MotionSystem 以 substep 精度推动 TransformComponent.pos.y（即 roadDist）。
 */
export class CameraMovingSystem extends WithGameStateFilter(System) {
  override systemType = SystemType.Update;

  private camQuery!: Query<
    typeof CameraPositionComponent | typeof MotionComponent
  >;
  private runnerQuery!: Query<
    | typeof RunnerStateComponent
    | typeof MotionComponent
    | typeof RoadPositionComponent
  >;

  override onInitialize(world: World, _scene: Scene): void {
    this.camQuery = world.query([CameraPositionComponent, MotionComponent]);
    this.runnerQuery = world.query([
      RunnerStateComponent,
      MotionComponent,
      RoadPositionComponent,
    ]);
  }

  override gameStatusHandlers = {
    tutorial: (_elapsedMs: number): void => {
      this.setRunnerAndCameraSpeed(INITIAL_SPEED);
    },
    gaming: (elapsedMs: number): void => {
      const dt = elapsedMs / 1000;
      const gameState = getGameStateComponent(this.gameStateQuery);
      gameState.elapsedTime += dt;
      const speed =
        INITIAL_SPEED +
        Math.floor(gameState.elapsedTime / SPEED_INTERVAL) * SPEED_STEP;

      this.setRunnerAndCameraSpeed(speed);

      for (const entity of this.runnerQuery.entities) {
        gameState.score.dist =
          entity.get(RoadPositionComponent).roadDist -
          gameState.tutorialTileCount * TILE_SIZE;
      }
    },
    gameOver: (_elapsedMs: number): void => {
      this.setRunnerAndCameraSpeed(0);
    },
  };

  private setRunnerAndCameraSpeed(speed: number): void {
    for (const entity of this.camQuery.entities) {
      entity.get(MotionComponent).vel.y = speed;
    }
    for (const entity of this.runnerQuery.entities) {
      entity.get(MotionComponent).vel.y = speed;
    }
  }
}
