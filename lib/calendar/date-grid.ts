/**
 * Pure date/time grid math for the calendar's day/week/month views --
 * no I/O, no React. Every function operates on plain `Date` objects in
 * local time (the browser's, matching how a member of staff reads a
 * wall clock) and is trivially unit-testable.
 */

/** Visible time-of-day range for day/week views -- appointments outside this window still exist and are reachable by scrolling, this just sets the grid's default viewport. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 20;
export const PX_PER_HOUR = 64;
export const PX_PER_MINUTE = PX_PER_HOUR / 60;
export const SNAP_MINUTES = 5;
export const MIN_APPOINTMENT_MINUTES = 5;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** ISO-style Monday-start week. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const dayIndex = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  return addDays(d, -dayIndex);
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Always 42 cells (6 weeks x 7 days) so the month grid's height never jumps between months. */
export function getMonthGrid(date: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** "YYYY-MM-DDTHH:mm" in local time, no timezone suffix -- the exact format `<input type="datetime-local">` reads and writes. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Minutes elapsed since DAY_START_HOUR:00 on `date`'s own day -- the day/week grid's y-axis unit. Can be negative or exceed the visible window; callers clamp for layout, not this function. */
export function minutesFromGridStart(date: Date): number {
  return (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes();
}

export function minutesToPx(minutes: number): number {
  return minutes * PX_PER_MINUTE;
}

export function pxToMinutes(px: number): number {
  return px / PX_PER_MINUTE;
}

export function snapMinutes(minutes: number, snapTo: number = SNAP_MINUTES): number {
  return Math.round(minutes / snapTo) * snapTo;
}

export function gridHeightPx(): number {
  return (DAY_END_HOUR - DAY_START_HOUR) * PX_PER_HOUR;
}

/** Hour marks for the grid's left/end time gutter, e.g. [7, 8, ..., 20]. */
export function gridHourMarks(): number[] {
  return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
}

/** Applies a delta in minutes to both endpoints of a [start, end] pair, preserving duration -- the core of a drag-to-reschedule move. */
export function shiftRange(start: Date, end: Date, deltaMinutes: number): { start: Date; end: Date } {
  return {
    start: new Date(start.getTime() + deltaMinutes * 60_000),
    end: new Date(end.getTime() + deltaMinutes * 60_000),
  };
}

/** Applies a delta in minutes to only the end of a range (resize), enforcing a minimum duration. */
export function resizeRangeEnd(start: Date, end: Date, deltaMinutes: number): { start: Date; end: Date } {
  const proposedEnd = new Date(end.getTime() + deltaMinutes * 60_000);
  const minEnd = new Date(start.getTime() + MIN_APPOINTMENT_MINUTES * 60_000);
  return { start, end: proposedEnd < minEnd ? minEnd : proposedEnd };
}
