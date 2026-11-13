import { describe as d, expect, it } from "vitest";
import { clothing, describe } from "./clothing";

const w = (o: Partial<Parameters<typeof clothing>[0]>) => ({ hour: "2026-11-13T07:00", temp: 5, feels: 5, wind: 2, precipProb: 0, precip: 0, code: 3, dark: false, ...o });

d("klädtips", () => {
  it("varmt och kallt", () => {
    expect(clothing(w({ temp: 22, feels: 22, code: 0 })).items).toEqual(["linne eller t-shirt", "shorts", "keps"]);
    expect(clothing(w({ temp: -8, feels: -12 })).items).toContain("vantar");
  });

  it("regn, vind och handskar", () => {
    const rain = clothing(w({ temp: 6, feels: 5, precipProb: 80, precip: 1 }));
    expect(rain.items).toContain("vattenavvisande jacka");
    expect(rain.items).toContain("tunna handskar");
    const cold = clothing(w({ temp: 1, feels: -1, precipProb: 70 }));
    expect(cold.items).toContain("vattenavvisande jacka");
    expect(cold.items.some((i) => i.startsWith("tunn jacka"))).toBe(false);
    expect(clothing(w({ temp: 10, feels: 10, wind: 9 })).items).toContain("vindtät jacka");
  });

  it("varningar", () => {
    expect(clothing(w({ temp: 0, feels: -3, code: 73 })).notes[0]).toMatch(/broddar/);
    expect(clothing(w({ dark: true })).notes).toContain("Mörkt – reflexväst eller pannlampa.");
    expect(clothing(w({ temp: 18, feels: 18, code: 0 }), { longRun: true }).notes).toContain("Ta med vatten på långpasset.");
  });

  it("vädertyp", () => {
    expect(describe(53)).toBe("Duggregn");
    expect(describe(75)).toBe("Snö");
    expect(describe(0)).toBe("Klart");
  });
});
