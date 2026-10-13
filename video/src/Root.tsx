import { Composition } from "remotion";
import { Demo, TOTAL_FRAMES } from "./Video";
import { Pitch } from "./Pitch";
import { TOTAL } from "./pitch/timeline";
import { TechDemo } from "./tech/TechDemo";
import { TOTAL as TECH_TOTAL } from "./tech/timeline";
import { CreDemo, CRE_TOTAL } from "./cre/CreDemo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="MoveMarketDemo" component={Demo} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
    <Composition id="MoveMarketPitch" component={Pitch} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="CreDemo" component={CreDemo} durationInFrames={CRE_TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="TechDemo" component={TechDemo} durationInFrames={TECH_TOTAL} fps={30} width={1920} height={1080} />
  </>
);
