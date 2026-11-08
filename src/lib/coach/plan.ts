import type { PlanItem } from "../types";

export type ItemStatus = "done" | "missed" | "today" | "upcoming" | "rest";

/** Jämför planerat pass med genomförda pass samma dag (svensk tid). */
export function itemStatus(
  item: Pick<PlanItem, "date" | "kind">,
  today: string,
  doneDays: { run: Set<string>; gym: Set<string>; any: Set<string> },
): ItemStatus {
  if (item.kind === "rest") return "rest";
  const done =
    item.kind === "run" ? doneDays.run.has(item.date) : item.kind === "gym" ? doneDays.gym.has(item.date) : doneDays.any.has(item.date);
  if (done) return "done";
  if (item.date < today) return "missed";
  if (item.date === today) return "today";
  return "upcoming";
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  done: "Klart",
  missed: "Missat",
  today: "Idag",
  upcoming: "",
  rest: "Vila",
};
