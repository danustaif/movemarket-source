import { Composition } from "remotion";
import { Demo, TOTAL_FRAMES } from "./Video";
import { Pitch } from "./Pitch";
import { TOTAL } from "./pitch/timeline";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="MoveMarketDemo" component={Demo} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
    <Composition id="MoveMarketPitch" component={Pitch} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
  </>
);
