import { vec, type Vector } from "excalibur";

/**
 * 伪 3D 透视投影（无状态单例，纯函数）
 *
 *   scale = FOCAL / (FOCAL + z)
 *   sx = 300 + x · scale
 *   sy = HORIZON + (GROUND_Y - y - HORIZON) · scale
 *
 * z→0   scale=1  全尺寸
 * z→∞   scale=0  汇聚到消失点 (300, HORIZON)
 */
export const AbsoluteProjection = {
  /** 可见最大深度 */
  MAX_Z: 1200,
  /** 地面在屏幕上的 y 坐标 */
  GROUND_Y: 800,
  /** 焦距，控制透视强度 */
  FOCAL: 800,
  /** 地平线（消失点）的屏幕 y 坐标 */
  HORIZON: 200,

  /** 将世界坐标 (wx, wy, wz) 投影为屏幕坐标 */
  project(wx: number, wy: number, wz: number): Vector {
    const scale = AbsoluteProjection.FOCAL / (AbsoluteProjection.FOCAL + wz);
    const sx = 300 + wx * scale;
    const sy =
      AbsoluteProjection.HORIZON +
      (AbsoluteProjection.GROUND_Y - wy - AbsoluteProjection.HORIZON) * scale;
    return vec(sx, sy);
  },

  /** wz 是否在可见深度范围内 */
  isVisible(wz: number): boolean {
    return wz >= 0 && wz <= AbsoluteProjection.MAX_Z;
  },
} as const;
