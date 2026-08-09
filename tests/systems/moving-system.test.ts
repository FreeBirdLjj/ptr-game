import { describe, it, expect, vi, beforeEach } from "vitest";
import { Scene, Entity, SystemType, Random } from "excalibur";
import { SingletonEntity } from "../../src/entities/singleton-entity";
import { RoadPositionComponent } from "../../src/components/road-position-component";
import { CameraPositionComponent } from "../../src/components/singletons/camera-position-component";
import {
  RoadTurnComponent,
  getRoadTurnComponent,
} from "../../src/components/singletons/road-turn-component";
import {
  GameStateComponent,
  getGameStateComponent,
} from "../../src/components/singletons/game-state-component";
import { ObstacleColliderComponent } from "../../src/components/obstacle-collider-component";
import { RunnerStateComponent } from "../../src/components/singletons/runner-state-component";
import { RunnerState } from "../../src/components/obstacle-collider-component";
import { RoadConstructionSystem } from "../../src/systems/road-construction-system";
import { RoadGraphicsUpdateSystem } from "../../src/systems/road-graphics-update-system";
import { RoadCleaningSystem } from "../../src/systems/road-cleaning-system";
import { MovingSystem } from "../../src/systems/moving-system";
import { RunnerSystem } from "../../src/systems/runner-system";
import { teleportTo } from "../../src/interactions/game";
import type { MotionComponent } from "excalibur";

// happy-dom 无 canvas 2d context，用 Proxy 兜底所有方法（resetWorld 会重建背景/UI 实体）
HTMLCanvasElement.prototype.getContext = (() =>
  new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === "canvas") return { width: 0, height: 0 };
        if (property === "measureText") {
          return () => ({
            width: 0,
            actualBoundingBoxAscent: 0,
            actualBoundingBoxDescent: 0,
            fontBoundingBoxAscent: 0,
            fontBoundingBoxDescent: 0,
          });
        }
        return () => undefined;
      },
    },
  )) as never;

const FRAME_MS = 33; // 游戏 maxFps=30

// triggerGameOver 的 mock 状态：碰撞测试置为 no-op（让 runner 继续前进以覆盖转弯后的障碍）；
// 计分测试调用原版（保留防重/瞬移/计分，计分经 scoreboard mock 记录）
const mockState = { callOriginalTriggerGameOver: false };
const gameOverHits: { obstacleRoadDist: number }[] = [];
vi.mock("../../src/interactions/game", async (importOriginal) => {
  const originalModule =
    await importOriginal<typeof import("../../src/interactions/game")>();
  return {
    ...originalModule,
    triggerGameOver: (
      runnerPosition: RoadPositionComponent,
      runnerMotion: MotionComponent,
      cameraPosition: CameraPositionComponent,
      _cameraMotion: MotionComponent,
      gameState: GameStateComponent,
      backToRoadDist?: number,
    ) => {
      gameOverHits.push({
        obstacleRoadDist:
          backToRoadDist !== undefined ? backToRoadDist + 1 : -1,
      });
      if (mockState.callOriginalTriggerGameOver) {
        originalModule.triggerGameOver(
          runnerPosition,
          runnerMotion,
          cameraPosition,
          _cameraMotion,
          gameState,
          backToRoadDist,
        );
      }
    },
  };
});

const recordScoreCalls: number[] = [];
vi.mock("../../src/core/scoreboard", async (importOriginal) => {
  const originalModule =
    await importOriginal<typeof import("../../src/core/scoreboard")>();
  return {
    ...originalModule,
    recordScore: (score: number) => {
      recordScoreCalls.push(score);
    },
  };
});

function makeBaseScene(systems: unknown[]): Scene {
  const scene = new Scene();
  // resetWorld 会读取 engine.screen 的尺寸，未挂 engine 时用固定逻辑分辨率
  (scene as unknown as { engine: unknown }).engine = {
    screen: { drawWidth: 600, drawHeight: 800 },
    stats: { currFrame: { actors: { killed: 0 }, systemDuration: {} } },
  };
  const systemManager = scene.world.systemManager as unknown as {
    systems: unknown[];
    removeSystem(system: unknown): void;
    initialize(): void;
  };
  for (const system of [...systemManager.systems]) {
    const name = (system as { constructor: { name: string } }).constructor.name;
    if (
      [
        "PointerSystem",
        "GraphicsSystem",
        "OffscreenSystem",
        "DebugSystem",
      ].includes(name)
    ) {
      systemManager.removeSystem(system);
    }
  }

  // stub 输入：无按键（runner 不会主动转弯/移动/跳跃）
  const keyboard = { wasPressed: () => false } as never;
  (scene as unknown as { input: unknown }).input = {
    keyboard,
    pointers: {},
  };

  // 与 main.ts 一致：物理 substep=8
  scene.physics.config.substep = 8;

  for (const system of systems) {
    scene.world.add(system);
  }
  systemManager.initialize();
  return scene;
}

