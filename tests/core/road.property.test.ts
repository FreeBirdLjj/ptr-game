import { describe, it, expect } from "vitest";
import {
  Entity,
  World,
  Query,
  Scene,
  type Component,
  type ComponentCtor,
} from "excalibur";
import { RoadPositionComponent } from "../../src/components/road-position-component";
import { CameraPositionComponent } from "../../src/components/singletons/camera-position-component";
import {
  RoadTurnComponent,
  getRoadTurnComponent,
} from "../../src/components/singletons/road-turn-component";
import { GameStateComponent } from "../../src/components/singletons/game-state-component";
import { RoadConstructionSystem } from "../../src/systems/road-construction-system";
import { roadPositionTo3D, TILE_SIZE } from "../../src/core/road-position";

// road 实体的 Canvas 纹理在构造时需要 2d context（Raster 构造只检查非 null），
// happy-dom 的 canvas 不支持，这里 stub 掉（与 game-over-board 测试同款做法）
HTMLCanvasElement.prototype.getContext = (() => ({})) as never;

const MAX_Z = 1200;

// ── Mock types ───────────────────────────────────────────────

interface MockEntity {
  get<T extends Component>(type: ComponentCtor<T>): T;
  isActive: boolean;
}

interface MockQuery {
  readonly entities: readonly MockEntity[];
}

interface MockWorld {
  add(entity: Entity): void;
  query(types: ComponentCtor[]): MockQuery;
}

interface SystemInternals {
  readonly turnQuery: Query<typeof RoadTurnComponent>;
}

// ── Test helpers ─────────────────────────────────────────────

interface TileInfo {
  lane: number;
  roadDist: number;
  x: number;
  z: number;
}

function makeWorld(): {
  world: MockWorld;
  camera: CameraPositionComponent;
  turn: RoadTurnComponent;
  entities: Entity[];
} {
  const entities: Entity[] = [];
  const camera = new CameraPositionComponent();
  const turn = new RoadTurnComponent();
  const gameState = new GameStateComponent();

  const world: MockWorld = {
    add(e: Entity) {
      entities.push(e);
    },
    query(types: ComponentCtor[]) {
      const getEntities = (): MockEntity[] => {
        if (types.includes(CameraPositionComponent)) {
          return [
            {
              get<T extends Component>(_type: ComponentCtor<T>): T {
                return camera as unknown as T;
              },
              isActive: true,
            },
          ];
        }
        if (types.includes(RoadTurnComponent)) {
          return [
            {
              get<T extends Component>(_type: ComponentCtor<T>): T {
                return turn as unknown as T;
              },
              isActive: true,
            },
          ];
        }
        if (types.includes(GameStateComponent)) {
          return [
            {
              get<T extends Component>(_type: ComponentCtor<T>): T {
                return gameState as unknown as T;
              },
              isActive: true,
            },
          ];
        }
        return entities.filter((e) => e.isActive) as unknown as MockEntity[];
      };
      return {
        get entities(): readonly MockEntity[] {
          return getEntities();
        },
      };
    },
  };
  return { world, camera, turn, entities };
}

function collectTiles(
  world: MockWorld,
  turn: RoadTurnComponent,
  camZ: number,
): TileInfo[] {
  const tiles: TileInfo[] = [];
  const nextTurn = turn.nextTurn(camZ);
  const turnRoadDist = nextTurn.roadDist;
  const turnDir = nextTurn.dir;
  for (const entity of world.query([RoadPositionComponent]).entities) {
    const pos = entity.get(RoadPositionComponent);
    const w = roadPositionTo3D(
      pos.lane,
      pos.roadDist,
      turnRoadDist,
      turnDir,
      camZ,
    );
    const effZ = w.z - camZ;
    if (effZ < 0 || effZ > MAX_Z) continue;
    tiles.push({
      lane: pos.lane,
      roadDist: pos.roadDist,
      x: w.x,
      z: w.z,
    });
  }
  return tiles;
}

