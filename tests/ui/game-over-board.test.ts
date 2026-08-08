import { describe, expect, it } from "vitest";
import { ExcaliburGraphicsContext2DCanvas } from "excalibur";
import { GameOverBoard } from "../../src/ui/game-over-board";

// 记录实际变换后的绘制坐标（mock 自己实现 translate/save/restore 跟踪）
function makeMockCtx() {
  const calls: [string, number, number][] = [];
  let tx = 0;
  let ty = 0;
  const stack: [number, number][] = [];

  const noop = (): void => undefined;
  const ctx: Record<string, unknown> = {
    canvas: { width: 600, height: 800 },
    measureText: (text: string) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 5,
    }),
    translate: (x: number, y: number) => {
      tx += x;
      ty += y;
    },
    save: () => {
      stack.push([tx, ty]);
    },
    restore: () => {
      [tx, ty] = stack.pop() ?? [0, 0];
    },
    scale: noop,
    resetTransform: noop,
    clearRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    strokeRect: noop,
    fillText: noop,
    strokeText: noop,
    setLineDash: noop,
    getLineDash: () => [],
    getTransform: () => ({
      multiply: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
    setTransform: noop,
    drawImage: (_img: unknown, x: number, y: number) => {
      calls.push(["drawImage", x + tx, y + ty]);
    },
    fillRect: (_x: number, _y: number, _w: number, _h: number) => {
      calls.push(["fillRect", _x + tx, _y + ty]);
    },
  };

  return { ctx, calls };
}

describe("GameOverBoard draw position", () => {
  it("draws the mask covering the full canvas", () => {
    // Font 内部 bitmap 渲染与 2DCanvas 共用 prototype stub 会互相污染，
    // 因此让 2DCanvas 使用独立的 ctx，只跟踪 ex 链路的坐标
    const proto = makeMockCtx();
    HTMLCanvasElement.prototype.getContext = (() =>
      proto.ctx as unknown as CanvasRenderingContext2D) as never;

    const { ctx, calls } = makeMockCtx();
    const board = new GameOverBoard({ canvasWidth: 600, canvasHeight: 800 });
    board.show([100, 50], 100);

    const ex = new ExcaliburGraphicsContext2DCanvas({
      canvasElement: {} as HTMLCanvasElement,
      context: ctx as unknown as CanvasRenderingContext2D,
    });
    board.draw(ex, 0, 0);

    const masks = calls.filter(([kind]) => kind === "drawImage");
    expect(masks.length).toBeGreaterThan(0);
    // 全屏遮罩从画布原点 (0,0) 画起（board.draw 的原点即画布原点），覆盖全屏
    expect(masks[0][1]).toBe(0);
    expect(masks[0][2]).toBe(0);
  });
});
