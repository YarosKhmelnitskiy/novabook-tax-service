const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:(Z)|([+-])(\d{2}):(\d{2}))$/;
const SPACE_INSTEAD_OF_PLUS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})? \d{2}:\d{2}$/;

const MINUTE_MS = 60_000;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function parseIsoInstant(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }
  const match = ISO_INSTANT.exec(value);
  if (match === null) {
    return null;
  }

  const [, year, month, day, hour, minute, second, fraction = '', zulu, sign, offsetHour, offsetMinute] = match;
  const [y, mo, d, h, mi, s] = [year, month, day, hour, minute, second].map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59 || s > 59) {
    return null;
  }

  let offsetMinutes = 0;
  if (zulu === undefined) {
    const offsetH = Number(offsetHour);
    const offsetM = Number(offsetMinute);
    if (offsetH > 23 || offsetM > 59) {
      return null;
    }
    offsetMinutes = (sign === '-' ? -1 : 1) * (offsetH * 60 + offsetM);
  }

  const milliseconds = Number(fraction.padEnd(3, '0').slice(0, 3));
  const instant = new Date(Date.UTC(2000, mo - 1, d, h, mi, s, milliseconds));
  instant.setUTCFullYear(y);
  return new Date(instant.getTime() - offsetMinutes * MINUTE_MS);
}

export function looksLikeUnencodedPlus(value: unknown): boolean {
  return typeof value === 'string' && SPACE_INSTEAD_OF_PLUS.test(value);
}

function daysInMonth(year: number, month: number): number {
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return month === 2 && isLeapYear ? 29 : DAYS_IN_MONTH[month - 1];
}
