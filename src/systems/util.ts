import { System, World, Query, type Scene } from "excalibur";
import {
  GameStateComponent,
  getGameStateComponent,
  type GameStatus,
} from "../components/singletons/game-state-component";
import type { AbstractConstructor } from "../core/type";

export function WithGameStateFilter<T extends AbstractConstructor<System>>(
  BaseSystem: T,
) {
  abstract class SystemWithGameStateFilter extends BaseSystem {
    protected abstract readonly gameStatusHandlers: Partial<
      Record<GameStatus, (elapsedMs: number) => void>
    >;
    protected gameStateQuery!: Query<typeof GameStateComponent>;

    /** 子类初始化钩子（避免与 Excalibur 生命周期 onInitialize 混淆） */
    protected onGameStateFilterInitialize?(world: World, scene: Scene): void;

    override onInitialize(world: World, scene: Scene): void {
      this.gameStateQuery = world.query([GameStateComponent]);
      this.onGameStateFilterInitialize?.(world, scene);
    }

    override onUpdate(elapsedMs: number): void {
      const gameState = getGameStateComponent(this.gameStateQuery);
      const handler = this.gameStatusHandlers[gameState.gameStatus];
      handler?.(elapsedMs);
    }
  }
  return SystemWithGameStateFilter;
}
