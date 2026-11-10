// Målloppet. Ändra här om datumet ändras (coachens instruktioner nämner det också).
export const RACE_DATE = "2027-05-29";
export const RACE_NAME = "maraton";

export function daysToRace(todayIso: string) {
  return Math.round((Date.parse(RACE_DATE + "T00:00:00Z") - Date.parse(todayIso + "T00:00:00Z")) / 864e5);
}

// Uppladdningen mot maran startade här; milstolparna räknas från detta datum.
export const TRAINING_START = "2026-11-02";
// Riktmärken för målet under 4 h (sek/km): maratonfart och halvmara på 1:55.
export const MARATHON_PACE = 341; // 4:00:00 / 42,195 km ≈ 5:41/km
export const HALF_PACE = 327; // 1:55:00 / 21,0975 km ≈ 5:27/km
