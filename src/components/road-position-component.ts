import { CoordPlane, TransformComponent, vec } from "excalibur";

/**
 * 道路坐标组件：以 `<lane, roadDist>` 定位实体在道路上的位置。
 * 继承 TransformComponent，lane → pos.x, roadDist → pos.y，
 * 以便碰撞系统通过 TransformComponent + ColliderComponent 查询匹配。
 *
 * coordPlane 固定为 Screen：视觉实体以绝对屏幕坐标绘制（Quadrilateral 顶点由
 * RoadGraphicsUpdateSystem 直接投影），Screen 平面避免 GraphicsSystem 用
 * (lane, roadDist) 做世界剔除（Screen 平面永不剔除），远处实体的剔除由
 * RoadGraphicsUpdateSystem 通过 isVisible 完成。碰撞系统不读 coordPlane。
 */
export class RoadPositionComponent extends TransformComponent {
  constructor(lane: number, roadDist: number) {
    super();
    this.pos = vec(lane, roadDist);
    this.coordPlane = CoordPlane.Screen;
  }

  get lane(): number {
    return this.pos.x;
  }
  set lane(lane: number) {
    this.pos.x = lane;
  }

  get roadDist(): number {
    return this.pos.y;
  }
  set roadDist(roadDist: number) {
    this.pos.y = roadDist;
  }
}
