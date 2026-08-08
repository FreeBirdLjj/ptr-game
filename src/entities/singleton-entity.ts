import { Entity } from "excalibur";
import { RoadTurnComponent } from "../components/singletons/road-turn-component";
import { GameStateComponent } from "../components/singletons/game-state-component";
import { CameraEntity } from "./singletons/camera-entity";
import { RunnerEntity } from "./singletons/runner-entity";

/**
 * 单例实体，用于挂载全局 Component。
 *
 * 在 PlayingScene 初始化时创建并添加到 world，之后各 System
 * 可通过 world.query 查询此实体上的全局状态。
 */
export class SingletonEntity extends Entity {
  constructor() {
    super({ name: "singleton" });
    for (const component of [
      new RoadTurnComponent(),
      new GameStateComponent(),
    ]) {
      this.addComponent(component);
    }
    for (const child of [new CameraEntity(), new RunnerEntity()]) {
      this.addChild(child);
    }
  }
}
