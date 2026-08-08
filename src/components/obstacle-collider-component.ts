import { Component } from "excalibur";

/** Runner 可通过特定动作躲过的状态 */
export enum RunnerState {
  Crouch,
  Jump,
}

/**
 * 障碍物标记组件：skippedStates 表示 Runner 可免疫此障碍的躲避状态；
 * laneRadius 为障碍向两侧覆盖的车道半径（0 = 仅所在车道），
 * 命中判定为 |runner.lane − obstacle.lane| ≤ laneRadius。
 */
export class ObstacleColliderComponent extends Component {
  readonly skippedStates: readonly RunnerState[];
  readonly laneRadius: number;

  constructor(skippedStates: readonly RunnerState[], laneRadius: number) {
    super();
    this.skippedStates = skippedStates;
    this.laneRadius = laneRadius;
  }
}
