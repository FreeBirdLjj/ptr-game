import { Component, Random, type Query, type ComponentCtor } from "excalibur";
import type { makeRoadGenerator } from "../../core/road";

export type GameStatus = "tutorial" | "gaming" | "gameOver";

export class GameStateComponent extends Component {
  gameStatus: GameStatus = "gaming";
  elapsedTime = 0;
  rng = new Random();
  /** 由 RoadConstructionSystem 在更新时惰性初始化 */
  roadGenerator?: ReturnType<typeof makeRoadGenerator>;
  /** 教程阶段生成的 tile 数，作为 gaming 道路的起始索引 */
  tutorialTileCount = 0;
  score = {
    dist: 0,
    challenges: 0,
  };

  get totalScore(): number {
    return Math.floor(Object.values(this.score).reduce((a, b) => a + b, 0));
  }
}

export function getGameStateComponent(
  query: Query<typeof GameStateComponent | ComponentCtor>,
): GameStateComponent {
  for (const e of query.entities) {
    return e.get(GameStateComponent);
  }
  throw new Error("GameStateComponent not found");
}
