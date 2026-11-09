"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Översikt", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/lopning", label: "Löpning", icon: "M15.5 4.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0M8 21l3-6 3 2v4M7 12l3-4 4 1 2 3h3M10 8l-2 5" },
  { href: "/gym", label: "Gym", icon: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" },
  { href: "/coach", label: "Coach", icon: "M4 5h16v10H9l-5 4zM8 9h8M8 12h5" },
  { href: "/profil", label: "Profil", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" },
];

export function BottomNav() {
  const path = usePathname();
  // Under ett pågående gympass tar loggningen hela skärmen.
  if (/^\/gym\/[^/]+$/.test(path)) return null;
  return (
    <nav className="bottom-nav pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href) || (it.href === "/coach" && path.startsWith("/plan"));
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-1 pt-2 text-xs ${active ? "text-accent" : "text-muted"}`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
