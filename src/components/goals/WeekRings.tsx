import { Check } from "@phosphor-icons/react/dist/ssr";
import type { WeekRings as Rings } from "@/lib/goals";

const R = [42, 31, 20];
const STROKE = 9;

function Arc({ r, share, color }: { r: number; share: number; color: string }) {
  const c = 2 * Math.PI * r;
  const s = Math.max(0, Math.min(1, share));
  return (
    <>
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={STROKE} />
      {s > 0 && (
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={`${c * s} ${c}`} transform="rotate(-90 50 50)"
        />
      )}
    </>
  );
}

const share = (done: number, target: number) => (target > 0 ? done / target : done > 0 ? 1 : 0);
const sv = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 1 });

/** Tre ringar för veckan (löp-km, gympass, planen), i stil med klockans aktivitetsringar. */
export function WeekRings({ rings }: { rings: Rings }) {
  const rows = [
    { label: "Löpning", color: "var(--color-run)", value: rings.km.target ? `${sv(rings.km.done)}/${sv(rings.km.target)}` : sv(rings.km.done), unit: "km", s: share(rings.km.done, rings.km.target) },
    { label: "Gym", color: "var(--color-gym)", value: `${rings.gym.done}/${rings.gym.target}`, unit: "pass", s: share(rings.gym.done, rings.gym.target) },
    { label: "Planen", color: "var(--color-brand)", value: `${rings.plan.done}/${rings.plan.total}`, unit: "pass", s: share(rings.plan.done, rings.plan.total) },
  ];
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="size-28 shrink-0" role="img" aria-label="Veckans ringar">
        {rows.map((r, i) => <Arc key={r.label} r={R[i]} share={r.s} color={r.color} />)}
      </svg>
      <ul className="flex-1 space-y-2">
        {rows.map((r) => (
          <li key={r.label} style={{ color: r.color }}>
            <span className="block text-[13px] font-semibold leading-4">{r.label}</span>
            <span className="num-lg">
              {r.value}
              <span className="ml-1 text-xs font-bold uppercase">{r.unit}</span>
              {r.s >= 1 && <Check size={16} weight="bold" className="ml-1 inline align-[-1px]" />}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
