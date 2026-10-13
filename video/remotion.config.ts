/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// chrome-headless-shell bawaan Remotion macet di "Waiting for root component" di mesin ini
// (requestAnimationFrame tidak jalan). Pakai Chrome sistem bila ada; set REMOTION_CHROME untuk path lain.
import { existsSync } from "node:fs";
const chrome = process.env.REMOTION_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (existsSync(chrome)) Config.setBrowserExecutable(chrome);

// Papan 3D (@remotion/three) butuh renderer GL ANGLE; default Chrome headless menghasilkan kanvas kosong.
Config.setChromiumOpenGlRenderer("angle");
