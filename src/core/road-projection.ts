import { Vector } from "excalibur";
import { AbsoluteProjection } from "./absolute-projection";
import { TurnDir } from "./road";

/**
 * 相对投影器：以道路锚点 (anchorX, anchorZ) 为原点，
 * 将相对偏移 (dx, dy, dz) 投影到屏幕坐标。
 *
 * 由 RoadGraphicsUpdateSystem 每帧为每个 RoadPositionComponent 实体创建，
 * 传递给 RoadGraphicsComponent.updateWorldVertices() 计算四边形顶点。
 */
export class RoadProjection {
  constructor(
    /** 锚点绝对世界 x */
    private anchorX: number,
    /** 锚点绝对世界 z */
    private anchorZ: number,
    /** 摄像机在 road 坐标系中的 z */
    private camZ: number,
    /** 当前实体所在区域的转弯方向 */
    private turnDir: TurnDir | null = null,
  ) {}

  /** 将相对偏移 (dx, dy, dz) 投影为屏幕坐标 */
  project(dx: number, dy: number, dz: number): Vector {
    let rdx = dx;
    let rdz = dz;
    if (this.turnDir === TurnDir.Right) {
      // 右转：local forward (+dz) → world +x，local right (+dx) → world +z
      rdx = dz;
      rdz = dx;
    } else if (this.turnDir === TurnDir.Left) {
      // 左转：local forward (+dz) → world -x，local right (+dx) → world +z
      rdx = -dz;
      rdz = dx;
    }
    const wz = this.anchorZ + rdz - this.camZ;
    return AbsoluteProjection.project(this.anchorX + rdx, dy, wz);
  }
}
