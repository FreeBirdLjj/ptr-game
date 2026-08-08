import { Canvas, Entity, Sprite } from "excalibur";
import type { ActorEvents, EventEmitter } from "excalibur";
import { RoadPositionComponent } from "../components/road-position-component";
import { RoadGraphicsComponent } from "../components/road-graphics-component";
import {
  ObstacleColliderComponent,
  RunnerState,
} from "../components/obstacle-collider-component";
import { Assets } from "../core/assets";
import { LANES } from "../core/road";
import { TILE_SIZE } from "../core/road-position";

export class RoadEntity extends Entity {
  declare readonly events: EventEmitter<ActorEvents>;

  constructor(
    lane: number,
    roadDist: number,
    graphics?: RoadGraphicsComponent,
  ) {
    super();
    [new RoadPositionComponent(lane, roadDist), graphics]
      .filter((c) => c !== undefined)
      .forEach((component) => this.addComponent(component));
  }
}

/** 为障碍实体挂碰撞标记组件（skippedStates 供躲避判定，laneRadius 供车道判定） */
function withObstacleComponents(
  entity: RoadEntity,
  skippedStates: readonly RunnerState[],
  laneRadius: number,
): RoadEntity {
  entity.addComponent(new ObstacleColliderComponent(skippedStates, laneRadius));
  return entity;
}

// ── 视觉形状工厂 ─────────────────────────────────────────────

const GATE_HEIGHT = 300;
const HURDLE_HEIGHT = 100;

/** 纯色 1×1 纹理：仿射放大后插值仍是纯色，栅格化/绘制/内存开销最小 */
function makeColorTexture(color: string): Canvas {
  return new Canvas({
    width: 1,
    height: 1,
    cache: true,
    draw: (ctx) => {
      // Raster 构造未设置位图尺寸（默认 300×150），先按纹理尺寸设置
      ctx.canvas.width = 1;
      ctx.canvas.height = 1;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
    },
  });
}

/** 竖立矩形贴图（gate/hurdle 共用形状：贴图矩形立在 tile 近边，高度不同） */
function makeUprightVisual(
  texture: Sprite,
  height: number,
): RoadGraphicsComponent {
  const half = TILE_SIZE / 2;
  return new RoadGraphicsComponent({
    priority: 1,
    texture,
    bl: [-half, 0, 0],
    br: [half, 0, 0],
    tl: [-half, height, 0],
    tr: [half, height, 0],
  });
}

/** 路面 tile：4 角在 (∓half, 0, ∓half) */
export function newTileEntity(
  lane: number,
  roadDist: number,
  color: string,
): RoadEntity {
  const half = TILE_SIZE / 2;
  return new RoadEntity(
    lane,
    roadDist,
    new RoadGraphicsComponent({
      priority: 0,
      texture: makeColorTexture(color),
      bl: [-half, 0, -half],
      br: [half, 0, -half],
      tl: [-half, 0, half],
      tr: [half, 0, half],
    }),
  );
}

/** 门框：竖立在 tile 近边的燃烧木门框（200x300 像素贴图，资源见 Assets.images.gate） */
export function newGateEntity(lane: number, roadDist: number): RoadEntity {
  return withObstacleComponents(
    new RoadEntity(
      lane,
      roadDist,
      makeUprightVisual(new Sprite({ image: Assets.images.gate }), GATE_HEIGHT),
    ),
    [RunnerState.Crouch],
    0,
  );
}

/** 跨栏：横跨整个 tile 的燃烧木栅栏（200x100 像素贴图，资源见 Assets.images.hurdle） */
export function newHurdleEntity(lane: number, roadDist: number): RoadEntity {
  return withObstacleComponents(
    new RoadEntity(
      lane,
      roadDist,
      makeUprightVisual(
        new Sprite({ image: Assets.images.hurdle }),
        HURDLE_HEIGHT,
      ),
    ),
    [RunnerState.Jump],
    0,
  );
}

// ── 教程文字视觉 ─────────────────────────────────────────────

