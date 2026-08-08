import { LANES, TurnDir } from "./road";

export const TILE_SIZE = 200;
const LANE_X0 = -300;
/**
 * 将道路坐标 `<lane, roadDist>` 转换为世界 3D 中心坐标。
 */
export function roadPositionTo3D(
  lane: number,
  roadDist: number,
  turnRoadDist: number,
  turnDir: TurnDir,
  camZ: number,
): { x: number; z: number } {
  if (roadDist >= turnRoadDist && turnRoadDist > camZ - TILE_SIZE / 2) {
    const d = roadDist - turnRoadDist;
    if (turnDir === TurnDir.Right) {
      return {
        x: LANE_X0 + LANES * TILE_SIZE + d,
        z: turnRoadDist - (0.5 + lane) * TILE_SIZE,
      };
    }
    return {
      x: LANE_X0 - d,
      z: turnRoadDist + (lane + 0.5 - LANES) * TILE_SIZE,
    };
  }
  return { x: LANE_X0 + (lane + 0.5) * TILE_SIZE, z: roadDist };
}
