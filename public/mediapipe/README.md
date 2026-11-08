# MediaPipe (självhostat)

- `models/pose_landmarker_lite.task` och `models/pose_landmarker_full.task` –
  Pose Landmarker-modeller (Apache 2.0) hämtade från
  `storage.googleapis.com/mediapipe-models/pose_landmarker/…/float16/latest/`.
- `wasm/` skapas automatiskt från `@mediapipe/tasks-vision` (se `scripts/copy-mediapipe.mjs`)
  och checkas inte in.

Allt körs i webbläsaren. Ingen bild eller video lämnar telefonen.
