import {
  TransformComponent,
  vec,
  type Query,
  type ComponentCtor,
} from "excalibur";

/**
 * 单例组件，存放摄像机在 road 坐标系中的位置。
 * 继承 TransformComponent，roadDist → pos.y，
 * 以便 MotionSystem 可以通过 TransformComponent 推动摄像机。
 *
 * 挂载于 CameraEntity，由 CameraMovingSystem 驱动。
 */
export class CameraPositionComponent extends TransformComponent {
  constructor() {
    super();
    this.pos = vec(1, 0);
  }

  get roadDist(): number {
    return this.pos.y;
  }
  set roadDist(v: number) {
    this.pos.y = v;
  }
}

/** 从 Query 中获取单例 CameraPositionComponent */
export function getCameraPositionComponent(
  query: Query<typeof CameraPositionComponent | ComponentCtor>,
): CameraPositionComponent {
  for (const e of query.entities) {
    return e.get(CameraPositionComponent);
  }
  throw new Error("CameraPositionComponent not found");
}
