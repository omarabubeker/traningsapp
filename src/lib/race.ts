// Målloppet. Ändra här om datumet ändras (coachens instruktioner nämner det också).
export const RACE_DATE = "2027-05-29";
export const RACE_NAME = "maraton";

export function daysToRace(todayIso: string) {
  return Math.round((Date.parse(RACE_DATE + "T00:00:00Z") - Date.parse(todayIso + "T00:00:00Z")) / 864e5);
}
