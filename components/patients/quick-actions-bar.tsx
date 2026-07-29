"use client";

import { useState } from "react";
import { MessageCircle, Phone, Plus, Stethoscope, StickyNote } from "lucide-react";
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";

type PersonOption = { id: string; full_name: string };
type ServiceOption = { id: string; name: string; defaultDurationMinutes: number };

/**
 * A row of one-click entry points into actions this page already
 * supports elsewhere -- New appointment opens the same dialog used on
 * the appointments/calendar pages (prefilled to this patient), Add
 * note/Add treatment jump to their existing inline forms further down
 * the page rather than duplicating them, and Call/WhatsApp are plain
 * tel:/wa.me links gated on the patient actually having a phone number.
 */
export function QuickActionsBar({
  clinicId,
  patientId,
  phone,
  patients,
  dentists,
  services,
  t,
}: {
  clinicId: string;
  patientId: string;
  phone: string | null;
  patients: PersonOption[];
  dentists: PersonOption[];
  services: ServiceOption[];
  t: Dictionary;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const telHref = phone ? `tel:${phone}` : null;
  const whatsappHref = phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : null;

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label={t.patientDetail.quickActions.title}>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t.patientDetail.quickActions.newAppointment}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" nativeButton={false} render={<a href="#medical-notes" />}>
          <StickyNote className="size-4" aria-hidden="true" />
          {t.patientDetail.quickActions.addNote}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" nativeButton={false} render={<a href="#treatments" />}>
          <Stethoscope className="size-4" aria-hidden="true" />
          {t.patientDetail.quickActions.addTreatment}
        </Button>
        {telHref && (
          <Button variant="outline" size="sm" className="gap-1.5" nativeButton={false} render={<a href={telHref} />}>
            <Phone className="size-4" aria-hidden="true" />
            {t.patientDetail.quickActions.call}
          </Button>
        )}
        {whatsappHref && (
          <Button variant="outline" size="sm" className="gap-1.5" nativeButton={false} render={<a href={whatsappHref} target="_blank" rel="noreferrer" />}>
            <MessageCircle className="size-4" aria-hidden="true" />
            {t.patientDetail.quickActions.whatsapp}
          </Button>
        )}
      </div>

      <NewAppointmentDialog
        clinicId={clinicId}
        patients={patients}
        dentists={dentists}
        services={services}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        hideTrigger
        defaultPatientId={patientId}
      />
    </>
  );
}
