import { Random } from "excalibur";

export enum TurnDir {
  Left = "Left",
  Right = "Right",
}

/** 判断 value 是否为 TurnDir 成员（依赖键值一致的字符串枚举） */
export function isTurnDir(value: unknown): value is TurnDir {
  return typeof value === "string" && value in TurnDir;
}

export const LANES = 3;

export type RoadSegmentDir = TurnDir | "straight";

export enum Obstacle {
  Gate = "Gate",
  Hurdle = "Hurdle",
}

/** 判断 value 是否为 Obstacle 成员（依赖键值一致的字符串枚举） */
export function isObstacle(value: unknown): value is Obstacle {
  return typeof value === "string" && value in Obstacle;
}

export enum TutorialElement {
  TutorialEnd = "TutorialEnd",
}

/** 判断 value 是否为 TutorialElement 成员（依赖键值一致的字符串枚举） */
export function isTutorialElement(value: unknown): value is TutorialElement {
  return typeof value === "string" && value in TutorialElement;
}

export type RoadSegmentDataType = "tutorial" | "gaming";

export type GamingRoadSegmentData = readonly [
  number,
  "gaming",
  RoadSegmentDir,
  readonly (null | Obstacle)[],
];

export type TutorialRoadSegmentData = readonly [
  number,
  "tutorial",
  RoadSegmentDir,
  Obstacle | TutorialElement | string | null,
];

/**
 * 教程道路配置：每项为一段，开头有 straightCount 个直道，
 * 最后以一个特殊 segment（转弯 / 障碍 / 教程元素）收尾。
 */
const TUTORIAL_ROAD_CONFIG = [
  [6, "Swipe left or right to switch lanes"],
  [6, "Swipe up to jump"],
  [0, Obstacle.Hurdle],
  [6, "Swipe down to lower the height"],
  [0, Obstacle.Gate],
  [6, "Swipe left before the corner to turn left"],
  [0, TurnDir.Left],
  [6, "Swipe right before the corner to turn right"],
  [0, TurnDir.Right],
  [6, "Enjoy the game"],
] as const;

const GAMING_ROAD_CONFIG = {
  straight: { min: 11, max: 17 },
  obstacleFree: { head: 1, tail: 3 }, // 开头和末尾不放障碍的直道数
  obstacles: {
    [Obstacle.Gate]: 0.1,
    [Obstacle.Hurdle]: 0.1,
  },
} as const;

function* makeGamingRoadGenerator(
  rng: Random,
  startTileIndex = 0,
): Generator<GamingRoadSegmentData> {
  let index = startTileIndex;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const straightLength = rng.integer(
      GAMING_ROAD_CONFIG.straight.min,
      GAMING_ROAD_CONFIG.straight.max,
    );
    const { head, tail } = GAMING_ROAD_CONFIG.obstacleFree;
    const prevHadObstacle = [false, false, false];
    const noObstacle: readonly null[] = [null, null, null];

    // 头部：不放障碍的直道
    for (let i = 0; i < head; i++) {
      yield [index++, "gaming", "straight", noObstacle] as const;
    }

    // 中部：按概率放置障碍的直道
    for (let i = head; i < straightLength - tail; i++) {
      const obstacles: (null | Obstacle)[] = [null, null, null];
      for (let lane = 0; lane < LANES; lane++) {
        if (prevHadObstacle[lane]) {
          prevHadObstacle[lane] = false;
          continue;
        }
        for (const type of Object.keys(
          GAMING_ROAD_CONFIG.obstacles,
        ) as unknown as Obstacle[]) {
          if (rng.bool(GAMING_ROAD_CONFIG.obstacles[type])) {
            obstacles[lane] = type;
            prevHadObstacle[lane] = true;
            break;
          }
        }
      }
      yield [index++, "gaming", "straight", obstacles] as const;
    }

    // 尾部：不放障碍的直道
    for (let i = 0; i < tail; i++) {
      yield [index++, "gaming", "straight", noObstacle] as const;
    }

    // 转弯
    const dir: TurnDir = rng.bool() ? TurnDir.Left : TurnDir.Right;
    yield [index++, "gaming", dir, noObstacle] as const;
  }
}

function* makeTutorialRoadGenerator(): Generator<TutorialRoadSegmentData> {
  let index = 0;
  for (const [straightCount, special] of TUTORIAL_ROAD_CONFIG) {
    for (let i = 0; i < straightCount; i++) {
      yield [index++, "tutorial", "straight", null] as const;
    }
    if (isTurnDir(special)) {
      yield [index++, "tutorial", special, null] as const;
    } else {
      yield [index++, "tutorial", "straight", special] as const;
    }
  }
  yield [index, "tutorial", "straight", TutorialElement.TutorialEnd] as const;
}

export function* makeRoadGenerator(
  rng: Random,
  includingTutorial: boolean,
): Generator<TutorialRoadSegmentData | GamingRoadSegmentData> {
  let tutorialEndIndex = -1;
  if (includingTutorial) {
    for (const segment of makeTutorialRoadGenerator()) {
      tutorialEndIndex = segment[0];
      yield segment;
    }
  }
  yield* makeGamingRoadGenerator(rng, tutorialEndIndex + 1);
}
