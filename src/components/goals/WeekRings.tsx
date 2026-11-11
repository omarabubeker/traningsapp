import { Barbell, ListChecks, PersonSimpleRun } from "@phosphor-icons/react/dist/ssr";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import type { WeekRings as Rings } from "@/lib/goals";

const SIZE = 84;
const STROKE = 8;
const R = (SIZE - STROKE) / 2;
// Mellanrum mellan segmenten. Rundade ändar sticker ut STROKE/2 åt varje håll, så de räknas in.
const GAP_DEG = 12 + ((STROKE / R) * 180) / Math.PI;

const sv = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 1 });

/** Båge från vinkel a till b (grader, 0 = rakt upp, medurs). */
function arc(a: number, b: number) {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const [x1, y1] = [SIZE / 2 + R * Math.cos(rad(a)), SIZE / 2 + R * Math.sin(rad(a))];
  const [x2, y2] = [SIZE / 2 + R * Math.cos(rad(b)), SIZE / 2 + R * Math.sin(rad(b))];
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${b - a > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

/**
 * En ring per mål. Pass (gym, planen) visas som segment – ett per planerat pass, fyllt när
 * det är gjort. Kilometer visas som en sammanhängande båge.
 */
function Ring({ color, done, total, segmented, Icon }: { color: string; done: number; total: number; segmented: boolean; Icon: ComponentType<IconProps> }) {
  const share = total > 0 ? Math.min(1, done / total) : done > 0 ? 1 : 0;
  const n = segmented ? Math.max(total, 1) : 1;
  const segs = segmented
    ? Array.from({ length: n }, (_, i) => {
        const span = 360 / n;
        const a = i * span + (n > 1 ? GAP_DEG / 2 : 0);
        const b = (i + 1) * span - (n > 1 ? GAP_DEG / 2 : 0.01);
        return { d: arc(a, b), on: i < done };
      })
    : null;
  const c = 2 * Math.PI * R;
  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        {segs ? (
          segs.map((s, i) => (
            <path key={i} d={s.d} fill="none" stroke={color} strokeOpacity={s.on ? 1 : 0.18} strokeWidth={STROKE} strokeLinecap="round" />
          ))
        ) : (
          <>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={STROKE} />
            {share > 0 && (
              <circle
                cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
                strokeDasharray={`${c * share} ${c}`} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            )}
          </>
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        <Icon size={26} weight={share >= 1 ? "fill" : "duotone"} />
      </span>
    </div>
  );
}

/** Veckans mål som tre separata ringar bredvid varandra. */
export function WeekRings({ rings }: { rings: Rings }) {
  const items = [
    { label: "Löpning", color: "var(--color-run)", Icon: PersonSimpleRun, done: rings.km.done, total: rings.km.target, segmented: false, value: rings.km.target ? `${sv(rings.km.done)}/${sv(rings.km.target)}` : sv(rings.km.done), unit: "km" },
    { label: "Gym", color: "var(--color-gym)", Icon: Barbell, done: rings.gym.done, total: rings.gym.target, segmented: true, value: `${rings.gym.done}/${rings.gym.target}`, unit: "pass" },
    { label: "Planen", color: "var(--color-brand)", Icon: ListChecks, done: rings.plan.done, total: rings.plan.total, segmented: true, value: `${rings.plan.done}/${rings.plan.total}`, unit: "pass" },
  ];
  return (
    <ul className="grid grid-cols-3 gap-2" aria-label="Veckans ringar">
      {items.map((it) => (
        <li key={it.label} className="flex flex-col items-center gap-2 text-center">
          <Ring color={it.color} done={it.done} total={it.total} segmented={it.segmented} Icon={it.Icon} />
          <span className="space-y-0.5">
            <span className="num-lg block">
              {it.value}
              <span className="ml-1 text-xs font-bold uppercase text-muted-foreground">{it.unit}</span>
            </span>
            <span className="block text-[13px] font-semibold" style={{ color: it.color }}>{it.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
