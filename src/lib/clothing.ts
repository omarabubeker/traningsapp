// Klädtips för löpning utifrån väder – rena regler (testbara).
// Tumregel: klä dig som om det vore ~10 grader varmare, eftersom kroppen blir varm efter några minuter.

export type Weather = {
  hour: string; // "2026-11-13T07:00"
  temp: number; // °C
  feels: number; // upplevd temperatur °C
  wind: number; // m/s
  precipProb: number; // %
  precip: number; // mm/h
  code: number; // WMO-vädertyp
  dark: boolean; // före soluppgång eller efter solnedgång
};

const SNOW = new Set([71, 73, 75, 77, 85, 86]);
const THUNDER = new Set([95, 96, 99]);

/** Kort beskrivning av vädret ("Duggregn", "Klart" …). */
export function describe(code: number): string {
  if (code === 0) return "Klart";
  if (code <= 2) return "Halvklart";
  if (code === 3) return "Mulet";
  if (code === 45 || code === 48) return "Dimma";
  if (code >= 51 && code <= 57) return "Duggregn";
  if (code >= 61 && code <= 67) return "Regn";
  if (SNOW.has(code)) return "Snö";
  if (code >= 80 && code <= 82) return "Regnskurar";
  if (THUNDER.has(code)) return "Åska";
  return "Växlande";
}

/** Vad man ska ha på sig, plus korta varningar (halka, mörker, åska). */
export function clothing(w: Weather, opts: { longRun?: boolean } = {}) {
  const t = w.feels;
  const wet = w.precipProb >= 50 || w.precip >= 0.3;
  const windy = w.wind >= 7;
  let items: string[];
  if (t >= 20) items = ["linne eller t-shirt", "shorts", "keps"];
  else if (t >= 14) items = ["t-shirt", "shorts"];
  else if (t >= 9) items = ["t-shirt eller tunn långärmad", "shorts eller korta tights"];
  else if (t >= 4) items = ["långärmad tröja", "tights"];
  else if (t >= -1) items = ["långärmad tröja", wet || windy ? "tunn jacka" : "tunn jacka eller väst", "tights", "tunna handskar", "pannband eller tunn mössa"];
  else if (t >= -6) items = ["underställ", "löparjacka", "varma tights", "handskar", "mössa"];
  else items = ["underställ", "varm löparjacka", "vindtäta tights", "vantar", "mössa", "buff"];

  // Tillägg för regn och vind (bara när en jacka inte redan är med eller det är varmt).
  if (wet && t >= 4) items.push(t >= 14 ? "tunn regnjacka om du vill" : "vattenavvisande jacka");
  else if (wet) items = items.map((i) => (i.includes("jacka") ? "vattenavvisande jacka" : i));
  if (windy && t >= 4 && !wet) items.push("vindtät jacka");
  if (t >= 4 && t < 9 && (windy || wet || w.temp < 6)) items.push("tunna handskar");

  const notes: string[] = [];
  if (w.temp <= 1 && (wet || SNOW.has(w.code))) notes.push("Risk för halka – broddar eller dubbskor.");
  else if (w.temp <= 1) notes.push("Kan vara halt där det är fuktigt.");
  if (w.dark) notes.push("Mörkt – reflexväst eller pannlampa.");
  if (THUNDER.has(w.code)) notes.push("Åska – vänta tills den dragit förbi.");
  if (w.temp >= 22) notes.push(opts.longRun ? "Varmt – ta med vatten och sänk tempot." : "Varmt – drick innan och ta det lugnt.");
  else if (opts.longRun && w.temp >= 16) notes.push("Ta med vatten på långpasset.");
  if (w.code <= 1 && w.temp >= 15 && !w.dark) notes.push("Sol – solglasögon och keps.");

  return { items: [...new Set(items)], notes };
}
