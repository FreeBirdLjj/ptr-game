import { Component, type Query, type ComponentCtor } from "excalibur";

/**
 * 单例组件，存放 Runner 的运行状态。
 * 行为方法见 core/Runner.ts。
 */
export class RunnerStateComponent extends Component {
  jumpStart = 0;
  jumpEnd = 0;
  crouchStart = 0;
  crouchEnd = 0;

  /** 清除跳跃/下蹲状态（位置回退时调用，避免旧状态在重新经过时自动激活） */
  reset(): void {
    this.jumpStart = 0;
    this.jumpEnd = 0;
    this.crouchStart = 0;
    this.crouchEnd = 0;
  }
}

/** 从 Query 中获取单例 RunnerStateComponent */
export function getRunnerStateComponent(
  query: Query<typeof RunnerStateComponent | ComponentCtor>,
): RunnerStateComponent {
  for (const e of query.entities) {
    return e.get(RunnerStateComponent);
  }
  throw new Error("RunnerStateComponent not found");
}
