import { SessionLogger } from "./SessionLogger";

export default async function GymSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionLogger sessionId={id} />;
}
