import {
  System,
  SystemType,
  World,
  Query,
  Random,
  type Scene,
} from "excalibur";
import {
  CameraPositionComponent,
  getCameraPositionComponent,
} from "../components/singletons/camera-position-component";
import {
  RoadTurnComponent,
  getRoadTurnComponent,
} from "../components/singletons/road-turn-component";
import {
  getGameStateComponent,
  type GameStateComponent,
} from "../components/singletons/game-state-component";
import { roadPositionTo3D, TILE_SIZE } from "../core/road-position";
import { AbsoluteProjection } from "../core/absolute-projection";
import {
  RoadEntity,
  newTileEntity,
  newGateEntity,
  newHurdleEntity,
  newTurnEntity,
  newTutorialEndEntity,
  newTutorialText,
} from "../entities/road-entity";
import {
  makeRoadGenerator,
  Obstacle,
  LANES,
  isObstacle,
  isTutorialElement,
  type GamingRoadSegmentData,
  type TutorialRoadSegmentData,
} from "../core/road";
import { WithGameStateFilter } from "./util";

type ObstacleFactory = (lane: number, roadDist: number) => RoadEntity;

const OBSTACLE_FACTORY: Record<Obstacle, ObstacleFactory> = {
  [Obstacle.Gate]: newGateEntity,
  [Obstacle.Hurdle]: newHurdleEntity,
};

function randomColor(rng: Random): string {
  const r = rng.integer(64, 191);
  const g = rng.integer(64, 191);
  const b = rng.integer(64, 191);
  return `rgb(${String(r)},${String(g)},${String(b)})`;
}

// ── System ──────────────────────────────────────────────────

export class RoadConstructionSystem extends WithGameStateFilter(System) {
  override systemType = SystemType.Update;

  private camQuery!: Query<typeof CameraPositionComponent>;
  private turnQuery!: Query<typeof RoadTurnComponent>;
  private world!: World;

  override onInitialize(world: World, _scene: Scene): void {
    this.world = world;
    this.camQuery = world.query([CameraPositionComponent]);
    this.turnQuery = world.query([RoadTurnComponent]);
  }

  override gameStatusHandlers = {
    tutorial: (_elapsedMs: number): void => {
      this.constructRoad(true);
    },
    gaming: (_elapsedMs: number): void => {
      this.constructRoad(false);
    },
  };

  private constructRoad(includingTutorial: boolean): void {
    const gameState = getGameStateComponent(this.gameStateQuery);
    const gen = (gameState.roadGenerator ??= makeRoadGenerator(
      gameState.rng,
      includingTutorial,
    ));
    const turn = getRoadTurnComponent(this.turnQuery);
    const camZ = getCameraPositionComponent(this.camQuery).roadDist;

    if (turn.roadDist > camZ) return;

    const maxZ = camZ + AbsoluteProjection.MAX_Z;

    for (;;) {
      const result = gen.next();
      if (result.done) break;
      const segment = result.value;
      switch (segment[1]) {
        case "gaming":
          this.constructGamingRoadSegment(segment, gameState, turn);
          break;
        case "tutorial":
          this.constructTutorialRoadSegment(segment, gameState, turn);
          break;
      }
      const rd = (segment[0] + 0.5) * TILE_SIZE;
      const { x, z } = roadPositionTo3D(1, rd, turn.roadDist, turn.dir, camZ);
      const hasNewTurn = rd >= turn.roadDist && turn.roadDist > camZ;
      if (hasNewTurn) {
        if (Math.abs(x) >= 1000) break;
      } else if (z >= maxZ) {
        break;
      }
    }
  }

  private constructGamingRoadSegment(
    segment: GamingRoadSegmentData,
    gameState: GameStateComponent,
    turn: RoadTurnComponent,
  ): void {
    const [idx, , dir, obstacles] = segment;

    for (let lane = 0; lane < LANES; lane++) {
      this.addTileEntity(lane, idx, randomColor(gameState.rng));
      const obstacle = obstacles[lane];
      if (obstacle !== null) {
        this.addObstacleEntity(obstacle, lane, idx);
      }
    }

    if (dir !== "straight") {
      turn.roadDist = idx * TILE_SIZE;
      turn.dir = dir;
      this.addTurnEntity(idx);
    }
  }

  private constructTutorialRoadSegment(
    segment: TutorialRoadSegmentData,
    gameState: GameStateComponent,
    turn: RoadTurnComponent,
  ): void {
    const [idx, , dir, element] = segment;
    gameState.tutorialTileCount = idx + 1;

    for (let lane = 0; lane < LANES; lane++) {
      this.addTileEntity(lane, idx, randomColor(gameState.rng));
    }

    if (isObstacle(element)) {
      for (let lane = 0; lane < LANES; lane++) {
        this.addObstacleEntity(element, lane, idx);
      }
    } else if (isTutorialElement(element)) {
      this.addTutorialEndEntity(idx);
    } else if (typeof element === "string") {
      this.addTutorialTextEntity(idx, element);
    }

    if (dir !== "straight") {
      turn.roadDist = idx * TILE_SIZE;
      turn.dir = dir;
      this.addTurnEntity(idx);
    }
  }

  // ── 实体构建 ────────────────────────────────────────────────

  /** 路面 tile：中心位于 tile 中心 (tileIndex + 0.5) * TILE_SIZE */
  private addTileEntity(lane: number, tileIndex: number, color: string): void {
    this.world.add(newTileEntity(lane, (tileIndex + 0.5) * TILE_SIZE, color));
  }

  /** 障碍物（门/跨栏）：中心位于 tile 中心 */
  private addObstacleEntity(
    kind: Obstacle,
    lane: number,
    tileIndex: number,
  ): void {
    this.world.add(OBSTACLE_FACTORY[kind](lane, (tileIndex + 0.5) * TILE_SIZE));
  }

  /** 转弯标记：位于 tile 起点 tileIndex * TILE_SIZE */
  private addTurnEntity(tileIndex: number): void {
    this.world.add(newTurnEntity(tileIndex * TILE_SIZE));
  }

  /** 教程终点：位于 tile 远端 (tileIndex + 1) * TILE_SIZE */
  private addTutorialEndEntity(tileIndex: number): void {
    this.world.add(newTutorialEndEntity((tileIndex + 1) * TILE_SIZE));
  }

  /** 教程提示文字：中心位于 tile 中心 */
  private addTutorialTextEntity(tileIndex: number, text: string): void {
    this.world.add(newTutorialText((tileIndex + 0.5) * TILE_SIZE, text));
  }
}
