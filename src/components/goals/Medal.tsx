import { PersonSimpleRun } from "@phosphor-icons/react/dist/ssr";

/** Medalj för en milstolpe: lime-gradient med löparikon. Grå kontur när den inte är tagen. */
export function Medal({ size = 44, earned = true, id }: { size?: number; earned?: boolean; id: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--primary-2)" />
        </linearGradient>
      </defs>
      {earned ? (
        <>
          <circle cx="32" cy="32" r="30" fill={`url(#${id})`} />
          <circle cx="32" cy="32" r="24" fill="none" stroke="var(--primary-foreground)" strokeOpacity={0.3} strokeWidth={1.5} />
        </>
      ) : (
        <circle cx="32" cy="32" r="29" fill="var(--secondary)" stroke="var(--border)" strokeWidth={2} strokeDasharray="4 4" />
      )}
      <PersonSimpleRun x={18} y={18} size={28} weight="fill" color={earned ? "var(--primary-foreground)" : "var(--muted-foreground)"} />
    </svg>
  );
}
