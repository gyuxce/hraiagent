/**
 * Calendar helpers — pure functions, safe for client & server.
 * Generates .ics content and one-click "Add to calendar" URLs
 * (Google Calendar / Outlook web) without OAuth.
 */

export type CalendarEventInput = {
  id: string;
  title: string;
  startAt: Date;
  durationMinutes: number;
  location?: string | null;
  meetingUrl?: string | null;
  /** Multi-line description; lines joined appropriately per format. */
  descriptionLines?: string[];
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 20260727T100000Z */
function toIcsStamp(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** 20260727T100000Z / 20260727T110000Z (Google format) */
function toGoogleDates(start: Date, end: Date): string {
  return `${toIcsStamp(start)}/${toIcsStamp(end)}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function eventEnd(input: CalendarEventInput): Date {
  return new Date(
    input.startAt.getTime() + (input.durationMinutes || 60) * 60_000
  );
}

export function buildIcs(input: CalendarEventInput): string {
  const end = eventEnd(input);
  const description = (input.descriptionLines || []).filter(Boolean).join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cullr//Schedule//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${input.id}@cullr.app`,
    `DTSTAMP:${toIcsStamp(new Date())}`,
    `DTSTART:${toIcsStamp(input.startAt)}`,
    `DTEND:${toIcsStamp(end)}`,
    `SUMMARY:${escapeIcsText(input.title.replace(/\r?\n/g, " "))}`,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : "",
    input.location ? `LOCATION:${escapeIcsText(input.location)}` : "",
    input.meetingUrl ? `URL:${input.meetingUrl}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.filter(Boolean).join("\r\n");
}

export function googleCalendarUrl(input: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: toGoogleDates(input.startAt, eventEnd(input)),
    details: (input.descriptionLines || []).filter(Boolean).join("\n"),
  });
  const location = input.meetingUrl || input.location;
  if (location) params.set("location", location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(input: CalendarEventInput): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: input.title,
    startdt: input.startAt.toISOString(),
    enddt: eventEnd(input).toISOString(),
    body: (input.descriptionLines || []).filter(Boolean).join("\n"),
  });
  const location = input.meetingUrl || input.location;
  if (location) params.set("location", location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
