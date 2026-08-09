import { describe, expect, it } from "vitest";
import { type Graphic, type Vector } from "excalibur";
import { RoadGraphicsComponent } from "../../src/components/road-graphics-component";
import { RoadEntity } from "../../src/entities/road-entity";
import { RoadProjection } from "../../src/core/road-projection";
import { AbsoluteProjection } from "../../src/core/absolute-projection";

const fakeTexture = { width: 100, height: 100 } as Graphic;

const QUAD_OPTIONS = {
  priority: 0,
  texture: fakeTexture,
  bl: [-1, 0, -1] as const,
  br: [1, 0, -1] as const,
  tl: [-1, 0, 1] as const,
  tr: [1, 0, 1] as const,
};

describe("RoadGraphicsComponent", () => {
  it("updateWorldVertices 写入绝对屏幕坐标（投影原值，不含实体位置）", () => {
    const graphics = new RoadGraphicsComponent(QUAD_OPTIONS);
    // 实体位置 (lane, roadDist) 是游戏逻辑坐标，与屏幕坐标加减无意义：
    // quad 顶点必须保持投影原值，实体变换由绘制侧（drawGraphic）丢弃
    new RoadEntity(2, 500, graphics);

    const proj = new RoadProjection(0, 0, 0);
    const pixelRatio = 2.5;
    graphics.updateWorldVertices(proj, pixelRatio);

    // quad 顶点是私有字段（_bl 等），仅测试需要读取：TS private 只是编译期
    // 约束，运行时可直接访问，这里类型断言后解构（与 moving-system 测试
    // cast 访问 scene.engine 同一风格），不为测试给生产类加 getter
    const { _bl, _br, _tl, _tr, _pixelRatio } = graphics.quad as unknown as {
      _bl: Vector;
      _br: Vector;
      _tl: Vector;
      _tr: Vector;
      _pixelRatio: number;
    };

    const expected = ([dx, dy, dz]: readonly [number, number, number]) =>
      AbsoluteProjection.project(dx, dy, dz);
    expect(_bl.x).toBeCloseTo(expected(QUAD_OPTIONS.bl).x);
    expect(_bl.y).toBeCloseTo(expected(QUAD_OPTIONS.bl).y);
    expect(_br.x).toBeCloseTo(expected(QUAD_OPTIONS.br).x);
    expect(_br.y).toBeCloseTo(expected(QUAD_OPTIONS.br).y);
    expect(_tl.x).toBeCloseTo(expected(QUAD_OPTIONS.tl).x);
    expect(_tl.y).toBeCloseTo(expected(QUAD_OPTIONS.tl).y);
    expect(_tr.x).toBeCloseTo(expected(QUAD_OPTIONS.tr).x);
    expect(_tr.y).toBeCloseTo(expected(QUAD_OPTIONS.tr).y);
    // pixelRatio 随顶点一起存储，供 Draw 阶段使用
    expect(_pixelRatio).toBe(pixelRatio);
  });
});
