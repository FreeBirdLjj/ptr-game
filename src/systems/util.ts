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

    onInitialize?(world: World, scene: Scene): void;

    override initialize(world: World, scene: Scene): void {
      this.gameStateQuery = world.query([GameStateComponent]);
      this.onInitialize?.(world, scene);
    }

    override update(elapsedMs: number): void {
      const gameState = getGameStateComponent(this.gameStateQuery);
      const handler = this.gameStatusHandlers[gameState.gameStatus];
      handler?.(elapsedMs);
    }
  }
  return SystemWithGameStateFilter;
}
