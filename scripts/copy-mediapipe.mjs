// Kopierar MediaPipes WASM-filer från npm-paketet till public/ så att de
// självhostas av appen (ingen trafik till Googles CDN). Körs före dev och build.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const src = join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join("public", "mediapipe", "wasm");
if (!existsSync(src)) {
  console.error("Hittar inte @mediapipe/tasks-vision – kör npm install först.");
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
for (const f of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]) cpSync(join(src, f), join(dest, f));
console.log("MediaPipe WASM kopierad till", dest);
