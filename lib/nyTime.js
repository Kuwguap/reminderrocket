/**
 * Application timezone: all scheduled times and display labels use Eastern (New York).
 * Stored values remain ISO UTC strings; interpret user input in datetime-local as this zone.
 */
export const APP_TIME_ZONE = "America/New_York";

const nyDisplayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function pad2(n) {
  return String(n).padStart(2, "0");
}

function zonedCalendarKey(ms) {
  const parts = nyDisplayFormatter.formatToParts(new Date(ms));
  const o = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      o[p.type] = p.value;
    }
  }
  return `${o.year}-${pad2(o.month)}-${pad2(o.day)}T${pad2(o.hour)}:${pad2(o.minute)}:${pad2(o.second)}`;
}

/**
 * @param {string} local - value from <input type="datetime-local"> "YYYY-MM-DDTHH:mm"
 * @returns {Date | null}
 */
export function parseDatetimeLocalInAppZone(local) {
  if (!local || typeof local !== "string" || !local.includes("T")) {
    return null;
  }
  const [datePart, timePartRaw] = local.split("T");
  const timePart =
    timePartRaw?.length === 5 ? `${timePartRaw}:00` : timePartRaw ?? "";
  if (!datePart || !timePart) {
    return null;
  }
  const [y, mo, d] = datePart.split("-").map((n) => parseInt(n, 10));
  const [hStr, miStr, sPart] = timePart.split(":");
  const h = parseInt(hStr, 10);
  const mi = parseInt(miStr, 10);
  const s = parseInt(sPart ?? "0", 10);

  const targetKey = `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}:${pad2(s)}`;

  const anchor = Date.UTC(y, mo - 1, d, 12, 0, 0);
  for (let offsetMin = -36 * 60; offsetMin <= 36 * 60; offsetMin += 1) {
    const t = anchor + offsetMin * 60_000;
    if (zonedCalendarKey(t) === targetKey) {
      return new Date(t);
    }
  }
  return new Date(anchor);
}

export function formatDateTimeNy(value) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("en-US", {
    timeZone: APP_TIME_ZONE,
  });
}

/** Remaining ms until target; negative if past. */
export function msUntil(targetIso) {
  if (!targetIso) {
    return null;
  }
  const t = new Date(targetIso).getTime();
  if (Number.isNaN(t)) {
    return null;
  }
  return t - Date.now();
}

/**
 * Human-readable countdown (compact). Uses wall-clock delta, not calendar months.
 */
export function formatCountdown(ms) {
  if (ms === null || ms === undefined) {
    return null;
  }
  if (ms <= 0) {
    return "now";
  }
  const sec = Math.floor(ms / 1000);
  if (sec < 60) {
    return `${sec}s`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    const r = sec % 60;
    return r > 0 ? `${min}m ${r}s` : `${min}m`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 48) {
    const r = min % 60;
    return r > 0 ? `${hr}h ${r}m` : `${hr}h`;
  }
  const day = Math.floor(hr / 24);
  const rh = hr % 24;
  return rh > 0 ? `${day}d ${rh}h` : `${day}d`;
}
