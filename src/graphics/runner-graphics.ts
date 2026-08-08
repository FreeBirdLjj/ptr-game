import {
  Animation,
  AnimationStrategy,
  SpriteSheet,
  range,
  type ImageSource,
} from "excalibur";
import { Assets } from "../core/assets";
import {
  RoadGraphicsComponent,
  type WorldVertex,
} from "../components/road-graphics-component";

export type RunnerGraphicsState = "running" | "jumping" | "crouching" | "dead";

/** runner 视觉宽度 */
const RUNNER_WIDTH = 160;
/** runner 站立/跳跃高度 */
const RUNNER_HEIGHT = 400;
/** 跳跃时底部抬升高度 */
const RUNNER_JUMP_OFFSET = 100;
/** 蹲下时高度 */
const RUNNER_CROUCH_HEIGHT = 200;
/** 动画帧时长（ms） */
const RUNNER_FRAME_DURATION = 200;
/** 跑步贴图帧宽（160px） */
export const RUNNER_FRAME_WIDTH = 160;
/** 跑步/跳跃动画帧高（400px） */
export const RUNNER_RUNNING_FRAME_HEIGHT = 400;
/** 蹲下动画帧高（200px） */
const RUNNER_CROUCH_FRAME_HEIGHT = 200;

/** 用 ImageSource 构造两帧循环动画（SpriteSheet 分帧，每帧 RUNNER_FRAME_WIDTH × frameHeight，200ms 切换） */
function makeRunnerAnimation(
  image: ImageSource,
  frameHeight: number,
): Animation {
  const sheet = SpriteSheet.fromImageSource({
    image,
    grid: {
      rows: 1,
      columns: 2,
      spriteWidth: RUNNER_FRAME_WIDTH,
      spriteHeight: frameHeight,
    },
  });
  return Animation.fromSpriteSheet(
    sheet,
    range(0, 1),
    RUNNER_FRAME_DURATION,
    AnimationStrategy.Loop,
  );
}

interface RunnerStateSpec {
  animation: Animation;
  /** 底部 3D y 偏移 */
  bottom: number;
  /** 高度 */
  height: number;
}

const runningAnimation = makeRunnerAnimation(
  Assets.images.ptNormal,
  RUNNER_RUNNING_FRAME_HEIGHT,
);
const jumpingAnimation = makeRunnerAnimation(
  Assets.images.ptJumping,
  RUNNER_RUNNING_FRAME_HEIGHT,
);
const crouchingAnimation = makeRunnerAnimation(
  Assets.images.ptCrouching,
  RUNNER_CROUCH_FRAME_HEIGHT,
);

/** 各视觉状态对应的动画与尺寸（共享 3 个动画实例；dead 定格 running 第 0 帧） */
const RUNNER_STATE_SPECS: Record<RunnerGraphicsState, RunnerStateSpec> = {
  running: {
    animation: runningAnimation,
    bottom: 0,
    height: RUNNER_HEIGHT,
  },
  jumping: {
    animation: jumpingAnimation,
    bottom: RUNNER_JUMP_OFFSET,
    height: RUNNER_HEIGHT,
  },
  crouching: {
    animation: crouchingAnimation,
    bottom: 0,
    height: RUNNER_CROUCH_HEIGHT,
  },
  dead: {
    animation: runningAnimation,
    bottom: 0,
    height: RUNNER_HEIGHT,
  },
};

/** 由底部 3D y 与高度计算 4 个世界顶点（宽度 RUNNER_WIDTH，居中） */
function runnerWorldVertices(
  bottom: number,
  height: number,
): {
  bl: WorldVertex;
  br: WorldVertex;
  tl: WorldVertex;
  tr: WorldVertex;
} {
  const halfW = RUNNER_WIDTH / 2;
  return {
    bl: [-halfW, bottom, 0],
    br: [halfW, bottom, 0],
    tl: [-halfW, bottom + height, 0],
    tr: [halfW, bottom + height, 0],
  };
}

/** 构造 runner 初始视觉组件（running 状态） */
export function makeRunnerGraphicsComponent(): RoadGraphicsComponent {
  const { bl, br, tl, tr } = runnerWorldVertices(0, RUNNER_HEIGHT);
  return new RoadGraphicsComponent({
    priority: 1,
    texture: runningAnimation,
    bl,
    br,
    tl,
    tr,
  });
}

/**
 * 应用 runner 视觉状态：切换纹理与 4 个世界顶点，并控制动画
 * （dead 定格 running 第 0 帧并暂停；从 dead 恢复时继续播放）。
 * lastState 由调用方跟踪（RunnerSystem 持有）。
 */
export function applyRunnerGraphics(
  graphics: RoadGraphicsComponent,
  state: RunnerGraphicsState,
  lastState: RunnerGraphicsState,
): void {
  const spec = RUNNER_STATE_SPECS[state];
  if (state === "dead") {
    graphics.setTexture(spec.animation);
    spec.animation.goToFrame(0);
    spec.animation.pause();
  } else {
    if (graphics.quad.texture !== spec.animation) {
      graphics.setTexture(spec.animation);
    }
    if (lastState === "dead") spec.animation.play();
  }
  const { bl, br, tl, tr } = runnerWorldVertices(spec.bottom, spec.height);
  graphics.setWorldVertices(bl, br, tl, tr);
}
