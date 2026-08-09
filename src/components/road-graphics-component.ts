import { GraphicsComponent, vec, type Graphic } from "excalibur";
import { Quadrilateral } from "../graphics/quadrilateral";
import type { RoadProjection } from "../core/road-projection";

/** 世界坐标顶点（相对锚点的 3D 偏移 (dx, dy, dz)，y 向上） */
export type WorldVertex = readonly [number, number, number];

/** RoadGraphicsComponent 构造参数 */
export interface RoadGraphicsOptions {
  /** 渲染优先级，数值越小越先绘制（Z 值越小） */
  priority: number;
  /** 纹理（Sprite/Animation/Canvas 等） */
  texture: Graphic;
  /** 4 个顶点的世界坐标（相对实体锚点的 3D 偏移），顺序 bl, br, tl, tr */
  bl: WorldVertex;
  br: WorldVertex;
  tl: WorldVertex;
  tr: WorldVertex;
}

/**
 * 道路视觉组件（继承 GraphicsComponent），参数化描述一个纹理四边形：
 * - 构造时给定纹理与 4 个顶点的世界坐标（3D 偏移），形状由工厂函数定义
 * - RoadGraphicsUpdateSystem 每帧调用 updateWorldVertices(proj)，把世界坐标投影为
 *   屏幕坐标写入 Quadrilateral（updateScreenVertices）
 * - Runner 等动态形状通过 setWorldVertices()/setTexture() 切换
 *
 * 实际绘制由标准 GraphicsSystem 完成（按 z 升序、自动 tick 动画）。
 * 注意保持非抽象：world.query 需要非抽象构造器。
 */
export class RoadGraphicsComponent extends GraphicsComponent {
  readonly priority: number;
  readonly quad: Quadrilateral;
  private _bl: WorldVertex;
  private _br: WorldVertex;
  private _tl: WorldVertex;
  private _tr: WorldVertex;

  constructor(options: RoadGraphicsOptions) {
    super();
    this.priority = options.priority;
    this.quad = new Quadrilateral(
      options.texture,
      vec(0, 0),
      vec(0, 0),
      vec(0, 0),
      vec(0, 0),
    );
    this.add(this.quad);
    this._bl = options.bl;
    this._br = options.br;
    this._tl = options.tl;
    this._tr = options.tr;
  }

  /** 切换纹理（Runner 状态切换用） */
  setTexture(texture: Graphic): void {
    this.quad.texture = texture;
  }

  /** 更新 4 个顶点的世界坐标（Runner 状态切换用） */
  setWorldVertices(
    bl: WorldVertex,
    br: WorldVertex,
    tl: WorldVertex,
    tr: WorldVertex,
  ): void {
    this._bl = bl;
    this._br = br;
    this._tl = tl;
    this._tr = tr;
  }

  /** 把世界坐标投影为屏幕坐标写入 quad（由 RoadGraphicsUpdateSystem 每帧调用） */
  updateWorldVertices(proj: RoadProjection, pixelRatio: number): void {
    this.quad.updateScreenVertices(
      proj.project(...this._bl),
      proj.project(...this._br),
      proj.project(...this._tl),
      proj.project(...this._tr),
      pixelRatio,
    );
  }
}
