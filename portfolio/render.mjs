// Renderar film.html bildruta för bildruta och sätter ihop MP4 + affisch med ffmpeg.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // förinstallerad globalt i miljön
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const frames = process.env.FRAMES_DIR ?? dir + "frames";
const FPS = 30, SECONDS = 20;
const only = process.argv[2] ? process.argv.slice(2).map(Number) : null; // enstaka tider för kontroll

rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("file://" + dir + "film.html");
await page.waitForFunction("window.ready === true");
const shot = async (t, path) => { await page.evaluate((t) => window.seek(t), t); await page.screenshot({ path }); };
if (only) {
  for (const t of only) await shot(t, `${frames}/t${t.toFixed(2)}.png`);
} else {
  for (let i = 0; i < FPS * SECONDS; i++) await shot(i / FPS, `${frames}/f${String(i).padStart(4, "0")}.png`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${frames}/f%04d.png`, "-frames:v", String(FPS * SECONDS), "-an",
    "-c:v", "libx264", "-preset", "veryslow", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", dir + "traning-film.mp4"]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${frames}/f${String(FPS * SECONDS - 1).padStart(4, "0")}.png`, "-q:v", "2", dir + "traning-poster.jpg"]);
}
await b.close();