function validate(
  system: RoadConstructionSystem,
  world: MockWorld,
  camZ: number,
  label: string,
): string[] {
  const errors: string[] = [];
  const s = system as unknown as SystemInternals;
  const turn = getRoadTurnComponent(s.turnQuery);
  const tiles = collectTiles(world, turn, camZ);

  // Group by world-z (rounded to TILE_SIZE) — tiles visible at the same
  // camera-relative depth form a row.
  const byZ = new Map<number, TileInfo[]>();
  for (const t of tiles) {
    const effZ = t.z - camZ;
    const zKey = Math.round(effZ / TILE_SIZE) * TILE_SIZE;
    const row = byZ.get(zKey);
    if (row) {
      row.push(t);
    } else {
      byZ.set(zKey, [t]);
    }
  }

  for (const [zKey, row] of byZ) {
    // Skip turn fan area — tiles here are diagonal, not in straight rows
    const worldZ = zKey + camZ;
    const nextTurn = turn.nextTurn(camZ);
    const active = nextTurn.roadDist > camZ;
    if (
      active &&
      worldZ >= nextTurn.roadDist - TILE_SIZE &&
      worldZ <= nextTurn.roadDist + 2 * TILE_SIZE
    ) {
      continue;
    }

    // Deduplicate by lane (obstacles share the same lane as their parent tile)
    const lanes = [...new Set(row.map((t) => t.lane))].sort((a, b) => a - b);
    if (lanes.length < 3) {
      errors.push(
        `${label}: zKey=${String(zKey)} has ${String(lanes.length)} lanes`,
      );
      continue;
    }
    if (lanes[0] !== 0 || lanes[1] !== 1 || lanes[2] !== 2) {
      errors.push(
        `${label}: zKey=${String(zKey)} lanes=${JSON.stringify(lanes)}`,
      );
      continue;
    }

    // Verify each tile's position is consistent with roadPositionTo3D
    for (const t of row) {
      const expected = roadPositionTo3D(
        t.lane,
        t.roadDist,
        nextTurn.roadDist,
        nextTurn.dir,
        camZ,
      );
      if (
        Math.abs(t.x - expected.x) > 0.01 ||
        Math.abs(t.z - expected.z) > 0.01
      ) {
        errors.push(
          `${label}: zKey=${String(zKey)} lane=${String(t.lane)} mismatch`,
        );
      }
    }
  }

  return errors;
}

// ── Tests ────────────────────────────────────────────────────

describe("RoadConstructionSystem 10-turn endurance", () => {
  it("10 次转弯全程坐标合法", () => {
    const { world, camera, turn } = makeWorld();
    const system = new RoadConstructionSystem();
    system.initialize(world as unknown as World, {} as Scene);
    system.update(0);
    let prevTurnRd = turn.nextTurn(camera.roadDist).roadDist;
    let turnCount = 0;
    const errors: string[] = [];
    let step = 0;

    errors.push(...validate(system, world, camera.roadDist, "init"));

    while (turnCount < 10 && step < 200000) {
      camera.roadDist += 200 * (16 / 1000);
      system.update(16);
      step++;

      if (turn.nextTurn(camera.roadDist).roadDist !== prevTurnRd) {
        turnCount++;
        prevTurnRd = turn.nextTurn(camera.roadDist).roadDist;
        errors.push(
          ...validate(
            system,
            world,
            camera.roadDist,
            `turn#${String(turnCount)}`,
          ),
        );
      } else if (step % 500 === 0) {
        errors.push(
          ...validate(system, world, camera.roadDist, `step${String(step)}`),
        );
      }

      if (errors.length > 50) break;
    }

    errors.push(...validate(system, world, camera.roadDist, "final"));
    expect(errors).toEqual([]);
    expect(turnCount).toBeGreaterThanOrEqual(1);
  }, 120000);
});
