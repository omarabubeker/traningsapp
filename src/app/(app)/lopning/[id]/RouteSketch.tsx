/** Enkel ruttskiss i SVG (riktig karta kommer i etapp 4). */
export function RouteSketch({ route }: { route: [number, number][] }) {
  const lats = route.map((p) => p[0]);
  const lngs = route.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)); // längdgrader krymper mot polerna
  const w = (maxLng - minLng) * kx || 1e-6;
  const h = maxLat - minLat || 1e-6;
  const size = 300, pad = 12;
  const scale = (size - 2 * pad) / Math.max(w, h);
  const ox = (size - w * scale) / 2, oy = (size - h * scale) / 2;
  const pts = route.map(([lat, lng]) => [ox + (lng - minLng) * kx * scale, oy + (maxLat - lat) * scale]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-56 w-full" aria-label="Ruttskiss">
      <path d={d} fill="none" stroke="var(--color-run)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx} cy={sy} r={5} fill="var(--color-accent)" />
      <circle cx={ex} cy={ey} r={5} fill="none" stroke="var(--color-text)" strokeWidth={2} />
    </svg>
  );
}
