import {
  AffineMatrix,
  ExcaliburGraphicsContext2DCanvas,
  Graphic,
  vec,
  type Vector,
} from "excalibur";

/** clip 三角形路径时向外扩张的像素数，让两个三角形在共享边重叠，消除对角线接缝 */
const CLIP_PAD = 1;

/**
 * 解 3 点对应 (t0→p0, t1→p1, t2→p2) 的仿射矩阵。
 * 以标准三角形 S = {(0,0), (1,0), (0,1)} 为中介：
 * A 把 S 映射到纹理三角形（列 = 纹理基向量），B 把 S 映射到屏幕三角形
 * （列 = 屏幕基向量），则 M = B·A⁻¹ 把纹理点映射到屏幕点。
 */
function solveAffine(
  p0: Vector,
  p1: Vector,
  p2: Vector,
  t0: Vector,
  t1: Vector,
  t2: Vector,
): AffineMatrix {
  const A = new AffineMatrix();
  A.data.set([t1.x - t0.x, t1.y - t0.y, t2.x - t0.x, t2.y - t0.y, t0.x, t0.y]);
  const B = new AffineMatrix();
  B.data.set([p1.x - p0.x, p1.y - p0.y, p2.x - p0.x, p2.y - p0.y, p0.x, p0.y]);
  return B.multiply(A.inverse());
}

/** 将三角形三个顶点沿重心方向外扩 CLIP_PAD 像素（clip 用，避免 AA 缝隙） */
function outsetTriangle(
  p0: Vector,
  p1: Vector,
  p2: Vector,
): [Vector, Vector, Vector] {
  const cx = (p0.x + p1.x + p2.x) / 3;
  const cy = (p0.y + p1.y + p2.y) / 3;
  const push = (p: Vector): Vector => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy);
    if (len === 0) return p;
    return vec(p.x + (dx / len) * CLIP_PAD, p.y + (dy / len) * CLIP_PAD);
  };
  return [push(p0), push(p1), push(p2)];
}

/**
 * 将 Excalibur Graphic（Sprite/Animation 等）以仿射纹理映射绘制到
 * 四边形 (bl, br, tl, tr) 上。
 *
 * canvas 2D 没有任意四边形纹理映射 API，故按对角线 (tr-bl) 把四边形拆成
 * 两个三角形，每个三角形由 3 顶点解出仿射矩阵后 clip + 绘制：
 * - 三角形内部精确；对角线处纹理方向有轻微折角（缺透视校正）。
 * - 4 个角分别投影，可表达梯形/一般四边形——直线段 hurdle/gate 是矩形，
 *   转弯段是梯形，两种情形都精确（单个 setTransform 只能表达平行四边形）。
 * - clip 路径沿重心外扩 CLIP_PAD，使两个三角形在共享边重叠，消除抗锯齿缝隙。
 *
 * 参数 ex 为 2D canvas 图形上下文（由调用方传入，天然单例复用）；
 * clip/setTransform 需要裸 ctx 时取 ex.__ctx，纹理绘制直接用 ex 调
 * graphic.draw()（无离屏渲染，直接画在当前矩阵上）；帧裁剪由 Graphic
 * 自身管理（Sprite.sourceView / Animation）。
 *
 * 注意：进入本函数时 ex.__ctx 可能带有外层变换（GraphicsSystem 会对实体施加
 * translate(lane, roadDist)），clip 路径必须建立在绝对屏幕坐标上——
 * 先 setTransform(identity) 再描路径，否则裁剪区域整体偏移、图形不可见。
 */
export function drawGraphic(
  ex: ExcaliburGraphicsContext2DCanvas,
  graphic: Graphic,
  bl: Vector,
  br: Vector,
  tl: Vector,
  tr: Vector,
): void {
  const w = graphic.width;
  const h = graphic.height;
  if (w <= 0 || h <= 0) return;

  const ctx = ex.__ctx;

  // 每个三角形：3 个屏幕顶点（clip 区域 + 仿射目标）与 3 个纹理顶点（仿射源）
  const triangles = [
    [tl, tr, bl, vec(0, 0), vec(w, 0), vec(0, h)],
    [tr, br, bl, vec(w, 0), vec(w, h), vec(0, h)],
  ] as const;

  for (const [p0, p1, p2, t0, t1, t2] of triangles) {
    const [c0, c1, c2] = outsetTriangle(p0, p1, p2);
    ctx.save();
    // clip 路径使用绝对屏幕坐标（清除 GraphicsSystem 施加的外层变换）
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.moveTo(c0.x, c0.y);
    ctx.lineTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(solveAffine(p0, p1, p2, t0, t1, t2).toDOMMatrix());
    graphic.draw(ex, 0, 0);
    ctx.restore();
  }
}
