"use client";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LopningTab = "pass" | "utveckling";

/** Flikar på Löpning. Vald flik sparas i adressen så att Tillbaka hamnar rätt. */
export function LopningTabs({ initial, pass, utveckling }: { initial: LopningTab; pass: ReactNode; utveckling: ReactNode }) {
  return (
    <Tabs
      defaultValue={initial}
      onValueChange={(v) => window.history.replaceState(null, "", v === "pass" ? "/lopning?flik=pass" : "/lopning")}
      className="gap-4"
    >
      <TabsList className="w-full">
        <TabsTrigger value="utveckling">Utveckling</TabsTrigger>
        <TabsTrigger value="pass">Pass</TabsTrigger>
      </TabsList>
      <TabsContent value="utveckling" className="space-y-6">{utveckling}</TabsContent>
      <TabsContent value="pass" className="space-y-3">{pass}</TabsContent>
    </Tabs>
  );
}
