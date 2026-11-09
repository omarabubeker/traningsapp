"use client";
import { useSyncExternalStore } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Options = { title: string; description?: string; confirmLabel?: string; danger?: boolean };
type State = { open: boolean; opts: Options; resolve: (ok: boolean) => void } | null;

let state: State = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

/** Bekräftelseruta i appens stil i stället för webbläsarens confirm(). */
export function confirmDialog(opts: Options): Promise<boolean> {
  return new Promise((resolve) => {
    state?.resolve(false);
    state = { open: true, opts, resolve };
    emit();
  });
}

function answer(ok: boolean) {
  if (!state?.open) return;
  const { resolve } = state;
  state = { ...state, open: false }; // innehållet ligger kvar under stängningsanimationen
  emit();
  resolve(ok);
}

export function ConfirmDialogHost() {
  const s = useSyncExternalStore(subscribe, () => state, () => null);
  if (!s) return null;
  return (
    <AlertDialog open={s.open} onOpenChange={(o) => !o && answer(false)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{s.opts.title}</AlertDialogTitle>
          {s.opts.description && <AlertDialogDescription>{s.opts.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="secondary" onClick={() => answer(false)}>Avbryt</AlertDialogCancel>
          <AlertDialogAction variant={s.opts.danger ? "destructive" : "default"} onClick={() => answer(true)}>
            {s.opts.confirmLabel ?? "OK"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