const TUTORIAL_TEXT_BASELINE_HEIGHT = 500;
const TUTORIAL_TEXT_FONT_SIZE = 48;
const TUTORIAL_TEXT_FONT = `${String(TUTORIAL_TEXT_FONT_SIZE)}px sans-serif`;
/** 白色填充 + 黑色描边：雪地（白）与路面（彩色）上都清晰可读 */
const TUTORIAL_TEXT_COLOR = "#ffffff";
const TUTORIAL_TEXT_STROKE_COLOR = "#000000";
const TUTORIAL_TEXT_STROKE_WIDTH = 4;
const TUTORIAL_TEXT_MAX_WIDTH = LANES * TILE_SIZE;
const TUTORIAL_TEXT_LINE_HEIGHT = 58;
/** 纹理顶部/底部预留：strokeText 描边会向字形上下各溢出半线宽 */
const TUTORIAL_TEXT_PAD = TUTORIAL_TEXT_STROKE_WIDTH;

/**
 * 教程文字：按固定字号栅格化为 Canvas 纹理（cache 一次），映射到道路上方 3D 面板
 * （底边在 BASELINE_HEIGHT 附近，宽度横跨道路），随深度透视缩放（远小近大）。
 * 基线位置与纹理高度由 measureText 的字体边界实测（fontBoundingBoxAscent/Descent，
 * 2021 年后的移动浏览器均支持）。
 */
export function newTutorialText(roadDist: number, text: string): RoadEntity {
  // 测量换行（必须与绘制用同一字体，否则默认 10px 下所有文字都不换行）
  const measureCtx = new Canvas({ width: TUTORIAL_TEXT_MAX_WIDTH, height: 1 })
    .ctx;
  measureCtx.font = TUTORIAL_TEXT_FONT;
  const metrics = measureCtx.measureText(text);
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  const lines = wrapText(measureCtx, text, TUTORIAL_TEXT_MAX_WIDTH);
  // 高度 = (行数-1)×行距 + ascent + descent + 上下预留（防描边被纹理裁掉）
  const height =
    (lines.length - 1) * TUTORIAL_TEXT_LINE_HEIGHT +
    ascent +
    descent +
    TUTORIAL_TEXT_PAD * 2;
  const texture = new Canvas({
    width: TUTORIAL_TEXT_MAX_WIDTH,
    height,
    cache: true,
    draw: (ctx) => {
      // Raster 构造未设置位图尺寸（默认 300×150），先按纹理尺寸设置
      ctx.canvas.width = TUTORIAL_TEXT_MAX_WIDTH;
      ctx.canvas.height = height;
      ctx.font = TUTORIAL_TEXT_FONT;
      ctx.textAlign = "center";
      ctx.strokeStyle = TUTORIAL_TEXT_STROKE_COLOR;
      ctx.lineWidth = TUTORIAL_TEXT_STROKE_WIDTH;
      ctx.fillStyle = TUTORIAL_TEXT_COLOR;
      lines.forEach((line, i) => {
        // 基线画在 i*行距 + ascent + PAD（顶部预留容纳描边），
        // 面板底边下移 ascent + PAD 使首行基线回到 3D y = BASELINE_HEIGHT
        const y = i * TUTORIAL_TEXT_LINE_HEIGHT + ascent + TUTORIAL_TEXT_PAD;
        // 先描边后填充：黑边在白色笔画下层，边缘平滑
        ctx.strokeText(line, TUTORIAL_TEXT_MAX_WIDTH / 2, y);
        ctx.fillText(line, TUTORIAL_TEXT_MAX_WIDTH / 2, y);
      });
    },
  });
  const halfW = TUTORIAL_TEXT_MAX_WIDTH / 2;
  const bottomY = TUTORIAL_TEXT_BASELINE_HEIGHT - (ascent + TUTORIAL_TEXT_PAD);
  return new RoadEntity(
    1,
    roadDist,
    new RoadGraphicsComponent({
      priority: 1,
      texture,
      bl: [-halfW, bottomY, 0],
      br: [halfW, bottomY, 0],
      tl: [-halfW, bottomY + height, 0],
      tr: [halfW, bottomY + height, 0],
    }),
  );
}

/** 按 maxWidth（屏幕像素）对文本做单词级换行 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || line === "") {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

export function newTurnEntity(roadDist: number): RoadEntity {
  // 横跨全部车道（LANES=3 时半径 1，lane 1 覆盖 0..2）
  return withObstacleComponents(
    new RoadEntity(1, roadDist),
    [],
    (LANES - 1) / 2,
  );
}

export function newTutorialEndEntity(roadDist: number): RoadEntity {
  // 标记：MovingSystem 据此区分教程终点与普通转弯标记
  const entity = withObstacleComponents(
    new RoadEntity(1, roadDist),
    [],
    (LANES - 1) / 2,
  );
  entity.addTag("tutorial-end");
  return entity;
}
