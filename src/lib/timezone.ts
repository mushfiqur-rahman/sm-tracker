import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";

/** "2026-12-24T09:30" interpreted in `tz` → UTC Date */
export function localInputToUtc(local: string, tz: string): Date {
  const d = fromZonedTime(local, tz);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date/time");
  return d;
}

/** UTC Date → "2026-12-24T09:30" in `tz` (for <input type="datetime-local">) */
export function utcToLocalInput(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd'T'HH:mm");
}

export function formatInTz(date: Date, tz: string, pattern = "EEE, d MMM yyyy · HH:mm"): string {
  return formatInTimeZone(date, tz, pattern);
}

export function zoned(date: Date, tz: string): Date {
  return toZonedTime(date, tz);
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function allTimezones(): string[] {
  const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  const list = fn ? fn("timeZone") : ["UTC"];
  return list.includes("UTC") ? list : ["UTC", ...list];
}
