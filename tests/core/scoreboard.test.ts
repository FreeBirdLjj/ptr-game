import { describe, expect, it, vi } from "vitest";

// scoreboard 的 scores 是模块级状态，每个用例重新加载模块以获得干净状态
async function freshScoreboard() {
  vi.resetModules();
  return await import("../../src/core/scoreboard");
}

describe("scoreboard", () => {
  it("lists recorded scores in descending order", async () => {
    const { recordScore, listScores } = await freshScoreboard();

    recordScore(10);
    recordScore(30);
    recordScore(20);

    expect(listScores()).toEqual([30, 20, 10]);
  });

  it("keeps only the top 5 scores", async () => {
    const { recordScore, listScores } = await freshScoreboard();

    for (let i = 1; i <= 7; i++) {
      recordScore(i * 10);
    }

    expect(listScores()).toEqual([70, 60, 50, 40, 30]);
  });

  it("returns a copy so callers cannot mutate the stored scores", async () => {
    const { recordScore, listScores } = await freshScoreboard();

    recordScore(42);

    const scores = listScores();
    scores.push(999);
    scores.sort((a, b) => a - b);

    expect(listScores()).toEqual([42]);
  });
});
