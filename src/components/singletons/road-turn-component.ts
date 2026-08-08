import { Component, type Query, type ComponentCtor } from "excalibur";
import { TurnDir } from "../../core/road";

/**
 * 单例组件，存放当前转弯信息。
 *
 * 挂载于 SingletonEntity，由 Road.fillAhead() 更新。
 */
export class RoadTurnComponent extends Component {
  /** 转弯起点 roadDist，-1 表示没有待处理的转弯 */
  roadDist = -Infinity;
  dir: TurnDir = TurnDir.Right;
}

/** 从 Query 中获取单例 RoadTurnComponent */
export function getRoadTurnComponent(
  query: Query<typeof RoadTurnComponent | ComponentCtor>,
): RoadTurnComponent {
  for (const e of query.entities) {
    return e.get(RoadTurnComponent);
  }
  throw new Error("RoadTurnComponent not found");
}
