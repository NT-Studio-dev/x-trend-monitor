import { toZonedTime } from "date-fns-tz";

const TZ = "Asia/Tokyo";

export function splitDayHourly(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const startJST = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMs = getJSTOffsetMs(startJST);
  const startUTC = new Date(startJST.getTime() - offsetMs);

  const windows = [];
  for (let h = 0; h < 24; h++) {
    const since = new Date(startUTC.getTime() + h * 3600 * 1000);
    const until = new Date(startUTC.getTime() + (h + 1) * 3600 * 1000);
    windows.push({
      since: Math.floor(since.getTime() / 1000),
      until: Math.floor(until.getTime() / 1000),
      label: `${dateStr} ${String(h).padStart(2, "0")}:00-${String(h + 1).padStart(2, "0")}:00 JST`,
    });
  }
  return windows;
}

export function subdivideWindow(window) {
  const midpoint = Math.floor((window.since + window.until) / 2);
  const duration = window.until - window.since;

  if (duration <= 300) {
    return null;
  }

  return [
    { since: window.since, until: midpoint, label: `${window.label} [1/2]` },
    { since: midpoint, until: window.until, label: `${window.label} [2/2]` },
  ];
}

function getJSTOffsetMs() {
  return 9 * 60 * 60 * 1000;
}
