import { System, SystemType, World, Query, type Scene } from "excalibur";
import { RoadPositionComponent } from "../components/road-position-component";
import {
  CameraPositionComponent,
  getCameraPositionComponent,
} from "../components/singletons/camera-position-component";
import { WithGameStateFilter } from "./util";
import { TILE_SIZE } from "../core/road-position";

/**
 * 统一的道路实体回收系统。
 *
 * 每帧查询所有带 RoadPosition 的实体，将摄像机后方（roadDist + TILE_SIZE < camZ）的实体清理掉。
 */
export class RoadCleaningSystem extends WithGameStateFilter(System) {
  override systemType = SystemType.Update;

  private roadPosQuery!: Query<typeof RoadPositionComponent>;
  private camQuery!: Query<typeof CameraPositionComponent>;

  override onInitialize(world: World, _scene: Scene): void {
    this.roadPosQuery = world.query([RoadPositionComponent]);
    this.camQuery = world.query([CameraPositionComponent]);
  }

  override gameStatusHandlers = {
    gaming: (_elapsedMs: number): void => {
      const camZ = getCameraPositionComponent(this.camQuery).roadDist;

      for (const entity of this.roadPosQuery.entities) {
        if (!entity.isActive) continue;
        const pos = entity.get(RoadPositionComponent);
        if (pos.roadDist + TILE_SIZE < camZ) {
          entity.kill();
        }
      }
    },
  };
}
