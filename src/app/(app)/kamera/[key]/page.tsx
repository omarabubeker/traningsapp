import { notFound } from "next/navigation";
import { MOVEMENTS } from "@/lib/movement/registry";
import type { MovementKey } from "@/lib/movement/types";
import { CameraCoach } from "./CameraCoach";

export default async function KameraOvning({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(key in MOVEMENTS)) notFound();
  return <CameraCoach movementKey={key as MovementKey} />;
}
