import {
  ExcaliburGraphicsContext2DCanvas,
  Graphic,
  type ExcaliburGraphicsContext,
  type Vector,
} from "excalibur";
import { drawGraphic } from "../core/graphic";

/**
 * 四边形 Graphic：不做栅格化，直接把纹理（任意 Graphic，如 Sprite/Animation）
 * 以仿射纹理映射绘制到 (bl, br, tl, tr) 四个顶点定义的四边形上。
 *
 * 四个顶点为绝对屏幕坐标（逻辑分辨率空间，由 RoadGraphicsUpdateSystem 每帧
 * 投影写入）。_drawImage 时从 ExcaliburGraphicsContext2DCanvas.__ctx 取出
 * CanvasRenderingContext2D，连同 texture、四个顶点与 pixelRatio 交给
 * drawGraphic 绘制——drawGraphic 丢弃实体变换（逻辑坐标），只保留
 * pixelRatio 缩放，因此本 Graphic 的位移/旋转/缩放变换不参与绘制。
 *
 * 仅在 2D canvas 渲染器下可用；非 ExcaliburGraphicsContext2DCanvas 时静默跳过。
 */
export class Quadrilateral extends Graphic {
  private _texture: Graphic;
  private _bl: Vector;
  private _br: Vector;
  private _tl: Vector;
  private _tr: Vector;
  /**
   * 屏幕 pixelRatio（物理像素 / 逻辑像素）：绘制时以此缩放绝对屏幕坐标，丢弃
   * 实体变换（translate(lane, roadDist) 是逻辑坐标，不参与屏幕绘制）。
   * 由 RoadGraphicsUpdateSystem 每帧随顶点一起传入（updateScreenVertices）。
   * 桌面 DPR=1 时为 1，等于 identity。
   */
  private _pixelRatio = 1;

  constructor(
    texture: Graphic,
    bl: Vector,
    br: Vector,
    tl: Vector,
    tr: Vector,
  ) {
    super({ width: texture.width, height: texture.height });
    this._texture = texture;
    this._bl = bl;
    this._br = br;
    this._tl = tl;
    this._tr = tr;
  }

  /** 当前纹理（Sprite/Animation/Canvas 等），换纹理时同步更新自身宽高 */
  get texture(): Graphic {
    return this._texture;
  }

  set texture(texture: Graphic) {
    this._texture = texture;
    this.width = texture.width;
    this.height = texture.height;
  }

  /** 更新四个顶点与 pixelRatio（绝对屏幕坐标），由 RoadGraphicsUpdateSystem 每帧调用 */
  updateScreenVertices(
    bl: Vector,
    br: Vector,
    tl: Vector,
    tr: Vector,
    pixelRatio: number,
  ): void {
    this._bl = bl;
    this._br = br;
    this._tl = tl;
    this._tr = tr;
    this._pixelRatio = pixelRatio;
  }

  /**
   * 转发 tick 给纹理：GraphicsSystem 用鸭子类型（hasGraphicsTick：!!graphic.tick）
   * 判断是否驱动，不实现 tick 的话，作为纹理的 Animation 永远不会被自动播放。
   * 与 hasGraphicsTick 同思路，tick 声明为可选，Sprite/Canvas 等无 tick 时安全跳过。
   */
  tick(elapsed: number, idempotencyToken: number): void {
    const texture = this._texture as {
      tick?: (elapsed: number, idempotencyToken?: number) => void;
    };
    texture.tick?.(elapsed, idempotencyToken);
  }

  protected _drawImage(
    ex: ExcaliburGraphicsContext,
    _x: number,
    _y: number,
  ): void {
    if (!(ex instanceof ExcaliburGraphicsContext2DCanvas)) return;
    drawGraphic(
      ex,
      this._texture,
      this._bl,
      this._br,
      this._tl,
      this._tr,
      this._pixelRatio,
    );
  }

  clone(): Quadrilateral {
    // 纹理也 clone：与顶点一致保持副本独立（Animation 独立帧/播放状态，
    // Sprite/Canvas 底层资源不复制），否则两个副本共享动画状态会同步播放
    const clone = new Quadrilateral(
      this._texture.clone(),
      this._bl.clone(),
      this._br.clone(),
      this._tl.clone(),
      this._tr.clone(),
    );
    clone._pixelRatio = this._pixelRatio;
    return clone;
  }
}
