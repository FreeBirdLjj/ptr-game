import {
  System,
  SystemType,
  World,
  Query,
  Keys,
  GraphicsComponent,
  type Scene,
} from "excalibur";
import {
  RunnerStateComponent,
  getRunnerStateComponent,
} from "../components/singletons/runner-state-component";
import { RoadPositionComponent } from "../components/road-position-component";
import { RoadGraphicsComponent } from "../components/road-graphics-component";
import { Runner } from "../interactions/runner";
import {
  applyRunnerGraphics,
  type RunnerGraphicsState,
} from "../graphics/runner-graphics";
import {
  RoadTurnComponent,
  getRoadTurnComponent,
} from "../components/singletons/road-turn-component";
import { getGameStateComponent } from "../components/singletons/game-state-component";
import { TurnDir } from "../core/road";
import { LANES } from "../core/road";
import { TILE_SIZE } from "../core/road-position";
import { goToTurningAnimationScene } from "../scenes/turning-animation-scene";
import { WithGameStateFilter } from "./util";

export class RunnerSystem extends WithGameStateFilter(System) {
  override systemType = SystemType.Update;

  private runnerQuery!: Query<
    | typeof RunnerStateComponent
    | typeof RoadPositionComponent
    | typeof GraphicsComponent
  >;
  private turnQuery!: Query<typeof RoadTurnComponent>;
  private keyboard!: Scene["input"]["keyboard"];
  private scene!: Scene;
  /** 上一次应用的 runner 视觉状态（用于从 dead 恢复时继续播放动画） */
  private lastRunnerState: RunnerGraphicsState = "running";

  override onInitialize(world: World, scene: Scene): void {
    this.scene = scene;
    this.keyboard = scene.input.keyboard;
    this.runnerQuery = world.query([
      RunnerStateComponent,
      RoadPositionComponent,
      GraphicsComponent,
    ]);
    this.turnQuery = world.query([RoadTurnComponent]);
  }

  override gameStatusHandlers = {
    tutorial: (_elapsedMs: number): void => {
      this.run();
    },
    gaming: (_elapsedMs: number): void => {
      this.run();
    },
    gameOver: (_elapsedMs: number): void => {
      this.applyVisual("dead");
    },
  };

  /** 取 runner 实体的视觉组件并应用状态（纹理/世界顶点/动画控制） */
  private applyVisual(state: RunnerGraphicsState): void {
    const graphics = this.runnerQuery.entities[0].get(GraphicsComponent);
    if (!(graphics instanceof RoadGraphicsComponent)) return;
    applyRunnerGraphics(graphics, state, this.lastRunnerState);
    this.lastRunnerState = state;
  }

  private run(): void {
    const runnerState = getRunnerStateComponent(this.runnerQuery);
    const runnerPosition = this.runnerQuery.entities[0].get(
      RoadPositionComponent,
    );

    // 转弯检测
    const turn = getRoadTurnComponent(this.turnQuery);
    const rd = runnerPosition.roadDist;
    if (
      turn.roadDist > 0 &&
      rd > turn.roadDist - LANES * TILE_SIZE &&
      rd < turn.roadDist
    ) {
      const roadTurnDir = turn.dir;
      let runnerTurnDir: TurnDir | null = null;

      if (this.keyboard.wasPressed(Keys.Left)) {
        runnerTurnDir = TurnDir.Left;
      } else if (this.keyboard.wasPressed(Keys.Right)) {
        runnerTurnDir = TurnDir.Right;
      }

      if (runnerTurnDir) {
        if (runnerTurnDir === roadTurnDir) {
          const gameState = getGameStateComponent(this.gameStateQuery);
          if (gameState.gameStatus !== "tutorial") {
            gameState.score.challenges += 3 * TILE_SIZE;
          }
          void goToTurningAnimationScene(this.scene.engine, {
            turnDir: roadTurnDir,
          });
          return;
        }
      }
    }

    if (this.keyboard.wasPressed(Keys.Left)) {
      Runner.tryMoveLeft(runnerPosition, runnerState);
    } else if (this.keyboard.wasPressed(Keys.Right)) {
      Runner.tryMoveRight(runnerPosition, runnerState);
    } else if (this.keyboard.wasPressed(Keys.Up)) {
      Runner.tryJump(runnerPosition, runnerState);
    } else if (this.keyboard.wasPressed(Keys.Down)) {
      Runner.tryCrouch(runnerPosition, runnerState);
    }

    const runnerVisualState: RunnerGraphicsState = Runner.isJumping(
      runnerPosition,
      runnerState,
    )
      ? "jumping"
      : Runner.isCrouching(runnerPosition, runnerState)
        ? "crouching"
        : "running";

    this.applyVisual(runnerVisualState);
  }
}
