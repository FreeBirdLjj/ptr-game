import { ImageSource, type Loadable } from "excalibur";
import gateUrl from "../../assets/images/gate.png";
import ptNormalUrl from "../../assets/images/pt-normal.png";
import hurdleUrl from "../../assets/images/hurdle.png";
import ptJumpingUrl from "../../assets/images/pt-jumping.png";
import ptCrouchingUrl from "../../assets/images/pt-crouching.png";
import turningBackgroundUrl from "../../assets/images/turning-background.png";

/**
 * 资源注册表：集中声明 assets 目录下的所有资源。
 *
 * 访问路径与 assets 目录结构一一对应（目录/文件名采用驼峰式）：
 *   assets/images/gate.png      → Assets.images.gate
 *   assets/images/pt-normal.png → Assets.images.ptNormal
 *   assets/images/hurdle.png    → Assets.images.hurdle
 *   assets/images/pt-jumping.png → Assets.images.ptJumping
 *   assets/images/pt-crouching.png → Assets.images.ptCrouching
 *   assets/images/turning-background.png → Assets.images.turningBackground
 *
 * 新增资源：把文件放入 assets 对应目录，在此处添加一行即可；
 * allResources() 与 ensureAllResourceLoaded() 会自动覆盖新资源（不限类型，如未来的 Sound 等）。
 *
 * 约束：所有组件绘制用到的资源必须在此注册（启动断言依赖此注册表），
 * 否则 ensureAllResourceLoaded() 无法覆盖，draw 时可能拿到未加载资源。
 */
export const Assets = {
  images: {
    gate: new ImageSource(gateUrl),
    ptNormal: new ImageSource(ptNormalUrl),
    hurdle: new ImageSource(hurdleUrl),
    ptJumping: new ImageSource(ptJumpingUrl),
    ptCrouching: new ImageSource(ptCrouchingUrl),
    turningBackground: new ImageSource(turningBackgroundUrl),
  },
} as const;

/** 鸭子类型判断：是否实现了 Loadable 接口（load/isLoaded），不绑定具体资源类型 */
function isLoadable(value: unknown): value is Loadable<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.load === "function" && typeof record.isLoaded === "function"
  );
}

/** 递归收集 Assets 中声明的全部 Loadable 资源（嵌套结构对应 assets 目录树） */
function collectResources(obj: object): Loadable<unknown>[] {
  const out: Loadable<unknown>[] = [];
  for (const value of Object.values(obj)) {
    if (isLoadable(value)) {
      out.push(value);
    } else if (typeof value === "object" && value !== null) {
      out.push(...collectResources(value as object));
    }
  }
  return out;
}

/** 全部资源列表，用于构建 Loader */
export function allResources(): Loadable<unknown>[] {
  return collectResources(Assets);
}

/** 启动断言：全部资源必须加载成功，否则抛出带路径的错误 */
export function ensureAllResourceLoaded(): void {
  for (const resource of allResources()) {
    if (!resource.isLoaded()) {
      const path = (resource as { path?: unknown }).path;
      const label = typeof path === "string" ? path : resource.constructor.name;
      throw new Error(`Failed to load resource: ${label}`);
    }
  }
}
