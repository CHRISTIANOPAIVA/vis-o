// Postgres can serialize `created_at` either as a `timestamptz`
// ("2026-10-05T13:00:00.123+00:00" / "...Z") or as a timezone-less
// `timestamp` ("2026-10-05T13:00:00", stored in UTC but with no
// designator). `new Date()` treats a string with no timezone info as
// LOCAL time, so we only append "Z" when the string doesn't already
// carry zone info. We must check just the time portion (after "T")
// for a "+"/"-"/"Z", since the date portion's hyphens
// (e.g. "2026-10-05") are not an offset.
export function parseTimestamp(iso: string): Date {
  const tIndex = iso.indexOf("T");
  const timePart = tIndex === -1 ? iso : iso.slice(tIndex + 1);
  const hasTimezone = /[zZ+-]/.test(timePart);
  return new Date(hasTimezone ? iso : iso + "Z");
}
