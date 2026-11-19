import { dayEventSummary } from "./dayEventSummary";

const event = { title: "Dinner", timeLabel: "6:00 PM" };

describe("calendar context summary", () => {
  it.each(["unknown", "denied", "blocked"] as const)("does not claim an empty day without calendar access (%s)", (permission) => {
    expect(dayEventSummary(permission, "idle", [])).toBe("Connect your calendar to see events for this day");
  });
  it("distinguishes loading, errors, and a genuinely empty day", () => {
    expect(dayEventSummary("granted", "loading", [event])).toBe("Loading events…");
    expect(dayEventSummary("granted", "error", [event])).toBe("Calendar events unavailable");
    expect(dayEventSummary("granted", "ready", [])).toBe("No events for this day");
    expect(dayEventSummary("granted", "ready", [event])).toBe("Next: 6:00 PM — Dinner");
  });
});
