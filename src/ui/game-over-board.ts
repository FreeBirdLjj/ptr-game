import {
  BaseAlign,
  Color,
  ExcaliburGraphicsContext,
  Font,
  Graphic,
  GraphicsGroup,
  Rectangle,
  Text,
  TextAlign,
  vec,
} from "excalibur";

const BOARD_WIDTH = 350;
const BOARD_HEIGHT = 350;
const TITLE_Y_OFFSET = 50;
const LIST_Y_OFFSET = 95;
const LIST_GAP = 8;
const FOOTER_Y_OFFSET = 28;

interface ScoreEntry {
  score: number;
  /** 名次（1 开始）；null 表示未上榜（Unranked） */
  rank: number | null;
  isCurrent: boolean;
}

/**
 * 构建结算面板的分数条目：
 * - scores 中与 currentScore 等值的最靠前记录视为本次分数（已上榜），其后等值记录按普通条目处理
 * - scores 中无等值记录时，追加一条 Unranked 的本次分数
 */
function buildScoreEntries(
  scores: readonly number[],
  currentScore: number,
): ScoreEntry[] {
  const rankedIndex = scores.findIndex((s) => s === currentScore);
  if (rankedIndex >= 0) {
    return scores.map((s, i) => ({
      score: s,
      rank: i + 1,
      isCurrent: i === rankedIndex,
    }));
  }
  return [
    ...scores.map((s, i) => ({
      score: s,
      rank: i + 1,
      isCurrent: false,
    })),
    { score: currentScore, rank: null, isCurrent: true },
  ];
}

/** textAlign=Center + baseAlign=Middle：文本以原点为中心绘制 */
function createFont(size: number): Font {
  return new Font({
    family: "sans-serif",
    size,
    textAlign: TextAlign.Center,
    baseAlign: BaseAlign.Middle,
  });
}

/**
 * 结算面板（纯 Graphic，挂载在 ui-board 实体上，由 GraphicsSystem 按 z=Infinity 恒最上层绘制）：
 * - 全部内容（遮罩/背景/标题/副标题/分数条目）组合在一个 GraphicsGroup 中，
 *   一次 draw 全部绘制，因此无需关心 GraphicsSystem 与道路渲染的先后顺序
 * - show()：重建分数条目并显示，由 UIUpdateSystem 在进入 gameOver 时调用；
 * - 实体生命周期由 setupWorldEntities 管理（resetWorld 清空后重建，无需 hide）
 */
export class GameOverBoard extends Graphic {
  private readonly canvasWidth: number;
  private readonly canvasHeight: number;
  private readonly by: number;
  private group: GraphicsGroup;

  constructor(options: { canvasWidth: number; canvasHeight: number }) {
    super();
    this.canvasWidth = options.canvasWidth;
    this.canvasHeight = options.canvasHeight;
    this.by = (options.canvasHeight - BOARD_HEIGHT) / 2;
    this.group = new GraphicsGroup({ members: this.buildMembers([]) });
  }

  /** 展示结算面板：按本次分数与排行榜重建全部图形成员。
   * 可见性由 UIUpdateSystem 控制（仅 gameOver 状态显示），无需内部状态 */
  show(scores: readonly number[], currentScore: number): void {
    const entries = buildScoreEntries(scores, currentScore);
    this.group = new GraphicsGroup({
      members: this.buildMembers(entries),
    });
  }

  protected override _drawImage(
    ex: ExcaliburGraphicsContext,
    x: number,
    y: number,
  ): void {
    this.group.draw(ex, x, y);
  }

  override clone(): GameOverBoard {
    // 本图形不参与 GraphicsSystem 的图形复用，克隆仅满足抽象要求
    return new GameOverBoard({
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
    });
  }

  /** 静态成员（遮罩/背景/标题/副标题）+ 分数条目成员；条目布局与 VerticalList 一致（自上而下、水平居中） */
  private buildMembers(entries: ScoreEntry[]) {
    const bx = (this.canvasWidth - BOARD_WIDTH) / 2;
    const members = [
      {
        graphic: new Rectangle({
          width: this.canvasWidth,
          height: this.canvasHeight,
          color: Color.fromHex("#00000080"),
        }),
        offset: vec(0, 0),
      },
      {
        graphic: new Rectangle({
          width: BOARD_WIDTH,
          height: BOARD_HEIGHT,
          color: Color.fromHex("#141432f2"),
        }),
        offset: vec(bx, this.by),
      },
      {
        graphic: new Text({
          text: "Game Over!",
          color: Color.White,
          font: createFont(36),
        }),
        offset: vec(this.canvasWidth / 2, this.by + TITLE_Y_OFFSET),
      },
      {
        graphic: new Text({
          text: "Tap screen or press Space to restart",
          color: Color.fromHex("#969696"),
          font: createFont(16),
        }),
        offset: vec(
          this.canvasWidth / 2,
          this.by + BOARD_HEIGHT - FOOTER_Y_OFFSET,
        ),
      },
    ];

    let y = this.by + LIST_Y_OFFSET;
    for (const entry of entries) {
      const font = createFont(24);
      const label =
        entry.rank !== null
          ? `No.${String(entry.rank)}: ${String(entry.score)}`
          : `Unranked: ${String(entry.score)}`;
      members.push({
        graphic: new Text({
          text: label,
          color: entry.isCurrent ? Color.Yellow : Color.fromHex("#c8c8c8"),
          font,
        }),
        offset: vec(this.canvasWidth / 2, y),
      });
      y += font.measureText(label).height + LIST_GAP;
    }
    return members;
  }
}
