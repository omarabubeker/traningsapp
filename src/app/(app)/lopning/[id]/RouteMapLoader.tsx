"use client";
import dynamic from "next/dynamic";

// Leaflet behöver window, så kartan laddas bara i webbläsaren.
const RouteMap = dynamic(() => import("./RouteMap"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-surface-2" />,
});

export function RouteMapLoader({ route }: { route: [number, number][] }) {
  return <RouteMap route={route} />;
}
