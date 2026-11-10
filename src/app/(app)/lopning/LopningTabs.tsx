"use client";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LopningTab = "pass" | "utveckling";

/** Flikar på Löpning. Vald flik sparas i adressen så att Tillbaka hamnar rätt. */
export function LopningTabs({ initial, pass, utveckling }: { initial: LopningTab; pass: ReactNode; utveckling: ReactNode }) {
  return (
    <Tabs
      defaultValue={initial}
      onValueChange={(v) => window.history.replaceState(null, "", v === "utveckling" ? "/lopning?flik=utveckling" : "/lopning")}
      className="gap-4"
    >
      <TabsList className="w-full">
        <TabsTrigger value="pass">Pass</TabsTrigger>
        <TabsTrigger value="utveckling">Utveckling</TabsTrigger>
      </TabsList>
      <TabsContent value="pass" className="space-y-2">{pass}</TabsContent>
      <TabsContent value="utveckling" className="space-y-5">{utveckling}</TabsContent>
    </Tabs>
  );
}
