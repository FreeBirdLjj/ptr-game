import {
  System,
  SystemType,
  World,
  Query,
  MotionComponent,
  Entity,
  type Scene,
} from "excalibur";
import {
  CameraPositionComponent,
  getCameraPositionComponent,
} from "../components/singletons/camera-position-component";
import { RunnerStateComponent } from "../components/singletons/runner-state-component";
import { RoadPositionComponent } from "../components/road-position-component";
import {
  ObstacleColliderComponent,
  RunnerState,
} from "../components/obstacle-collider-component";
import { getGameStateComponent } from "../components/singletons/game-state-component";
import { Runner } from "../interactions/runner";
import { triggerGameOver } from "../interactions/game";
import { resetWorld } from "../interactions/world";
import { TILE_SIZE } from "../core/road-position";
import { WithGameStateFilter } from "./util";

const INITIAL_SPEED = 500;
const SPEED_STEP = 50;
const SPEED_INTERVAL_MS = 10_000;

/**
 * 移动系统：按照阶梯加速度计算当前速度，写入 Camera 和 Runner 的 MotionComponent.vel.y，
 * 由 MotionSystem 以 substep 精度推动 TransformComponent.pos.y（即 roadDist）。
 *
 * 同时承担障碍判定：runner 本帧前进区间 [startRoadDist, endRoadDist] 内经过的障碍即为命中。
 */
export class MovingSystem extends WithGameStateFilter(System) {
  override systemType = SystemType.Update;

  private cameraQuery!: Query<
    typeof CameraPositionComponent | typeof MotionComponent
  >;
  private runnerQuery!: Query<
    | typeof RunnerStateComponent
    | typeof MotionComponent
    | typeof RoadPositionComponent
  >;
  private obstacleQuery!: Query<
    typeof RoadPositionComponent | typeof ObstacleColliderComponent
  >;
  private scene!: Scene;

  override onInitialize(world: World, scene: Scene): void {
    this.scene = scene;
    this.cameraQuery = world.query([CameraPositionComponent, MotionComponent]);
    this.runnerQuery = world.query([
      RunnerStateComponent,
      MotionComponent,
      RoadPositionComponent,
    ]);
    this.obstacleQuery = world.query([
      RoadPositionComponent,
      ObstacleColliderComponent,
    ]);
  }

  override gameStatusHandlers = {
    tutorial: (elapsedMs: number): void => {
      this.moveAndScan(INITIAL_SPEED, elapsedMs);
    },
    gaming: (elapsedMs: number): void => {
      const gameState = getGameStateComponent(this.gameStateQuery);
      gameState.elapsedMs += elapsedMs;
      const speed =
        INITIAL_SPEED +
        Math.floor(gameState.elapsedMs / SPEED_INTERVAL_MS) * SPEED_STEP;

      // 先按本帧位置更新距离分：死亡计分（recordScore）与 UI 显示必须用同一分值
      for (const entity of this.runnerQuery.entities) {
        gameState.score.dist =
          entity.get(RoadPositionComponent).roadDist -
          gameState.tutorialTileCount * TILE_SIZE;
      }

      this.moveAndScan(speed, elapsedMs);
    },
    gameOver: (_elapsedMs: number): void => {
      this.setRunnerAndCameraSpeed(0);
    },
  };

  private moveAndScan(speed: number, elapsedMs: number): void {
    this.setRunnerAndCameraSpeed(speed);
    this.scanPassedObstacles(speed, elapsedMs);
  }

  private setRunnerAndCameraSpeed(speed: number): void {
    for (const entity of this.cameraQuery.entities) {
      entity.get(MotionComponent).vel.y = speed;
    }
    for (const entity of this.runnerQuery.entities) {
      entity.get(MotionComponent).vel.y = speed;
    }
  }

  /** 判定本帧前进区间内经过的障碍 */
  private scanPassedObstacles(speed: number, elapsedMs: number): void {
    const runnerEntity = this.runnerQuery.entities[0];

    const runnerPosition = runnerEntity.get(RoadPositionComponent);
    const runnerState = runnerEntity.get(RunnerStateComponent);
    const runnerMotion = runnerEntity.get(MotionComponent);

    const travelDistance = (speed * elapsedMs) / 1000;
    const endRoadDist = runnerPosition.roadDist;
    const startRoadDist = endRoadDist - travelDistance;

    for (const entity of this.obstacleQuery.entities) {
      if (!entity.isActive) continue;
      const obstacle = entity.get(ObstacleColliderComponent);
      const obstaclePosition = entity.get(RoadPositionComponent);
      if (
        obstaclePosition.roadDist < startRoadDist ||
        obstaclePosition.roadDist > endRoadDist
      ) {
        continue;
      }
      // 车道半径判定：runner 车道须在障碍覆盖范围内
      if (
        Math.abs(obstaclePosition.lane - runnerPosition.lane) >
        obstacle.laneRadius
      ) {
        continue;
      }
      this.handleObstacleHit(
        entity,
        runnerPosition,
        runnerState,
        runnerMotion,
        obstaclePosition.roadDist,
      );
    }
  }

  private handleObstacleHit(
    entity: Entity,
    runnerPosition: RoadPositionComponent,
    runnerState: RunnerStateComponent,
    runnerMotion: MotionComponent,
    obstacleRoadDist: number,
  ): void {
    const obstacle = entity.get(ObstacleColliderComponent);

    // 教程终点：整局重置并切入 gaming
    if (entity.hasTag("tutorial-end")) {
      resetWorld(this.scene.world);
      getGameStateComponent(this.gameStateQuery).gameStatus = "gaming";
      return;
    }

    const canAvoid =
      (Runner.isCrouching(runnerPosition, runnerState) &&
        obstacle.skippedStates.includes(RunnerState.Crouch)) ||
      (Runner.isJumping(runnerPosition, runnerState) &&
        obstacle.skippedStates.includes(RunnerState.Jump));

    const gameState = getGameStateComponent(this.gameStateQuery);
    if (canAvoid) {
      if (gameState.gameStatus !== "tutorial") {
        gameState.score.challenges += 2 * TILE_SIZE;
      }
      return;
    }

    if (gameState.gameStatus === "tutorial") {
      // 教程状态：不结束游戏，立即整局重置（同 ResetSystem 的 gameOver 重置）。
      // 道路、转弯状态（RoadTurnComponent）、生成器等全部从起点重新生成，
      // 避免 turn.roadDist 停留在上一命已越过的转弯上，
      // 导致后续转弯渲染错乱（转弯消失）且到达转弯前即被撞回起点。
      resetWorld(this.scene.world);
      getGameStateComponent(this.gameStateQuery).gameStatus = "tutorial";
      return;
    }

    triggerGameOver(
      runnerPosition,
      runnerMotion,
      getCameraPositionComponent(this.cameraQuery),
      this.cameraQuery.entities[0].get(MotionComponent),
      gameState,
      obstacleRoadDist - 1,
    );
  }
}
