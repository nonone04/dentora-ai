"use client";

import { ChevronLeft, ChevronRight, Filter, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dentistColor } from "@/lib/calendar/colors";
import type { CalendarAppointmentStatus, CalendarDentist, CalendarView } from "@/lib/calendar/types";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: CalendarAppointmentStatus[] = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];

export function CalendarToolbar({
  view,
  onViewChange,
  rangeLabel,
  onPrev,
  onNext,
  onToday,
  search,
  onSearchChange,
  dentists,
  selectedDentistIds,
  onToggleDentist,
  selectedStatuses,
  onToggleStatus,
  onClearFilters,
  onNewAppointment,
  t,
}: {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  dentists: CalendarDentist[];
  selectedDentistIds: string[];
  onToggleDentist: (id: string) => void;
  selectedStatuses: CalendarAppointmentStatus[];
  onToggleStatus: (status: CalendarAppointmentStatus) => void;
  onClearFilters: () => void;
  onNewAppointment: () => void;
  t: Dictionary;
}) {
  const activeFilterCount = selectedDentistIds.length + selectedStatuses.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t.calendar.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.calendar.description}</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onNewAppointment}>
          <Plus className="size-4" aria-hidden="true" />
          {t.calendar.newAppointment}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToday}>
            {t.calendar.today}
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon-sm" aria-label={t.calendar.today} onClick={onPrev}>
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onNext}>
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
          <span className="text-sm font-medium tabular-nums">{rangeLabel}</span>
        </div>

        <Tabs value={view} onValueChange={(value) => onViewChange(value as CalendarView)}>
          <TabsList>
            <TabsTrigger value="day">{t.calendar.views.day}</TabsTrigger>
            <TabsTrigger value="week">{t.calendar.views.week}</TabsTrigger>
            <TabsTrigger value="month">{t.calendar.views.month}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t.calendar.searchPlaceholder}
            className="ps-8"
            aria-label={t.calendar.searchPlaceholder}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <Filter className="size-4" aria-hidden="true" />
            {t.calendar.filters.label}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ms-0.5 h-4 min-w-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t.calendar.filters.dentist}</DropdownMenuLabel>
              {dentists.map((dentist) => (
                <DropdownMenuCheckboxItem
                  key={dentist.id}
                  checked={selectedDentistIds.includes(dentist.id)}
                  onCheckedChange={() => onToggleDentist(dentist.id)}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dentistColor(dentist.id, dentist.color) }}
                  />
                  {dentist.fullName}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t.calendar.filters.status}</DropdownMenuLabel>
              {STATUS_OPTIONS.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={selectedStatuses.includes(status)}
                  onCheckedChange={() => onToggleStatus(status)}
                >
                  {t.appointmentStatus[status]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={onClearFilters}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <X className="size-3.5" aria-hidden="true" />
                  {t.calendar.filters.clear}
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
