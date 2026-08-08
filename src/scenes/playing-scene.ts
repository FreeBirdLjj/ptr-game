import {
  Color,
  Scene,
  type SceneActivationContext,
  type Engine,
} from "excalibur";
import { setupTouchInput } from "../inputs/touch";
import { setupWorld } from "../interactions/world";
import {
  GameStateComponent,
  getGameStateComponent,
  type GameStatus,
} from "../components/singletons/game-state-component";

interface PlayingSceneActivationData {
  gameStatus: GameStatus;
}

export class PlayingScene extends Scene<PlayingSceneActivationData> {
  override onInitialize(): void {
    this.backgroundColor = Color.fromHex("#1a1a2e");

    setupTouchInput(this.input);
    setupWorld(this.world);
  }

  override onActivate(
    context: SceneActivationContext<PlayingSceneActivationData>,
  ): void {
    if (context.data) {
      const query = this.world.query([GameStateComponent]);
      getGameStateComponent(query).gameStatus = context.data.gameStatus;
    }
  }
}

export async function goToPlayingScene(
  engine: Engine,
  data?: PlayingSceneActivationData,
): Promise<void> {
  return engine.goToScene("playing", { sceneActivationData: data });
}
