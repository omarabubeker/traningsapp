"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Barbell, ChatCircleDots, House, PersonSimpleRun, User } from "@phosphor-icons/react/dist/ssr";

const items = [
  { href: "/", label: "Översikt", Icon: House },
  { href: "/lopning", label: "Löpning", Icon: PersonSimpleRun },
  { href: "/gym", label: "Gym", Icon: Barbell },
  { href: "/coach", label: "Coach", Icon: ChatCircleDots },
  { href: "/profil", label: "Profil", Icon: User },
];

export function BottomNav() {
  const path = usePathname();
  // Under ett pågående gympass tar loggningen hela skärmen.
  if (/^\/gym\/[^/]+$/.test(path)) return null;
  return (
    <nav className="bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <ul className="pointer-events-auto mx-auto flex max-w-md gap-1 rounded-full border border-border bg-[var(--nav-glass)] p-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur-xl backdrop-saturate-150">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" || path.startsWith("/mal") : path.startsWith(href) || (href === "/coach" && path.startsWith("/plan"));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-semibold transition-colors ${active ? "bg-secondary text-brand" : "text-muted-foreground"}`}
              >
                <Icon size={24} weight={active ? "fill" : "regular"} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