function setupGame(seed: number): {
  scene: Scene;
  runner: Entity;
  camera: CameraPositionComponent;
} {
  const scene = makeBaseScene([
    new RoadConstructionSystem(),
    new RoadGraphicsUpdateSystem(),
    new RoadCleaningSystem(),
    new MovingSystem(),
    new RunnerSystem(),
  ]);

  scene.world.add(new SingletonEntity());
  const gameState = getGameStateComponent(
    scene.world.query([GameStateComponent]),
  );
  gameState.rng = new Random(seed);

  // runner：唯一带 RoadPositionComponent 且无 ObstacleColliderComponent 的实体
  const roadQuery = scene.world.query([RoadPositionComponent]);
  const runner = roadQuery.entities.find(
    (entity) => entity.get(ObstacleColliderComponent) === undefined,
  ) as Entity;
  const camera = scene.world
    .query([CameraPositionComponent])
    .entities[0].get(CameraPositionComponent);
  return { scene, runner, camera };
}

describe("MovingSystem", () => {
  beforeEach(() => {
    mockState.callOriginalTriggerGameOver = false;
    gameOverHits.length = 0;
    recordScoreCalls.length = 0;
  });

  describe("road-space collision", () => {
    it("转弯后障碍无穿透、瞬移不误判、车道匹配", () => {
      const { scene, runner, camera } = setupGame(42);

      // 每帧记录活跃障碍（被清理系统 kill 后无法再读取）
      const obstacles = new Map<string, { roadDist: number; lane: number }>();
      const obstacleQuery = scene.world.query([
        RoadPositionComponent,
        ObstacleColliderComponent,
      ]);
      let turnCompleted = false;
      let turnRoadDist = -1;

      const maxFrames = 60 * 45; // 模拟 45 秒
      for (let frame = 0; frame < maxFrames; frame++) {
        for (const entity of obstacleQuery.entities) {
          if (!entity.isActive) continue;
          const position = entity.get(RoadPositionComponent);
          obstacles.set(
            `${String(position.roadDist)}#${String(position.lane)}`,
            {
              roadDist: position.roadDist,
              lane: position.lane,
            },
          );
        }

        const runnerPosition = runner.get(RoadPositionComponent);
        const turn = getRoadTurnComponent(
          scene.world.query([RoadTurnComponent]),
        );
        const nextTurn = turn.nextTurn(runnerPosition.roadDist);

        // 模拟转弯：切场景冻结 30 帧后瞬移过弯（对应真实动画流程）
        if (
          !turnCompleted &&
          nextTurn.roadDist > 0 &&
          runnerPosition.roadDist > nextTurn.roadDist - 600 &&
          runnerPosition.roadDist < nextTurn.roadDist
        ) {
          turnRoadDist = nextTurn.roadDist;
          for (let frozenFrame = 0; frozenFrame < 30; frozenFrame++) {
            scene.world.update(SystemType.Update, FRAME_MS);
          }
          teleportTo(runnerPosition, camera, nextTurn.roadDist + 6);
          turnCompleted = true;
        }

        scene.world.update(SystemType.Update, FRAME_MS);

        if (turnCompleted && runnerPosition.roadDist > 15000) break;
      }

      expect(turnCompleted).toBe(true);

      const runnerFinalRoadDist = runner.get(RoadPositionComponent).roadDist;
      const hitRoadDists = new Set(
        gameOverHits.map((hit) => hit.obstacleRoadDist),
      );
      // 转弯后、runner 已越过的 lane-1 障碍（含转弯标记）
      const lane1ObstaclesAfterTurn = [...obstacles.values()].filter(
        (obstacle) =>
          obstacle.roadDist > turnRoadDist &&
          obstacle.roadDist < runnerFinalRoadDist &&
          obstacle.lane === 1,
      );
      // 转弯标记（roadDist 为 tile 起点，区别于障碍中心）
      const turnsAfterTurn = [...obstacles.values()].filter(
        (obstacle) =>
          obstacle.roadDist > turnRoadDist &&
          obstacle.roadDist < runnerFinalRoadDist &&
          obstacle.roadDist % 200 === 0,
      );

      // 1. 无穿透：转弯后所有 lane-1 障碍都被命中
      const missed = lane1ObstaclesAfterTurn.filter(
        (obstacle) => !hitRoadDists.has(obstacle.roadDist),
      );
      expect(missed).toEqual([]);

      // 2. 瞬移不误判：完成的转弯不在命中列表
      expect(hitRoadDists.has(turnRoadDist)).toBe(false);

      // 3. 车道匹配：lane 0/2 的障碍不应被命中。
      //    hitRoadDists 只记 roadDist，同 tile 的 lane-1 障碍被命中时也会命中该值，
      //    因此仅当该 roadDist 无 lane-1 障碍时才视为 lane 0/2 真命中
      const otherLaneObstaclesAfterTurn = [...obstacles.values()].filter(
        (obstacle) =>
          obstacle.roadDist > turnRoadDist &&
          obstacle.roadDist < runnerFinalRoadDist &&
          obstacle.lane !== 1,
      );
      const lane1RoadDists = new Set(
        lane1ObstaclesAfterTurn.map((obstacle) => obstacle.roadDist),
      );
      const falseHits = otherLaneObstaclesAfterTurn.filter(
        (obstacle) =>
          hitRoadDists.has(obstacle.roadDist) &&
          !lane1RoadDists.has(obstacle.roadDist),
      );
      expect(falseHits).toEqual([]);

      // 4. 转弯标记至少出现一次（场景有效）
      expect(turnsAfterTurn.length).toBeGreaterThan(0);
    });
  });

  describe("death scoring", () => {
    it("recordScore 分数应与死亡帧 score.dist 一致", () => {
      mockState.callOriginalTriggerGameOver = true;
      const { scene } = setupGame(42);
      const gameState = getGameStateComponent(
        scene.world.query([GameStateComponent]),
      );

      let lastDist = -1;
      const maxFrames = 60 * 60 * 30;
      for (let frame = 0; frame < maxFrames; frame++) {
        scene.world.update(SystemType.Update, FRAME_MS);
        lastDist = gameState.score.dist;
        if (recordScoreCalls.length >= 1) break;
      }

      expect(recordScoreCalls.length).toBe(1);
      // gaming 模式无输入：challenges = 0，recordScore 与 UI 显示的 totalScore 同源
      expect(recordScoreCalls[0]).toBe(Math.floor(lastDist));
    });
  });

  describe("turn failure death position", () => {
    it("过第一个弯后，第二个弯失败死亡：前方最近弯不应错位（回归）", () => {
      mockState.callOriginalTriggerGameOver = true;
      const { scene, runner, camera } = setupGame(42);

      // 记录依次成为“前方最近弯”的转弯点
      const turnsSeen: number[] = [];
      let turnACrossed = false;
      let turnRoadDistAtDeath = -1;
      const maxFrames = 60 * 60 * 30;
      for (let frame = 0; frame < maxFrames; frame++) {
        const turn = getRoadTurnComponent(
          scene.world.query([RoadTurnComponent]),
        );
        const runnerPosition = runner.get(RoadPositionComponent);
        const nextTurn = turn.nextTurn(runnerPosition.roadDist);
        if (
          nextTurn.roadDist > 0 &&
          turnsSeen[turnsSeen.length - 1] !== nextTurn.roadDist
        ) {
          turnsSeen.push(nextTurn.roadDist);
        }

        // 过第一个弯：进入窗口时瞬移过弯（模拟转弯成功）
        if (
          !turnACrossed &&
          turnsSeen.length >= 1 &&
          runnerPosition.roadDist > turnsSeen[0] - 600 &&
          runnerPosition.roadDist < turnsSeen[0]
        ) {
          teleportTo(runnerPosition, camera, turnsSeen[0] + 6);
          turnACrossed = true;
        }
        // 第二个弯：故意不按键（转弯失败）

        // 过弯前模拟躲避：接近同车道障碍时跳/蹲，保证活到第一个弯
        const inFirstTurnWindow =
          turnsSeen.length >= 1 &&
          runnerPosition.roadDist > turnsSeen[0] - 600 &&
          runnerPosition.roadDist < turnsSeen[0];
        if (!inFirstTurnWindow) {
          const runnerState = runner.get(RunnerStateComponent);
          for (const entity of scene.world.query([RoadPositionComponent])
            .entities) {
            if (entity.get(ObstacleColliderComponent) === undefined) continue;
            const obstacle = entity.get(ObstacleColliderComponent);
            if (obstacle.skippedStates.length === 0) continue;
            const position = entity.get(RoadPositionComponent);
            const gap = position.roadDist - runnerPosition.roadDist;
            if (gap > 0 && gap < 60 && position.lane === runnerPosition.lane) {
              if (obstacle.skippedStates.includes(RunnerState.Jump)) {
                runnerState.jumpStart = runnerPosition.roadDist;
                runnerState.jumpEnd = runnerPosition.roadDist + 300;
              } else if (obstacle.skippedStates.includes(RunnerState.Crouch)) {
                runnerState.crouchStart = runnerPosition.roadDist;
                runnerState.crouchEnd = runnerPosition.roadDist + 300;
              }
            }
          }
        }

        scene.world.update(SystemType.Update, FRAME_MS);
        const gameState = getGameStateComponent(
          scene.world.query([GameStateComponent]),
        );
        if (gameState.gameStatus === "gameOver") {
          turnRoadDistAtDeath = getRoadTurnComponent(
            scene.world.query([RoadTurnComponent]),
          ).nextTurn(runner.get(RoadPositionComponent).roadDist).roadDist;
          break;
        }
      }

      // 玩家撞在第二个弯（turnsSeen[1]）处死亡
      expect(turnACrossed).toBe(true);
      expect(runner.get(RoadPositionComponent).roadDist).toBe(turnsSeen[1] - 1);
      // 关键：死亡时「当前转弯」应仍是第二个弯，不得提前推进到第三个
      expect(turnRoadDistAtDeath).toBe(turnsSeen[1]);
      // 定格画面：camera 与 runner 同步停在弯前（不因只停 runner 速度而多走一帧）
      const cameraPosition = scene.world
        .query([CameraPositionComponent])
        .entities[0].get(CameraPositionComponent);
      expect(cameraPosition.roadDist).toBe(turnsSeen[1] - 1);
    });
  });
});
