import { ScreenElement, vec, type Actor } from "excalibur";

export interface VerticalListOptions {
  /** 对齐参考线：align=center 时是中心线，align=left 时是左缘 */
  x: number;
  /** 第一个子项顶部 y */
  y: number;
  /** 子项间垂直间距 */
  gap: number;
  /** 水平对齐方式：center 时子项以 x 为中心居中 */
  align: "left" | "center";
  items: readonly Actor[];
}

/**
 * 垂直列表容器：子项通过 addChild 挂载，坐标是相对 list 的局部坐标，
 * 移动 list.pos 时子项自动跟随（transform 链）。
 * 子项进场景由 scene.add(list) 递归级联，无需手动逐个添加。
 */
export class VerticalList extends ScreenElement {
  constructor(options: VerticalListOptions) {
    super({ x: options.x, y: options.y });

    let currentY = 0;
    for (const item of options.items) {
      item.pos = vec(
        options.align === "center" ? -item.width / 2 : 0,
        currentY,
      );
      this.addChild(item);
      currentY += item.height + options.gap;
    }
  }
}
