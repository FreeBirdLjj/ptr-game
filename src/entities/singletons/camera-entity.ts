import { Entity, MotionComponent } from "excalibur";
import { CameraPositionComponent } from "../../components/singletons/camera-position-component";

/**
 * 摄像机实体，挂载摄像机相关 Component，作为 SingletonEntity 的子实体。
 */
export class CameraEntity extends Entity {
  constructor() {
    super({ name: "camera" });
    for (const component of [
      new CameraPositionComponent(),
      new MotionComponent(),
    ]) {
      this.addComponent(component);
    }
  }
}
