import {
  BaseAlign,
  Color,
  Font,
  GraphicsGroup,
  Rectangle,
  ScreenElement,
  Text,
  TextAlign,
  vec,
  type Engine,
} from "excalibur";

const FONT_FAMILY = "monospace";
const FONT_SIZE = 24;
const LINE_WIDTH = 2;
const PADDING_X = 24;
const PADDING_Y = 16;

/** 按钮固定宽度：所有 MenuButton 等宽（共享此常量），高度随文本折行自适应 */
export const MENU_BUTTON_WIDTH = 240;

type ButtonState = keyof typeof STATE_COLORS;

// 三态配色：悬停时边框与文字变亮（可点击暗示），按下时填充变暗（"沉下去"效果）。
// as const 收窄键/值为字面量类型，ButtonState 由 keyof 推导；
// Color 在模块加载时构造一次，renderState 反复触发时直接复用（只读使用，共享安全）
const STATE_COLORS = {
  normal: {
    fill: Color.fromHex("#2a2a4a"),
    stroke: Color.fromHex("#5a5a8a"),
    text: Color.fromHex("#c0c0e0"),
  },
  hover: {
    fill: Color.fromHex("#34346e"),
    stroke: Color.fromHex("#8f8fcc"),
    text: Color.fromHex("#d8d8f0"),
  },
  pressed: {
    fill: Color.fromHex("#1c1c38"),
    stroke: Color.fromHex("#4a4a7a"),
    text: Color.fromHex("#a8a8c8"),
  },
} as const;

// 测量与绘制必须使用相同配置的 Font，保证按钮尺寸与渲染结果一致
function createFont(): Font {
  return new Font({
    family: FONT_FAMILY,
    size: FONT_SIZE,
    textAlign: TextAlign.Center,
    baseAlign: BaseAlign.Middle,
  });
}

export interface MenuButtonOptions {
  label: string;
  action: (engine: Engine) => void;
}

/**
 * 屏幕空间 UI 按钮：引擎按图形包围盒自动做指针命中检测
 * （ScreenElement 默认 pointer.useGraphicsBounds = true），
 * 无需手写点击区域判断。
 */
export class MenuButton extends ScreenElement {
  private readonly label: string;
  private readonly maxWidth: number;
  private readonly action: (engine: Engine) => void;
  private state: ButtonState = "normal";

  constructor(options: MenuButtonOptions) {
    // 宽度固定为 MENU_BUTTON_WIDTH，文本在 (宽度 - 2×PADDING_X) 内折行，
    // 高度随行数自适应：bounds.height 是全部行的总高（单行高 × 行数）
    const textBounds = createFont().measureText(
      options.label,
      MENU_BUTTON_WIDTH - PADDING_X * 2,
    );
    // width/height 传给 super 以生成 box collider，actor.width/height 才有效
    // （VerticalList 布局时需要读取子项尺寸）；位置由 VerticalList 设置，默认 (0,0)
    super({
      width: MENU_BUTTON_WIDTH,
      height: textBounds.height + PADDING_Y * 2,
    });
    this.label = options.label;
    this.maxWidth = MENU_BUTTON_WIDTH - PADDING_X * 2;
    this.action = options.action;
  }

  override onInitialize(): void {
    this.renderState();

    this.on("pointerenter", () => {
      // 触摸按下时会同时派发 enter/down，按下态优先于悬停态
      if (this.state !== "pressed") {
        this.state = "hover";
        this.renderState();
      }
    });
    this.on("pointerleave", () => {
      this.state = "normal";
      this.renderState();
    });
    this.on("pointerdown", () => {
      this.state = "pressed";
      this.renderState();
    });
    // 引擎只在指针仍位于按钮上时派发 pointerup，
    // 天然满足"按下后松开才触发"，移出按钮再松开不会误触发
    this.on("pointerup", () => {
      this.state = "normal";
      this.renderState();
      this.action(this._engine);
    });
  }

  private renderState(): void {
    const colors = STATE_COLORS[this.state];
    this.graphics.use(
      new GraphicsGroup({
        members: [
          {
            graphic: new Rectangle({
              width: this.width,
              height: this.height,
              color: colors.fill,
              strokeColor: colors.stroke,
              lineWidth: LINE_WIDTH,
            }),
            offset: vec(0, 0),
          },
          {
            graphic: new Text({
              text: this.label,
              maxWidth: this.maxWidth,
              color: colors.text,
              font: createFont(),
            }),
            offset: vec(this.width / 2, this.height / 2),
          },
        ],
      }),
    );
  }
}
