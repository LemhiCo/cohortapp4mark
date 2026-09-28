"use client";

import { useSyncExternalStore } from "react";

// The server can't know the viewer's time zone, so it renders UTC. During
// hydration React uses that same value, then re-renders with the browser's
// zone. Keeping the server text (with suppressHydrationWarning) left every
// full page load showing UTC.
const subscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "UTC";

export function SessionTime({ startsAt }: { startsAt: string }) {
  const timeZone = useSyncExternalStore(subscribe, browserTimeZone, serverTimeZone);
  const label = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(startsAt));

  return <time dateTime={startsAt}>{label}</time>;
}
