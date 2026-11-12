"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Copy, ShareNetwork } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ConfirmDialog";
import { newLink, removeMember, setActive } from "./actions";

type Props = {
  id: string;
  name: string;
  email: string;
  link: string;
  active: boolean;
  lastLogin: string | null;
  usage: string | null;
  isSelf: boolean;
};

/** En medlem i admin-vyn: länk att kopiera/dela, ny länk, stäng av, ta bort. */
export function MemberCard({ id, name, email, link, active, lastLogin, usage, isSelf }: Props) {
  const [pending, start] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Länken är kopierad");
    } catch {
      toast.error("Kunde inte kopiera – håll inne på länken och kopiera.");
    }
  }
  async function share() {
    const text = `Hej ${name}! Här är din länk till träningsappen – tryck på den så loggas du in direkt:\n${link}`;
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else copy();
  }

  return (
    <div className={`card space-y-3 ${active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{name}{isSelf && <span className="ml-1 text-sm font-normal text-muted-foreground">(du)</span>}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p>{active ? (lastLogin ? `Senast inne ${lastLogin}` : "Inte inloggad än") : "Avstängd"}</p>
          {usage && <p>Coach denna månad: {usage}</p>}
        </div>
      </div>
      {active && (
        <>
          <p className="rounded-xl bg-secondary px-3 py-2 font-mono text-xs break-all select-all">{link}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={share}><ShareNetwork size={16} weight="bold" /> Skicka länken</Button>
            <Button size="sm" variant="secondary" onClick={copy}><Copy size={16} weight="bold" /> Kopiera</Button>
          </div>
        </>
      )}
      {!isSelf && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {active && (
            <button
              disabled={pending}
              className="text-muted-foreground"
              onClick={async () => {
                if (await confirmDialog({ title: "Skapa ny länk?", description: "Den gamla länken slutar fungera. Den som redan är inloggad påverkas inte.", confirmLabel: "Ny länk" }))
                  start(() => newLink(id));
              }}
            >
              Ny länk
            </button>
          )}
          <button
            disabled={pending}
            className="text-muted-foreground"
            onClick={async () => {
              if (active && !(await confirmDialog({ title: `Stäng av ${name}?`, description: "Länken slutar fungera och kontot spärras direkt. Datan finns kvar och du kan aktivera igen.", confirmLabel: "Stäng av", danger: true }))) return;
              start(() => setActive(id, !active));
            }}
          >
            {active ? "Stäng av" : "Aktivera igen"}
          </button>
          <button
            disabled={pending}
            className="text-danger"
            onClick={async () => {
              if (await confirmDialog({ title: `Ta bort ${name}?`, description: "Kontot och all träningsdata tas bort för gott.", confirmLabel: "Ta bort", danger: true }))
                start(() => removeMember(id));
            }}
          >
            Ta bort
          </button>
        </div>
      )}
    </div>
  );
}
