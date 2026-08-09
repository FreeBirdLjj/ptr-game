import { describe, expect, it, beforeAll } from "vitest";
import { Graphic, GraphicsGroup, ScreenElement } from "excalibur";
import { StartMenuScene } from "../../src/scenes/start-menu-scene";

// Font/Raster 内部依赖 canvas 2d context（happy-dom 不支持），注入最小可用 mock
function installMock2dContext(): void {
  const noop = (): void => undefined;
  HTMLCanvasElement.prototype.getContext = (() =>
    ({
      canvas: { width: 0, height: 0 },
      measureText: (text: string) => ({
        width: text.length * 10,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 5,
      }),
      translate: noop,
      scale: noop,
      resetTransform: noop,
      clearRect: noop,
      save: noop,
      restore: noop,
      fillRect: noop,
      strokeRect: noop,
      beginPath: noop,
      fill: noop,
      stroke: noop,
      setLineDash: noop,
      getLineDash: () => [],
    }) as unknown as CanvasRenderingContext2D) as never;
}

interface MockEngine {
  canvas: { width: number };
  screen: { drawWidth: number };
}

/** 手工装配最小 engine：onInitialize 只读取 engine.canvas.width 与 engine.screen.drawWidth */
function initializeScene(engine: MockEngine): StartMenuScene {
  const scene = new StartMenuScene();
  (scene as unknown as { engine: MockEngine }).engine = engine;
  scene.onInitialize();
  return scene;
}

/** 场景直接添加的两个 UI：标题（GraphicsGroup 成员带 offset）与按钮列表（ScreenElement.pos） */
function collectXs(scene: StartMenuScene): number[] {
  const [title, list] = scene.actors;
  const xs: number[] = [];
  if (title instanceof ScreenElement) {
    const group = title.graphics.current;
    if (group instanceof GraphicsGroup) {
      for (const m of group.members) {
        if (!(m instanceof Graphic)) {
          xs.push(m.offset.x);
        }
      }
    }
  }
  if (list instanceof ScreenElement) {
    xs.push(list.pos.x);
  }
  return xs;
}

describe("StartMenuScene UI layout", () => {
  beforeAll(() => {
    installMock2dContext();
  });

  it("centers title and buttons on logical width (drawWidth) when devicePixelRatio = 1", () => {
    // 桌面 DPR=1：canvas.width（物理像素）与 drawWidth（逻辑宽度）相等
    const scene = initializeScene({
      canvas: { width: 600 },
      screen: { drawWidth: 600 },
    });
    const xs = collectXs(scene);
    expect(xs).toEqual([300, 300, 300]);
  });

  it("centers title and buttons on logical width (drawWidth) on HiDPI mobile", () => {
    // 手机 DPR=3：canvas.width（物理像素）= 1800，是逻辑宽度 drawWidth=600 的 3 倍。
    // UI 必须按逻辑宽度 300 定位；若误用物理宽度会定位到 900，全部落到画布右侧屏幕外
    const scene = initializeScene({
      canvas: { width: 1800 },
      screen: { drawWidth: 600 },
    });
    const xs = collectXs(scene);
    expect(xs).toEqual([300, 300, 300]);
  });
});
