import {
  Animation,
  AnimationStrategy,
  Entity,
  GraphicsComponent,
  Scene,
  Sprite,
  SpriteSheet,
  TransformComponent,
  vec,
  type Engine,
  type SceneActivationContext,
} from "excalibur";
import { Assets } from "../core/assets";
import { TurnDir } from "../core/road";
import {
  CameraPositionComponent,
  getCameraPositionComponent,
} from "../components/singletons/camera-position-component";
import {
  RoadTurnComponent,
  getRoadTurnComponent,
} from "../components/singletons/road-turn-component";
import { RoadPositionComponent } from "../components/road-position-component";
import {
  RUNNER_FRAME_WIDTH,
  RUNNER_RUNNING_FRAME_HEIGHT,
} from "../graphics/runner-graphics";
import { teleportTo } from "../interactions/game";
import { goToPlayingScene } from "./playing-scene";

const SLIDE_STEP = 20; // 每帧背景滑动的像素数
const SLIDE_TOTAL = 600; // 滑动总距离（= 画布宽，从一半滑到另一半）

export interface TurningAnimationData {
  turnDir: TurnDir;
}

export class TurningAnimationScene extends Scene<TurningAnimationData> {
  private data!: TurningAnimationData;
  /** 背景窗口的 x 偏移（0..600）：左转 600→0，右转 0→600 */
  private slideX = 0;
  private backgroundTransform!: TransformComponent;

  override onInitialize(): void {
    // 背景：整张 turning-background.png（1200x800）挂在实体上，中心锚点随 slideX 平移。
    // 注意：Excalibur 默认相机位于内容区中心（300,400），本场景世界坐标 == 屏幕坐标，
    // 可见世界为 x∈[0,600]、y∈[0,800]；背景实体置于 (600-slideX, 400) 时，
    // 屏幕上恰好露出 image[slideX..slideX+600] 的 600x800 窗口。
    const backgroundTransform = new TransformComponent();
    backgroundTransform.z = 0;
    // y 固定：贴图高 800、中心锚点，置于画布高一半处恰好覆盖整个屏幕（x 随滑动在 onPreUpdate 更新）
    backgroundTransform.pos.y = this.engine.drawHeight / 2;
    const background = new Entity({
      name: "turning-background",
      components: [
        backgroundTransform,
        new GraphicsComponent({
          graphics: {
            default: new Sprite({ image: Assets.images.turningBackground }),
          },
        }),
      ],
    });
    this.backgroundTransform = backgroundTransform;
    this.add(background);

    // 前景：与 running 状态完全一致的 Runner 动画（pt-normal.png 两帧 200ms 循环）
    const runnerTransform = new TransformComponent();
    // 固定位置（中心锚点，屏幕坐标）：水平居中、脚底恰好踩在画布底线
    runnerTransform.pos = vec(
      this.engine.drawWidth / 2,
      this.engine.drawHeight - RUNNER_RUNNING_FRAME_HEIGHT / 2,
    );
    runnerTransform.z = 1;
    const runner = new Entity({
      name: "turning-runner",
      components: [
        runnerTransform,
        new GraphicsComponent({
          graphics: {
            default: Animation.fromSpriteSheet(
              SpriteSheet.fromImageSource({
                image: Assets.images.ptNormal,
                grid: {
                  rows: 1,
                  columns: 2,
                  spriteWidth: RUNNER_FRAME_WIDTH,
                  spriteHeight: RUNNER_RUNNING_FRAME_HEIGHT,
                },
              }),
              [0, 1],
              200,
              AnimationStrategy.Loop,
            ),
          },
        }),
      ],
    });
    this.add(runner);
  }

  override onActivate(
    context: SceneActivationContext<TurningAnimationData>,
  ): void {
    if (!context.data) return;

    this.data = context.data;
    this.slideX = this.data.turnDir === TurnDir.Left ? SLIDE_TOTAL : 0;

    this.applyToPlayingWorld();
  }

  override onPreUpdate(_engine: Engine, _elapsedMs: number): void {
    const step = this.data.turnDir === TurnDir.Left ? -SLIDE_STEP : SLIDE_STEP;
    this.slideX += step;
    // 屏幕坐标：slideX 0→600 时背景实体从 x=600 平移到 x=0（露出左半→右半）
    this.backgroundTransform.pos.x = SLIDE_TOTAL - this.slideX;
    if (this.slideX <= 0 || this.slideX >= SLIDE_TOTAL) {
      this.slideX = Math.min(SLIDE_TOTAL, Math.max(0, this.slideX));
      void goToPlayingScene(this.engine);
    }
  }

  private applyToPlayingWorld(): void {
    const playingWorld = (this.engine.scenes.playing as Scene).world;

    const runnerQuery = playingWorld.query([RoadPositionComponent]);
    const cameraPositionQuery = playingWorld.query([CameraPositionComponent]);
    const turnQuery = playingWorld.query([RoadTurnComponent]);

    const runnerPosition = runnerQuery.entities[0].get(RoadPositionComponent);
    const cameraPosition = getCameraPositionComponent(cameraPositionQuery);
    const turn = getRoadTurnComponent(turnQuery);

    // 瞬移到正在完成的弯（runner 前方最近的弯）之后
    const nextTurn = turn.nextTurn(cameraPosition.roadDist);
    if (nextTurn.roadDist === -Infinity) return;
    teleportTo(runnerPosition, cameraPosition, nextTurn.roadDist + 6);
  }
}

export async function goToTurningAnimationScene(
  engine: Engine,
  data: TurningAnimationData,
): Promise<void> {
  return engine.goToScene("turningAnimation", { sceneActivationData: data });
}
