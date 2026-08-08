import {
  Entity,
  ColliderComponent,
  BodyComponent,
  MotionComponent,
  CollisionType,
  Shape,
} from "excalibur";
import { RoadPositionComponent } from "../../components/road-position-component";
import { RunnerStateComponent } from "../../components/singletons/runner-state-component";
import { makeRunnerGraphicsComponent } from "../../graphics/runner-graphics";

/**
 * Runner 实体，封装 Runner 相关的组件。
 * 作为 SingletonEntity 的子实体挂载。
 */
export class RunnerEntity extends Entity {
  constructor() {
    super({ name: "runner" });

    for (const component of [
      new RunnerStateComponent(),
      new RoadPositionComponent(1, 0),
      new MotionComponent(),
      makeRunnerGraphicsComponent(),
      new ColliderComponent(Shape.Box(1, 5)),
      new BodyComponent({ type: CollisionType.Passive }),
    ]) {
      this.addComponent(component);
    }
  }
}
