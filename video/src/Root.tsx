import { Composition } from "remotion";
import { Demo, TOTAL_FRAMES } from "./Video";

export const RemotionRoot: React.FC = () => (
  <Composition id="MoveMarketDemo" component={Demo} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
);
