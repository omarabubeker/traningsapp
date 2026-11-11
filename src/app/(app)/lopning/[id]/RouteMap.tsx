"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/** Rutt på OpenStreetMap-karta (Leaflet). Laddas bara i webbläsaren. */
export default function RouteMap({ route }: { route: [number, number][] }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current || route.length < 2) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        className: "map-tiles-dark",
      }).addTo(map);
      const css = getComputedStyle(document.documentElement);
      const v = (n: string) => css.getPropertyValue(n).trim();
      const line = L.polyline(route, { color: v("--run"), weight: 4, opacity: 0.95, lineJoin: "round" }).addTo(map);
      const dot = (p: [number, number], fill: string) =>
        L.circleMarker(p, { radius: 6, color: v("--card"), weight: 2, fillColor: fill, fillOpacity: 1 }).addTo(map!);
      dot(route[0], v("--brand"));
      dot(route[route.length - 1], v("--foreground"));
      map.fitBounds(line.getBounds(), { padding: [20, 20] });
      L.control.zoom({ position: "bottomright" }).addTo(map);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [route]);

  return <div ref={el} className="h-64 w-full overflow-hidden rounded-xl bg-surface-2" aria-label="Karta över rutten" />;
}
