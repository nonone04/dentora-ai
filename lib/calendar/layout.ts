import { DAY_END_HOUR, DAY_START_HOUR, gridHeightPx, minutesFromGridStart, minutesToPx } from "@/lib/calendar/date-grid";
import type { CalendarAppointment } from "@/lib/calendar/types";

export type LayoutInput = { id: string; startMinutes: number; endMinutes: number };
export type LayoutSlot = { id: string; column: number; columnCount: number };

/**
 * Classic calendar overlap layout: appointments that overlap in time
 * get placed in side-by-side columns instead of stacking on top of each
 * other. Two passes -- first group events into clusters of transitively
 * overlapping events (so two appointments 3 hours apart never affect
 * each other's width), then within each cluster greedily assign the
 * first free column (reusing a column once its previous occupant has
 * ended). Every event in a cluster gets that cluster's total column
 * count, so they render as equal-width side-by-side cards. Pure --
 * operates on minute offsets, not Dates, so it's trivial to test and
 * reusable for both the day and week grids.
 */
export function computeOverlapLayout(events: LayoutInput[]): LayoutSlot[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const clusters: { items: LayoutInput[]; end: number }[] = [];
  for (const event of sorted) {
    const current = clusters[clusters.length - 1];
    if (current && event.startMinutes < current.end) {
      current.items.push(event);
      current.end = Math.max(current.end, event.endMinutes);
    } else {
      clusters.push({ items: [event], end: event.endMinutes });
    }
  }

  const results: LayoutSlot[] = [];
  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    const assignment = new Map<string, number>();

    for (const event of cluster.items) {
      let placedColumn = -1;
      for (let col = 0; col < columnEnds.length; col++) {
        if (event.startMinutes >= columnEnds[col]) {
          columnEnds[col] = event.endMinutes;
          placedColumn = col;
          break;
        }
      }
      if (placedColumn === -1) {
        columnEnds.push(event.endMinutes);
        placedColumn = columnEnds.length - 1;
      }
      assignment.set(event.id, placedColumn);
    }

    const columnCount = columnEnds.length;
    for (const event of cluster.items) {
      results.push({ id: event.id, column: assignment.get(event.id)!, columnCount });
    }
  }

  return results;
}

export type PositionedAppointment = {
  appointment: CalendarAppointment;
  topPx: number;
  heightPx: number;
  column: number;
  columnCount: number;
};

/**
 * One day's worth of appointments, positioned for the time grid:
 * vertical offset/height from their start/end time, plus the
 * side-by-side column each occupies. Appointments starting before
 * DAY_START_HOUR or ending after DAY_END_HOUR are clamped into the
 * visible grid rather than clipped out -- staff should never lose track
 * of an early/late booking just because it's outside the default
 * viewport.
 */
export function layoutDay(appointments: CalendarAppointment[]): PositionedAppointment[] {
  const gridMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;

  const withMinutes = appointments.map((appt) => {
    const start = new Date(appt.startAt);
    const end = new Date(appt.endAt);
    const startMinutes = Math.max(0, minutesFromGridStart(start));
    const endMinutes = Math.min(gridMinutes, minutesFromGridStart(end));
    return { appt, startMinutes, endMinutes: Math.max(endMinutes, startMinutes + 5) };
  });

  const slots = computeOverlapLayout(withMinutes.map((w) => ({ id: w.appt.id, startMinutes: w.startMinutes, endMinutes: w.endMinutes })));
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const maxHeight = gridHeightPx();

  return withMinutes.map(({ appt, startMinutes, endMinutes }) => {
    const slot = slotById.get(appt.id)!;
    const topPx = Math.min(minutesToPx(startMinutes), maxHeight);
    const heightPx = Math.max(minutesToPx(endMinutes - startMinutes), 18);
    return { appointment: appt, topPx, heightPx, column: slot.column, columnCount: slot.columnCount };
  });
}
