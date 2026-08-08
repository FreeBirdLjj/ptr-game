import { System, SystemType, World, Query, type Scene } from "excalibur";
import { RoadPositionComponent } from "../components/road-position-component";
import { RoadGraphicsComponent } from "../components/road-graphics-component";
import {
  CameraPositionComponent,
  getCameraPositionComponent,
} from "../components/singletons/camera-position-component";
import {
  RoadTurnComponent,
  getRoadTurnComponent,
} from "../components/singletons/road-turn-component";
import { AbsoluteProjection } from "../core/absolute-projection";
import { RoadProjection } from "../core/road-projection";
import { roadPositionTo3D, TILE_SIZE } from "../core/road-position";

/**
 * 道路视觉更新系统（由 RoadRenderSystem 改写）。
 *
 * 查询所有同时拥有 RoadPosition 和 RoadGraphicsComponent 的实体（工厂统一挂
 * 精确的 RoadGraphicsComponent，因此 query 可直接匹配，无需经 GraphicsComponent
 * + instanceof 收窄），每帧按当前转弯状态计算伪 3D 投影，把坐标写入各实体的
 * Quadrilateral：
 * - 可见性 → GraphicsComponent.isVisible（Screen 平面下 GraphicsSystem 不剔除，由这里剔除远处实体）
 * - 顶点 → graphics.updateWorldVertices(proj)
 * - Z 值 → RoadPositionComponent（TransformComponent），GraphicsSystem 按 z 升序绘制
 *   （z = (MAX_Z − relZ) + priority：深度主导——近处盖远处；priority 只作为同深度
 *   的层级补充——tile(0) 先画、gate/hurdle/runner(1) 后画盖在上面）
 *
 * 实际绘制由标准 GraphicsSystem 完成（按 z 升序、自动 tick 动画）。
 */
export class RoadGraphicsUpdateSystem extends System {
  readonly systemType = SystemType.Update;

  private roadObjectQuery!: Query<
    typeof RoadPositionComponent | typeof RoadGraphicsComponent
  >;
  private camQuery!: Query<typeof CameraPositionComponent>;
  private turnQuery!: Query<typeof RoadTurnComponent>;

  override initialize(world: World, _scene: Scene): void {
    this.roadObjectQuery = world.query([
      RoadPositionComponent,
      RoadGraphicsComponent,
    ]);
    this.camQuery = world.query([CameraPositionComponent]);
    this.turnQuery = world.query([RoadTurnComponent]);
  }

  update(_elapsed: number): void {
    const camZ = getCameraPositionComponent(this.camQuery).roadDist;
    const turn = getRoadTurnComponent(this.turnQuery);

    for (const entity of this.roadObjectQuery.entities) {
      if (!entity.isActive) continue;
      const pos = entity.get(RoadPositionComponent);
      const graphics = entity.get(RoadGraphicsComponent);

      const geometricCenter = roadPositionTo3D(
        pos.lane,
        pos.roadDist,
        turn.roadDist,
        turn.dir,
        camZ,
      );
      const turnDir =
        pos.roadDist >= turn.roadDist && turn.roadDist > camZ ? turn.dir : null;

      const relZ = geometricCenter.z - camZ;
      const visible =
        relZ > -TILE_SIZE / 2 &&
        relZ - TILE_SIZE / 2 <= AbsoluteProjection.MAX_Z;
      graphics.isVisible = visible;
      if (!visible) continue;

      const proj = new RoadProjection(
        geometricCenter.x,
        geometricCenter.z,
        camZ,
        turnDir,
      );
      graphics.updateWorldVertices(proj);

      pos.z = AbsoluteProjection.MAX_Z - relZ + graphics.priority;
    }
  }
}
