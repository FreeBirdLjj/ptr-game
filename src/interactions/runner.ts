import type { RunnerStateComponent } from "../components/singletons/runner-state-component";
import type { RoadPositionComponent } from "../components/road-position-component";
import { TILE_SIZE } from "../core/road-position";
import { LANES } from "../core/road";

/** Runner 行为方法，均为纯函数，不对组件以外的状态做任何假设。 */
export const Runner = {
  tryMoveLeft(
    runnerPosition: RoadPositionComponent,
    runnerState: RunnerStateComponent,
  ): void {
    if (Runner.isBusy(runnerPosition, runnerState)) return;
    if (runnerPosition.lane > 0) runnerPosition.lane--;
  },

  tryMoveRight(
    runnerPosition: RoadPositionComponent,
    runnerState: RunnerStateComponent,
  ): void {
    if (Runner.isBusy(runnerPosition, runnerState)) return;
    if (runnerPosition.lane < LANES - 1) runnerPosition.lane++;
  },

  tryJump(
    runnerPosition: RoadPositionComponent,
    runnerState: RunnerStateComponent,
  ): void {
    const rd = runnerPosition.roadDist;
    if (Runner.isBusy(runnerPosition, runnerState)) return;
    runnerState.jumpStart = rd;
    runnerState.jumpEnd = rd + TILE_SIZE;
  },

  tryCrouch(
    runnerPosition: RoadPositionComponent,
    runnerState: RunnerStateComponent,
  ): void {
    const rd = runnerPosition.roadDist;
    if (Runner.isBusy(runnerPosition, runnerState)) return;
    runnerState.crouchStart = rd;
    runnerState.crouchEnd = rd + TILE_SIZE;
  },

  isJumping(
    runnerPosition: RoadPositionComponent,
    runnerState: RunnerStateComponent,
  ): boolean {
    const rd = runnerPosition.roadDist;
    return rd >= runnerState.jumpStart && rd < runnerState.jumpEnd;
  },

  isCrouching(
    runnerPosition: RoadPositionComponent,
    runnerState: RunnerStateComponent,
  ): boolean {
    const rd = runnerPosition.roadDist;
    return rd >= runnerState.crouchStart && rd < runnerState.crouchEnd;
  },

  isBusy(
    runnerPosition: RoadPositionComponent,
    runnerState: RunnerStateComponent,
  ): boolean {
    return (
      Runner.isJumping(runnerPosition, runnerState) ||
      Runner.isCrouching(runnerPosition, runnerState)
    );
  },
} as const;
