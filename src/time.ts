export interface LocalParts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  sec: number;
}

export function parseLocalTimestamp(value: string): LocalParts | null {
  const m = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], sec: +m[6] };
}

function partsInZone(now: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) p[part.type] = part.value;
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  return { y: +p.year, mo: +p.month, d: +p.day, h: hour, mi: +p.minute, sec: +p.second };
}

function toComparableMs(p: LocalParts): number {
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.sec);
}

export function elapsedSeconds(since: string, timeZone: string, now: Date = new Date()): number | null {
  const from = parseLocalTimestamp(since);
  if (!from) return null;
  const current = partsInZone(now, timeZone);
  const diff = Math.round((toComparableMs(current) - toComparableMs(from)) / 1000);
  return diff < 0 ? 0 : diff;
}

export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const out: string[] = [];
  if (days) out.push(`${days}d`);
  if (days || hours) out.push(`${hours}h`);
  out.push(`${minutes}m`);
  return out.join(" ");
}

export function formatClock(parts: LocalParts): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parts.h)}:${pad(parts.mi)}`;
}
