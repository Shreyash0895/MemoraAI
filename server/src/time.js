/** The patient's local clock in their time zone: calendar day, minutes since midnight, and midnight as epoch ms. */
export function localClock(tz, nowMs = Date.now()) {
  const opts = { hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" };
  let fmt;
  try { fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...opts }); }
  catch { fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...opts }); }
  const p = Object.fromEntries(fmt.formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  const secs = Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second);
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Math.floor(secs / 60), dayStart: nowMs - secs * 1000 };
}
