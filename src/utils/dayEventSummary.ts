type CalendarPermission = "unknown" | "granted" | "denied" | "blocked";
type CalendarLoadState = "idle" | "loading" | "ready" | "error";

export function dayEventSummary(
  permission: CalendarPermission,
  state: CalendarLoadState,
  events: { title: string; timeLabel: string }[],
) {
  if (permission !== "granted") return "Connect your calendar to see events for this day";
  if (state === "error") return "Calendar events unavailable";
  if (state !== "ready") return "Loading events…";
  const next = events[0];
  return next ? `Next: ${next.timeLabel} — ${next.title}` : "No events for this day";
}
