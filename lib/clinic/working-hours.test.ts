import { describe, expect, it } from "vitest";
import { defaultWorkingHours, getClinicWorkingHours, parseWorkingHoursFromForm, WEEKDAYS } from "@/lib/clinic/working-hours";

describe("defaultWorkingHours", () => {
  it("returns one entry per weekday, closed on Sunday only", () => {
    const hours = defaultWorkingHours();
    expect(hours.map((d) => d.day)).toEqual(WEEKDAYS);
    expect(hours.find((d) => d.day === "sun")?.closed).toBe(true);
    expect(hours.filter((d) => d.closed)).toHaveLength(1);
  });
});

describe("getClinicWorkingHours", () => {
  it("falls back to defaults when settings has no workingHours", () => {
    expect(getClinicWorkingHours(null)).toEqual(defaultWorkingHours());
    expect(getClinicWorkingHours({})).toEqual(defaultWorkingHours());
  });

  it("falls back to defaults when workingHours is malformed", () => {
    expect(getClinicWorkingHours({ workingHours: "nonsense" })).toEqual(defaultWorkingHours());
  });

  it("uses stored values for valid days and defaults for missing/invalid ones", () => {
    const result = getClinicWorkingHours({
      workingHours: [
        { day: "mon", closed: false, openTime: "07:30", closeTime: "15:00" },
        { day: "tue", closed: true }, // missing openTime/closeTime -- whole entry is invalid, falls back to defaults
        { day: "not-a-day", closed: false, openTime: "00:00", closeTime: "01:00" },
      ],
    });

    expect(result.find((d) => d.day === "mon")).toEqual({ day: "mon", closed: false, openTime: "07:30", closeTime: "15:00" });
    expect(result.find((d) => d.day === "tue")).toEqual({ day: "tue", closed: false, openTime: "09:00", closeTime: "18:00" });
    expect(result).toHaveLength(7);
  });
});

describe("parseWorkingHoursFromForm", () => {
  it("reads closed checkboxes and valid HH:mm times", () => {
    const form = new FormData();
    form.set("workingHours.mon.closed", "on");
    form.set("workingHours.tue.open", "08:15");
    form.set("workingHours.tue.close", "16:45");

    const result = parseWorkingHoursFromForm(form);

    expect(result.find((d) => d.day === "mon")).toMatchObject({ closed: true });
    expect(result.find((d) => d.day === "tue")).toMatchObject({ closed: false, openTime: "08:15", closeTime: "16:45" });
  });

  it("falls back to default times for invalid input", () => {
    const form = new FormData();
    form.set("workingHours.wed.open", "not-a-time");
    form.set("workingHours.wed.close", "25:99");

    const result = parseWorkingHoursFromForm(form);

    expect(result.find((d) => d.day === "wed")).toMatchObject({ openTime: "09:00", closeTime: "18:00" });
  });
});
