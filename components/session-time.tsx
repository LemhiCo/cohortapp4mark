"use client";

export function SessionTime({ startsAt }: { startsAt: string }) {
  const date = new Date(startsAt);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const label = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
    timeZoneName: "short",
    year: "numeric",
  }).format(date);

  return (
    <time dateTime={startsAt} suppressHydrationWarning>
      {label}
    </time>
  );
}
