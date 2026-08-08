import { DisplayMode, Engine, Loader, WebAudio } from "excalibur";
import { allResources, ensureAllResourceLoaded } from "./core/assets";
import { PlayingScene } from "./scenes/playing-scene";
import { TurningAnimationScene } from "./scenes/turning-animation-scene";
import { StartMenuScene, goToStartMenuScene } from "./scenes/start-menu-scene";

const engine = new Engine({
  width: 600,
  height: 800,
  displayMode: DisplayMode.FitScreen,
  // 限制最大帧率：画面在 30fps 与更高帧率间跳变时观感更差，锁定 30fps 更稳定
  maxFps: 30,
  physics: {
    // 提高物理采样率：Runner 与障碍均为 Passive，CCD 不生效，
    // 默认 substep=1 时高速（>600 单位/s）下会整帧跳过碰撞窗口（tunneling）导致穿透，
    // substep=8 覆盖到 4000 单位/s（约 12 分钟对局）仍 100% 命中。
    substep: 8,
  },
  scenes: {
    startMenu: new StartMenuScene(),
    playing: new PlayingScene(),
    turningAnimation: new TurningAnimationScene(),
  },
});

engine.useCanvas2DFallback();

const loader = new Loader(allResources());
// 隐藏 play 按钮：加载完成后等待短暂延迟即自动进入游戏
loader.suppressPlayButton = true;
await engine.start(loader);
// 启动断言：资源必须全部加载成功，失败即显式报错，而非运行时静默降级
ensureAllResourceLoaded();

// 浏览器自动播放策略：AudioContext 必须在用户手势后才能 resume。
// suppressPlayButton 导致加载阶段无用户交互，Excalibur 加载时的自动解锁必然失败（控制台告警一次），
// 且它只尝试这一次，之后不会重试；这里在首次用户手势（点击/按键/触摸）时调用官方解锁 API，
// 此后音频（含将来新增的 Sound 资源）即可正常播放。
const unlockAudioOnGesture = () => {
  window.removeEventListener("pointerdown", unlockAudioOnGesture);
  window.removeEventListener("keydown", unlockAudioOnGesture);
  window.removeEventListener("touchstart", unlockAudioOnGesture);
  void WebAudio.unlock();
};
window.addEventListener("pointerdown", unlockAudioOnGesture);
window.addEventListener("keydown", unlockAudioOnGesture);
window.addEventListener("touchstart", unlockAudioOnGesture);

await goToStartMenuScene(engine);

Object.defineProperty(window, "engine", { value: engine });
