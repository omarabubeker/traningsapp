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
    <nav className="bottom-nav pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" || path.startsWith("/mal") : path.startsWith(href) || (href === "/coach" && path.startsWith("/plan"));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pt-2 text-[11px] font-semibold ${active ? "text-brand" : "text-muted-foreground"}`}
              >
                <Icon size={26} weight={active ? "fill" : "regular"} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
