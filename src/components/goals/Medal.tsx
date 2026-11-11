import { PersonSimpleRun } from "@phosphor-icons/react/dist/ssr";

// Kort text på medaljen per milstolpe (som "5K" på klockans utmärkelser).
export const MEDAL_TEXT: Record<string, string> = {
  long15: "15", week40: "40", long20: "20", half: "½", long25: "25",
  week50: "50", three40: "3×", long30: "30", mp30: "MP", long32: "32",
};

/**
 * Medalj för en milstolpe. Tagen: lime-gradient med text eller löparikon.
 * Inte tagen: streckad grå kontur (nästa milstolpe får grön kontur).
 */
export function Medal({ id, size = 44, earned = true, next = false, text }: { id: string; size?: number; earned?: boolean; next?: boolean; text?: string }) {
  const fg = earned ? "var(--primary-foreground)" : next ? "var(--color-brand)" : "var(--muted-foreground)";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary-2)" />
        </linearGradient>
      </defs>
      {earned ? (
        <>
          <circle cx="32" cy="32" r="30" fill={`url(#${id})`} />
          <circle cx="32" cy="32" r="24.5" fill="none" stroke="var(--primary-foreground)" strokeOpacity={0.28} strokeWidth={1.5} />
          {/* ljusreflex */}
          <path d="M14 22 A21 21 0 0 1 30 11" fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" />
        </>
      ) : (
        <circle cx="32" cy="32" r="29" fill="var(--secondary)" stroke={next ? "var(--color-brand)" : "var(--border)"} strokeWidth={next ? 2.5 : 2} strokeDasharray={next ? undefined : "4 5"} />
      )}
      {text ? (
        <text x="32" y="33" textAnchor="middle" dominantBaseline="central" fontSize={text.length > 2 ? 17 : 22} fontWeight={800} fill={fg} style={{ letterSpacing: "-0.03em" }}>
          {text}
        </text>
      ) : (
        <PersonSimpleRun x={18} y={18} size={28} weight="fill" color={fg} />
      )}
    </svg>
  );
}
