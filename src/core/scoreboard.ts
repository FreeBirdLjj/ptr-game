const MAX_SCORE_COUNT = 5;

/** 本地排行榜：降序，最多保留 MAX_SCORE_COUNT 条 */
const scores: number[] = [];

/** 记录一条分数，排行榜始终降序且只保留前 MAX_SCORE_COUNT 名 */
export function recordScore(score: number): void {
  scores.push(score);
  scores.sort((a, b) => b - a);
  if (scores.length > MAX_SCORE_COUNT) {
    scores.splice(MAX_SCORE_COUNT);
  }
}

/** 返回降序的分数副本（外部修改不影响内部状态） */
export function listScores(): number[] {
  return [...scores];
}
