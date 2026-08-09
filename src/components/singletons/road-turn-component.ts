import { Component, type Query, type ComponentCtor } from "excalibur";
import { TurnDir } from "../../core/road";
import { TILE_SIZE } from "../../core/road-position";

export interface RoadTurn {
  roadDist: number;
  dir: TurnDir;
}

/** 无弯时的默认值：roadDist=-Infinity 使所有“有弯”判断天然落空 */
const EMPTY_TURN: RoadTurn = { roadDist: -Infinity, dir: TurnDir.Right };

/**
 * 单例组件，存放已构造的转弯点列表。
 *
 * 与实体不同步的生命周期：写入只 append（生成单增），读取取 runner 前方
 * 最近的弯（roadDist 超过 camZ 的最小值），清理由 RoadCleaningSystem 按
 * roadDist + TILE_SIZE < camZ 执行。这样「前方最近弯」的语义与构造推进的
 * 时机完全解耦——无论构造提前推进多远，读取结果始终正确。
 */
export class RoadTurnComponent extends Component {
  private turns: RoadTurn[] = [];

  /** 记录一个已构造的转弯（roadDist 必须递增） */
  addTurn(roadDist: number, dir: TurnDir): void {
    this.turns.push({ roadDist, dir });
  }

  /** 前方最近的弯（roadDist 大于 camZ 的最小值）；无则返回默认空弯 */
  nextTurn(camZ: number): RoadTurn {
    for (const turn of this.turns) {
      if (turn.roadDist > camZ) {
        return turn;
      }
    }
    return EMPTY_TURN;
  }

  /** 清理已被相机越过的转弯（与 turn 实体的清理条件一致） */
  removePassedTurns(camZ: number): void {
    while (this.turns.length > 0 && this.turns[0].roadDist + TILE_SIZE < camZ) {
      this.turns.shift();
    }
  }
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
