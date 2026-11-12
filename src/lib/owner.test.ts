import { afterEach, describe, expect, it } from "vitest";
import { isOwner } from "./owner";

describe("isOwner", () => {
  const prev = process.env.ALLOWED_EMAIL;
  afterEach(() => void (process.env.ALLOWED_EMAIL = prev));
  it("är den första adressen i ALLOWED_EMAIL, oavsett skiftläge", () => {
    process.env.ALLOWED_EMAIL = "Agare@Example.se, van@example.se";
    expect(isOwner("agare@example.se")).toBe(true);
    expect(isOwner("van@example.se")).toBe(false);
    expect(isOwner(null)).toBe(false);
  });
});
