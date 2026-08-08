import { goToPlayingScene } from "./playing-scene";
import {
  BaseAlign,
  Color,
  Font,
  GraphicsGroup,
  Scene,
  ScreenElement,
  Text,
  TextAlign,
  vec,
  type Engine,
} from "excalibur";
import { MenuButton } from "../ui/menu-button";
import { VerticalList } from "../ui/vertical-list";

const BUTTON_GAP = 20;
const START_Y = 420;
const TITLE_Y = 160;
const SUBTITLE_Y = 210;

export class StartMenuScene extends Scene {
  override onInitialize(): void {
    this.backgroundColor = Color.fromHex("#0f0f23");

    const midX = this.engine.canvas.width / 2;

    this.add(createTitle(midX));

    this.add(
      new VerticalList({
        x: midX,
        y: START_Y,
        gap: BUTTON_GAP,
        align: "center",
        items: [
          new MenuButton({
            label: "Start Game",
            action: (engine) => {
              void goToPlayingScene(engine);
            },
          }),
          new MenuButton({
            label: "Tutorial",
            action: (engine) => {
              void goToPlayingScene(engine, { gameStatus: "tutorial" });
            },
          }),
        ],
      }),
    );
  }
}

// Text 是 Graphic，不能独立加入场景，需要挂在 Actor 上；
// 标题+副标题共享一个 ScreenElement，用 GraphicsGroup 定位两个 Text
function createTitle(midX: number): ScreenElement {
  const title = new ScreenElement();
  title.graphics.use(
    new GraphicsGroup({
      members: [
        {
          graphic: new Text({
            text: "PTR Game",
            color: Color.fromHex("#e0e0e0"),
            // textAlign=Center + baseAlign=Middle：文字以原点为中心绘制
            font: new Font({
              family: "monospace",
              size: 40,
              bold: true,
              textAlign: TextAlign.Center,
              baseAlign: BaseAlign.Middle,
            }),
          }),
          offset: vec(midX, TITLE_Y),
        },
        {
          graphic: new Text({
            text: "Penguin & Turtle Run",
            color: Color.fromHex("#888888"),
            font: new Font({
              family: "monospace",
              size: 18,
              textAlign: TextAlign.Center,
              baseAlign: BaseAlign.Middle,
            }),
          }),
          offset: vec(midX, SUBTITLE_Y),
        },
      ],
    }),
  );
  return title;
}

export async function goToStartMenuScene(engine: Engine): Promise<void> {
  await engine.goToScene("startMenu");
}
