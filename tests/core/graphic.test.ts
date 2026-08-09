import { describe, expect, it } from "vitest";
import { ExcaliburGraphicsContext2DCanvas, vec, type Graphic } from "excalibur";
import { drawGraphic } from "../../src/core/graphic";

// ── 最小 2D 上下文 mock：记录 setTransform/transform 调用并维护当前变换 ──
// 仿照真实 CanvasRenderingContext2D：transform() 为 post-multiply（左乘当前矩阵）
interface Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

function compose(m: Matrix2D, t: Matrix2D): Matrix2D {
  return {
    a: m.a * t.a + m.c * t.b,
    b: m.b * t.a + m.d * t.b,
    c: m.a * t.c + m.c * t.d,
    d: m.b * t.c + m.d * t.d,
    e: m.a * t.e + m.c * t.f + m.e,
    f: m.b * t.e + m.d * t.f + m.f,
  };
}

class MockCtx2D {
  /** DPR=2 时的物理像素背板（canvas.width = 600×2） */
  canvas = { width: 1200, height: 1600 };
  imageSmoothingEnabled = true;
  /** 记录 graphic.draw 时刻的当前变换（由 RecordingGraphic 写入） */
  drawnTransforms: Matrix2D[] = [];

  private stack: Matrix2D[] = [{ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }];

  get current(): Matrix2D {
    return this.stack[this.stack.length - 1];
  }

  save(): void {
    this.stack.push({ ...this.current });
  }
  restore(): void {
    this.stack.pop();
  }
  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void {
    this.stack[this.stack.length - 1] = { a, b, c, d, e, f };
  }
  transform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void {
    this.stack[this.stack.length - 1] = compose(this.current, {
      a,
      b,
      c,
      d,
      e,
      f,
    });
  }
  translate(x: number, y: number): void {
    this.transform(1, 0, 0, 1, x, y);
  }
  scale(x: number, y: number): void {
    this.transform(x, 0, 0, y, 0, 0);
  }
  beginPath(): void {
    return undefined;
  }
  moveTo(_x: number, _y: number): void {
    return undefined;
  }
  lineTo(_x: number, _y: number): void {
    return undefined;
  }
  closePath(): void {
    return undefined;
  }
  clip(): void {
    return undefined;
  }
}

/** 假 Graphic：draw 时记录 ctx 当前变换（不触发 Excalibur 的 save/multiply 等） */
class RecordingGraphic {
  width = 100;
  height = 50;

  constructor(private mock: MockCtx2D) {}

  draw(): void {
    this.mock.drawnTransforms.push({ ...this.mock.current });
  }
}

/** 用矩阵把纹理坐标 (x, y) 映射为屏幕坐标 */
function apply(m: Matrix2D, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

function buildContext(mock: MockCtx2D): ExcaliburGraphicsContext2DCanvas {
  return new ExcaliburGraphicsContext2DCanvas({
    canvasElement: {},
    context: mock as unknown as CanvasRenderingContext2D,
  });
}

/**
 * 回归测试：移动端 HiDPI（DPR≥2）下道路对象必须仍占满整个屏幕。
 *
 * 旧实现 drawGraphic 先把裸 ctx setTransform(identity) 再绘制，丢掉了
 * Excalibur Screen 施加的 pixelRatio 缩放（canvas.width = 分辨率 × DPR），
 * 于是 600×800 逻辑空间的四边形被画进 1200×1600 物理背板的左上角——
 * 宽高各缩小 1/2 且只占左上 1/4 屏幕。
 *
 * 正确行为：顶点是绝对屏幕坐标（逻辑空间），绘制时 setTransform 保留
 * pixelRatio 缩放、丢弃实体变换（translate(lane, roadDist) 是游戏逻辑坐标，
 * 不参与屏幕绘制）。本测试模拟 DPR=2 + 实体位移，断言绘制变换 = pixelRatio ∘ 仿射。
 */
describe("drawGraphic", () => {
  it("DPR=2 时保留 pixelRatio 缩放、丢弃实体位移：纹理点映射到物理像素", () => {
    const mock = new MockCtx2D();
    const ex = buildContext(mock);
    // 模拟 Excalibur Screen.applyResolutionAndViewport 施加的 DPR=2 缩放，
    // 以及 GraphicsSystem 对实体施加的 translate(lane, roadDist) = (3, 40)——
    // 后者是逻辑坐标，必须被丢弃，不能出现在绘制结果中
    mock.setTransform(2, 0, 0, 2, 0, 0);
    mock.translate(3, 40);

    const graphic = new RecordingGraphic(mock);
    // 顶点为绝对屏幕坐标（逻辑分辨率空间）
    drawGraphic(
      ex,
      graphic as unknown as Graphic,
      vec(0, 0),
      vec(100, 0),
      vec(0, 50),
      vec(100, 50),
      2,
    );

    expect(mock.drawnTransforms).toHaveLength(2);
    // 矩形四边形的两个三角形共享同一仿射：纹理 (x, y) → (x, 50−y)。
    // 最终变换 = setTransform(2,0,0,2,0,0) ∘ 仿射 = [2,0,0,−2,0,100]：
    // 纹理 (0,0) → (0,100) = P·tl，纹理 (100,50) → (200,0) = P·br——
    // 只含 DPR 缩放，实体位移 (3,40) 已被丢弃
    const [tri1, tri2] = mock.drawnTransforms;
    for (const tri of [tri1, tri2]) {
      expect(apply(tri, 0, 0)).toEqual([0, 100]);
      expect(apply(tri, 100, 0)).toEqual([200, 100]);
      expect(apply(tri, 100, 50)).toEqual([200, 0]);
    }
  });

  it("DPR=1（桌面）时等于 identity：行为与旧代码一致", () => {
    const mock = new MockCtx2D();
    const ex = buildContext(mock);
    mock.setTransform(1, 0, 0, 1, 0, 0);
    mock.translate(3, 40);

    const graphic = new RecordingGraphic(mock);
    drawGraphic(
      ex,
      graphic as unknown as Graphic,
      vec(0, 0),
      vec(100, 0),
      vec(0, 50),
      vec(100, 50),
      1,
    );

    const [tri1] = mock.drawnTransforms;
    // 无 DPR 缩放：纹理 (0,0) → tl(0,50)，实体位移 (3,40) 同样被丢弃
    expect(apply(tri1, 0, 0)).toEqual([0, 50]);
    expect(apply(tri1, 100, 50)).toEqual([100, 0]);
  });
});
