"use client";
import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type MoreItem = { label: string; onSelect: () => void; danger?: boolean };

/** ⋯-meny med åtgärder (t.ex. Radera pass). */
export function MoreMenu({ items }: { items: MoreItem[] }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Fler val">
          <MoreHorizontalIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {items.map((it) => (
          <DropdownMenuItem key={it.label} variant={it.danger ? "destructive" : "default"} onSelect={it.onSelect} className="px-3 py-2.5 text-base">
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
