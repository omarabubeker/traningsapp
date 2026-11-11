import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { IconProps } from "@phosphor-icons/react";

export type Icon = ComponentType<IconProps>;
export type Tone = "brand" | "run" | "gym" | "streak" | "danger" | "muted";

export const TONE_TEXT: Record<Tone, string> = {
  brand: "text-brand",
  run: "text-run",
  gym: "text-gym",
  streak: "text-streak",
  danger: "text-danger",
  muted: "text-muted-foreground",
};
const TONE_BG: Record<Tone, string> = {
  brand: "bg-brand/15",
  run: "bg-run/15",
  gym: "bg-gym/15",
  streak: "bg-streak/15",
  danger: "bg-danger/15",
  muted: "bg-secondary",
};

/** Kortets rubrikrad: ikon och titel i kategorins färg, valfri text/pil till höger. */
export function CardHead({ icon: I, tone = "brand", title, right, chevron }: { icon?: Icon; tone?: Tone; title: ReactNode; right?: ReactNode; chevron?: boolean }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3">
      <span className={`flex min-w-0 items-center gap-1.5 text-[15px] font-semibold ${TONE_TEXT[tone]}`}>
        {I && <I size={18} weight="duotone" className="shrink-0" />}
        <span className="truncate">{title}</span>
      </span>
      {(right || chevron) && (
        <span className="flex shrink-0 items-center gap-0.5 text-sm text-muted-foreground">
          {right}
          {chevron && <CaretRight size={14} weight="bold" />}
        </span>
      )}
    </div>
  );
}

/** Stor siffra med liten enhet (kortets huvudvärde). */
export function BigValue({ value, unit, className = "" }: { value: ReactNode; unit?: ReactNode; className?: string }) {
  return (
    <p className={`num-xl ${className}`}>
      {value}
      {unit && <span className="unit">{unit}</span>}
    </p>
  );
}

/** Kort i Hälsa-stil: rubrikrad, en stor siffra, undertext och valfritt litet diagram. */
export function StatCard({
  icon,
  tone = "brand",
  title,
  value,
  unit,
  sub,
  href,
  aside,
  right,
}: {
  icon?: Icon;
  tone?: Tone;
  title: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  href?: string;
  aside?: ReactNode;
  right?: ReactNode;
}) {
  const body = (
    <>
      <CardHead icon={icon} tone={tone} title={title} right={right} chevron={!!href} />
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <BigValue value={value} unit={unit} />
          {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </>
  );
  const cls = "card flex flex-col justify-between gap-4";
  return href ? (
    <Link href={href} className={`${cls} active:bg-secondary`}>{body}</Link>
  ) : (
    <section className={cls}>{body}</section>
  );
}

/** Ikon i en färgad cirkel (listrader, t.ex. ett löppass). */
export function IconBadge({ icon: I, tone = "brand", size = "md" }: { icon: Icon; tone?: Tone; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-12" : "size-10";
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center rounded-full ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}>
      <I size={size === "lg" ? 26 : 22} weight="duotone" />
    </span>
  );
}

/** Tomt läge: stor duotone-ikon, kort text och valfri åtgärd. */
export function EmptyState({ icon: I, title, children, tone = "muted" }: { icon: Icon; title: string; children?: ReactNode; tone?: Tone }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-8 text-center">
      <I size={48} weight="duotone" className={TONE_TEXT[tone]} />
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-xs text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Sektionsrubrik med valfri länk till höger. */
export function SectionHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="h-section">{title}</h2>
      {href && link && (
        <Link href={href} className="text-sm font-medium text-brand">
          {link}
        </Link>
      )}
    </div>
  );
}
