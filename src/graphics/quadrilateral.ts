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
 * _drawImage 时从 ExcaliburGraphicsContext2DCanvas.__ctx 取出
 * CanvasRenderingContext2D，连同 texture 与四个顶点交给 drawGraphic 绘制。
 * 四个顶点为绝对屏幕坐标（drawGraphic 内部 setTransform 会覆盖 Graphic 的
 * 位移/旋转/缩放变换），由 RoadGraphicsUpdateSystem 每帧写入。
 *
 * 仅在 2D canvas 渲染器下可用；非 ExcaliburGraphicsContext2DCanvas 时静默跳过。
 */
export class Quadrilateral extends Graphic {
  private _texture: Graphic;
  private _bl: Vector;
  private _br: Vector;
  private _tl: Vector;
  private _tr: Vector;

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

  /** 更新四个顶点（绝对屏幕坐标），由 RoadGraphicsUpdateSystem 每帧调用 */
  updateScreenVertices(bl: Vector, br: Vector, tl: Vector, tr: Vector): void {
    this._bl = bl;
    this._br = br;
    this._tl = tl;
    this._tr = tr;
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
    drawGraphic(ex, this._texture, this._bl, this._br, this._tl, this._tr);
  }

  clone(): Quadrilateral {
    // 纹理也 clone：与顶点一致保持副本独立（Animation 独立帧/播放状态，
    // Sprite/Canvas 底层资源不复制），否则两个副本共享动画状态会同步播放
    return new Quadrilateral(
      this._texture.clone(),
      this._bl.clone(),
      this._br.clone(),
      this._tl.clone(),
      this._tr.clone(),
    );
  }
}
