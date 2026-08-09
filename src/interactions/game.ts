import { MotionComponent } from "excalibur";
import type { RoadPositionComponent } from "../components/road-position-component";
import type { CameraPositionComponent } from "../components/singletons/camera-position-component";
import type { GameStateComponent } from "../components/singletons/game-state-component";
import { recordScore } from "../core/scoreboard";

export function teleportTo(
  runnerPosition: RoadPositionComponent,
  cameraPosition: CameraPositionComponent,
  roadDist: number,
): void {
  runnerPosition.roadDist = roadDist;
  cameraPosition.roadDist = roadDist;
}

export function triggerGameOver(
  runnerPosition: RoadPositionComponent,
  runnerMotion: MotionComponent,
  cameraPosition: CameraPositionComponent,
  cameraMotion: MotionComponent,
  gameState: GameStateComponent,
  backToRoadDist?: number,
): void {
  // 已在 gameOver 状态（如 gameOver 后残余碰撞）不重复处理，避免重复记录分数
  if (gameState.gameStatus === "gameOver") return;
  gameState.gameStatus = "gameOver";
  runnerMotion.vel.y = 0;
  // 摄像机同步停止：否则它会在下一帧物理推进一帧位移，与已停止的 runner 脱节
  cameraMotion.vel.y = 0;
  if (backToRoadDist !== undefined) {
    const target = Math.min(runnerPosition.roadDist, backToRoadDist);
    teleportTo(runnerPosition, cameraPosition, target);
  }
  recordScore(gameState.totalScore);
}
