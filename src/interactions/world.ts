import {
  BaseAlign,
  Color,
  CoordPlane,
  Entity,
  Font,
  GraphicsComponent,
  Rectangle,
  ScreenElement,
  Text,
  TextAlign,
  TransformComponent,
  vec,
  type Scene,
  type World,
} from "excalibur";
import { RoadGraphicsUpdateSystem } from "../systems/road-graphics-update-system";
import { RoadCleaningSystem } from "../systems/road-cleaning-system";
import { CameraMovingSystem } from "../systems/camera-moving-system";
import { RoadConstructionSystem } from "../systems/road-construction-system";
import { RunnerSystem } from "../systems/runner-system";
import { UIUpdateSystem } from "../systems/ui-update-system";
import { ResetSystem } from "../systems/reset-system";
import { SingletonEntity } from "../entities/singleton-entity";
import { AbsoluteProjection } from "../core/absolute-projection";
import { GameOverBoard } from "../ui/game-over-board";

/** 天空（地平线上方）颜色 */
const SKY_COLOR = Color.fromHex("#87ceeb");
/** 地面（地平线下方）颜色 */
const GROUND_COLOR = Color.fromHex("#ffffff");
/**
 * 背景 Z：-Infinity 保证背景永远最先绘制（GraphicsSystem 按 globalZ 升序绘制）。
 * sky/ground 同为 -Infinity 时排序比较为 NaN（视为相等，稳定排序保持插入顺序），
 * 两者屏幕区域不重叠（地平线上/下），顺序无影响。
 */
const BACKGROUND_Z = -Infinity;
/**
 * UI Z：+Infinity 保证 UI 永远最后绘制（GraphicsSystem 按 globalZ 升序绘制，
 * 恒在最上层）；同时作为 UI 实体的标记（road/背景实体 z 均为有限值），
 * 供 UIUpdateSystem 从 [TransformComponent, GraphicsComponent] 查询中区分。
 */
const UI_Z = Infinity;

/** 创建 UI 分数文本实体：Screen 平面，顶部居中（水平居中、顶部对齐） */
/** 创建 UI 分数文本实体：ScreenElement（Screen 平面、PreventCollision 等 UI 默认值） */
function createScoreTextEntity(drawWidth: number): ScreenElement {
  const score = new ScreenElement({
    name: "ui-score",
    x: drawWidth / 2,
    y: 8,
    z: UI_Z,
    // anchor 保持默认 (0,0)：绘制点 = pos，Font 的 textAlign=Center 使文字中心
    // 恒在 pos.x，与文本宽度无关（不能用 anchor.x=0.5——会与 textAlign 双重偏移）
  });
  // tag 与 name 同名（query 不支持按 name 查询，tag 为索引化查询键）
  score.addTag("ui-score");
  score.graphics.use(
    new Text({
      text: "Score: 0",
      color: Color.White,
      // textAlign=Center + baseAlign=Top：文字以绘制点为水平中心、顶部对齐
      font: new Font({
        family: "monospace",
        size: 24,
        textAlign: TextAlign.Center,
        baseAlign: BaseAlign.Top,
      }),
    }),
  );
  return score;
}

/** 创建 UI 结算面板实体：ScreenElement，锚点默认左上，初始隐藏（gameOver 时显示） */
function createGameOverBoardEntity(
  drawWidth: number,
  drawHeight: number,
): ScreenElement {
  const board = new ScreenElement({ name: "ui-board", z: UI_Z });
  // tag 与 name 同名（query 不支持按 name 查询，tag 为索引化查询键）
  board.addTag("ui-board");
  board.graphics.use(
    new GameOverBoard({
      canvasWidth: drawWidth,
      canvasHeight: drawHeight,
    }),
  );
  board.graphics.isVisible = false;
  return board;
}

/**
 * 创建背景实体（天空/地面）：Screen 平面的全宽 Rectangle，锚点左上角位于 (0, topY)。
 * 尺寸在 onPreDraw 中跟随画布逻辑尺寸同步（FitScreen 下分辨率可变），
 * 仅在变化时更新（Rectangle 是 Raster，宽高 setter 会触发重栅格化）。
 */
function createBackgroundEntity(
  scene: Scene,
  name: string,
  topY: number,
  getHeight: (canvasHeight: number) => number,
  color: Color,
): Entity {
  const rect = new Rectangle({ width: 1, height: 1, color });
  const transform = new TransformComponent();
  transform.coordPlane = CoordPlane.Screen;
  transform.pos = vec(0, topY);
  transform.z = BACKGROUND_Z;
  const graphics = new GraphicsComponent({
    graphics: { default: rect },
    anchor: vec(0, 0),
  });
  // 注意：不能在构造 options 里传 onPreDraw——Excalibur 0.32 构造末尾会把它
  // 用 onPreTransformDraw 的赋值逻辑覆盖成 undefined，必须构造后再赋值
  graphics.onPreDraw = () => {
    const w = scene.engine.screen.drawWidth;
    const h = scene.engine.screen.drawHeight;
    const height = getHeight(h);
    if (rect.width !== w) rect.width = w;
    if (rect.height !== height) rect.height = height;
  };
  return new Entity({
    name,
    components: [transform, graphics],
  });
}

export function setupWorldEntities(world: World): void {
  world.add(new SingletonEntity());
  // 天空/地面背景实体（替代原 SkyboxRenderSystem 直绘；
  // resetWorld 清空实体后由 setupWorldEntities 随之重建）
  world.add(
    createBackgroundEntity(
      world.scene,
      "sky",
      0,
      () => AbsoluteProjection.HORIZON,
      SKY_COLOR,
    ),
  );
  world.add(
    createBackgroundEntity(
      world.scene,
      "ground",
      AbsoluteProjection.HORIZON,
      (h) => Math.max(0, h - AbsoluteProjection.HORIZON),
      GROUND_COLOR,
    ),
  );
  // UI 实体（分数文本 + 结算面板，z = Infinity 恒在最上层；
  // 尺寸用逻辑分辨率 drawWidth/drawHeight，与 GraphicsSystem 坐标系一致）
  const drawWidth = world.scene.engine.screen.drawWidth;
  const drawHeight = world.scene.engine.screen.drawHeight;
  world.add(createScoreTextEntity(drawWidth));
  world.add(createGameOverBoardEntity(drawWidth, drawHeight));
}

export function setupWorldSystems(world: World): void {
  for (const system of [
    new RoadConstructionSystem(),
    new RoadGraphicsUpdateSystem(),
    new RoadCleaningSystem(),
    new CameraMovingSystem(),
    new RunnerSystem(),
    new UIUpdateSystem(),
    new ResetSystem(),
  ]) {
    world.add(system);
  }
}

export function setupWorld(world: World): void {
  for (const fn of [setupWorldEntities, setupWorldSystems]) {
    fn(world);
  }
}

/**
 * 整局重置：清空全部实体并重建单例实体（runner/相机/全局状态），保留系统。
 * 用于 gameOver 后按空格重开，以及教程中撞到障碍后的回退。
 * 调用方若需回到教程，需在之后自行设置 GameStateComponent.gameStatus。
 */
export function resetWorld(world: World): void {
  world.scene.clear(false);
  setupWorldEntities(world);
}
