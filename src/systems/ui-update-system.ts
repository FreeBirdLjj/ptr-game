import {
  GraphicsComponent,
  Query,
  System,
  SystemType,
  Text,
  World,
  type Scene,
} from "excalibur";
import {
  GameStateComponent,
  getGameStateComponent,
  type GameStatus,
} from "../components/singletons/game-state-component";
import { GameOverBoard } from "../ui/game-over-board";
import { listScores } from "../core/scoreboard";

/**
 * UI 更新系统：驱动两个 UI 实体（tag "ui-score" 分数文本 / "ui-board" 结算面板）。
 * 两个实体均由 setupWorldEntities 创建（resetWorld 后重建），以 z = Infinity 标记
 * （GraphicsSystem 按 globalZ 升序绘制，UI 恒在最上层），本系统只负责：
 * - 可见性：gaming 显示分数、gameOver 显示面板、其余隐藏
 * - 文本：分数变化时更新 Text
 * - 面板：进入 gameOver 时用本次分数与排行榜重建（show，仅一次）
 *
 * 实际绘制由标准 GraphicsSystem 完成。
 */
export class UIUpdateSystem extends System {
  readonly systemType = SystemType.Update;

  private gameStateQuery!: Query<typeof GameStateComponent>;
  // tag 定位 + components.all 保证实体必有 GraphicsComponent（get 返回确定类型，
  // 类型参数与运行时查询条件一致）
  private scoreQuery!: Query<typeof GraphicsComponent>;
  private boardQuery!: Query<typeof GraphicsComponent>;
  private lastStatus: GameStatus | undefined;

  override initialize(world: World, _scene: Scene): void {
    this.gameStateQuery = world.query([GameStateComponent]);
    // tag 与实体 name 同名（见 world.ts 的 addTag）
    this.scoreQuery = world.query({
      components: { all: [GraphicsComponent] },
      tags: { all: ["ui-score"] },
    });
    this.boardQuery = world.query({
      components: { all: [GraphicsComponent] },
      tags: { all: ["ui-board"] },
    });
  }

  update(_elapsed: number): void {
    const gameState = getGameStateComponent(this.gameStateQuery);
    const status = gameState.gameStatus;
    const score = gameState.totalScore;

    // UI 实体由 setupWorldEntities 同步创建/重建（resetWorld 为同步函数，
    // query 不会出现空或新旧混合的可观察状态），entities[0] 恒存在
    const scoreGraphics = this.scoreQuery.entities[0].get(GraphicsComponent);
    scoreGraphics.isVisible = status === "gaming";
    if (scoreGraphics.isVisible) {
      const text = scoreGraphics.current;
      if (text instanceof Text) {
        text.text = `Score: ${String(score)}`;
      }
    }

    const boardGraphics = this.boardQuery.entities[0].get(GraphicsComponent);
    boardGraphics.isVisible = status === "gameOver";
    // 进入 gameOver 时用本次分数与排行榜重建面板数据（仅一次）
    if (boardGraphics.isVisible && status !== this.lastStatus) {
      const board = boardGraphics.current;
      if (board instanceof GameOverBoard) {
        board.show(listScores(), score);
      }
    }

    this.lastStatus = status;
  }
}
