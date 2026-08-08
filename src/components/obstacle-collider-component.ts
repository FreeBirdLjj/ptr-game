import { ColliderComponent, Collider } from "excalibur";

/** Runner 可通过特定动作躲过的状态 */
export enum RunnerState {
  Crouch,
  Jump,
}

/**
 * 障碍物碰撞组件。
 * 继承 ColliderComponent，增加 skippedStates 表示 Runner 通过哪些状态可以免疫此障碍的碰撞。
 */
export class ObstacleColliderComponent extends ColliderComponent {
  readonly skippedStates: readonly RunnerState[];

  constructor(collider: Collider, skippedStates: readonly RunnerState[]) {
    super(collider);
    this.skippedStates = skippedStates;
  }
}
