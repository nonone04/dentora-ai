import type { SupabaseClient } from "@supabase/supabase-js";
import { recordLifecycleEvent } from "@/lib/ai/appointments/audit";
import { deriveAppointmentStatus, deriveDraftStatus, type CoarseAppointmentStatus, type CoarseDraftStatus } from "@/lib/ai/appointments/derive";
import { transition } from "@/lib/ai/appointments/machine";
import type { LifecycleActor, LifecycleEventType, LifecycleStatus } from "@/lib/ai/appointments/types";
import { mapLifecycleEventToActivityType, recordPatientActivity, refreshPatientProfile } from "@/lib/ai/patient";
import { notifyAppointmentCancelled, notifyAppointmentCompleted, notifyAppointmentConfirmed, notifyAppointmentRescheduled } from "@/lib/notifications";

export type TransitionOutcome =
  | { ok: true; fromStatus: LifecycleStatus; toStatus: LifecycleStatus }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_transition"; message: string }
  | { ok: false; reason: "conflict" };

type TransitionParams = {
  clinicId: string;
  event: LifecycleEventType;
  actor: LifecycleActor;
  actorId?: string | null;
  conversationId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

// Bounded retries on a lost optimistic-concurrency race -- reload the
// fresh row and re-validate once before giving up. Same posture as
// lib/ai/state/store.ts: never block the caller indefinitely on a race.
const MAX_ATTEMPTS = 2;

const APPOINTMENT_DB_STATUS_BY_EVENT: Partial<Record<LifecycleEventType, CoarseAppointmentStatus>> = {
  confirm: "confirmed",
  cancel: "cancelled",
  complete: "completed",
  mark_no_show: "no_show",
};

const DRAFT_DB_STATUS_BY_EVENT: Partial<Record<LifecycleEventType, CoarseDraftStatus>> = {
  approve: "confirmed",
  reject: "rejected",
  expire: "expired",
};

/**
 * Feeds a successful lifecycle transition into the Patient Intelligence
 * Engine (lib/ai/patient) -- records the timeline entry and recomputes
 * the patient's profile (reliability score, learned preferences,
 * summary). A pure no-op when there's no patientId to work with (a
 * draft's patient isn't resolved until staff approval, so this is
 * routinely skipped for drafts) or no matching activity type. Always
 * best-effort: never allowed to affect the transition's own outcome,
 * which has already succeeded by the time this runs.
 */
async function applyPatientIntelligenceHook(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    patientId: string | null | undefined;
    event: LifecycleEventType;
    appointmentId?: string | null;
    conversationId?: string | null;
  },
): Promise<void> {
  if (!params.patientId) return;

  const activityType = mapLifecycleEventToActivityType(params.event);
  if (!activityType) return;

  try {
    await recordPatientActivity(supabase, {
      clinicId: params.clinicId,
      patientId: params.patientId,
      type: activityType,
      appointmentId: params.appointmentId ?? null,
      conversationId: params.conversationId ?? null,
    });
    await refreshPatientProfile(supabase, { clinicId: params.clinicId, patientId: params.patientId });
  } catch (err) {
    console.error("[ai:appointments] patient intelligence hook failed", err instanceof Error ? err.message : err);
  }
}

/**
 * Feeds a successful lifecycle transition into the Notification &
 * Communication Platform (lib/notifications) -- confirm/cancel/
 * reschedule/complete each generate a patient-facing notification event
 * rather than the caller sending a message directly. Only fires for
 * events the new pipeline has a template for; a no-op for anything else
 * (check_in, start, mark_no_show, send_reminder, archive -- none of
 * which are currently patient-facing communications). Always
 * best-effort, exactly like applyPatientIntelligenceHook above: never
 * allowed to affect a transition that has already succeeded.
 */
async function applyNotificationHook(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    patientId: string | null | undefined;
    event: LifecycleEventType;
    appointmentId: string;
    conversationId?: string | null;
    reason?: string | null;
  },
): Promise<void> {
  try {
    if (params.event === "confirm") {
      await notifyAppointmentConfirmed(supabase, {
        clinicId: params.clinicId,
        appointmentId: params.appointmentId,
        patientId: params.patientId,
        conversationId: params.conversationId,
      });
    } else if (params.event === "cancel") {
      await notifyAppointmentCancelled(supabase, {
        clinicId: params.clinicId,
        appointmentId: params.appointmentId,
        patientId: params.patientId,
        conversationId: params.conversationId,
        reason: params.reason,
      });
    } else if (params.event === "reschedule") {
      await notifyAppointmentRescheduled(supabase, {
        clinicId: params.clinicId,
        appointmentId: params.appointmentId,
        patientId: params.patientId,
        conversationId: params.conversationId,
      });
    } else if (params.event === "complete") {
      await notifyAppointmentCompleted(supabase, {
        clinicId: params.clinicId,
        appointmentId: params.appointmentId,
        patientId: params.patientId,
        conversationId: params.conversationId,
      });
    }
  } catch (err) {
    console.error("[ai:appointments] notification hook failed", err instanceof Error ? err.message : err);
  }
}

/**
 * Transitions a real appointments row through the lifecycle engine.
 * Validates the event against the current (derived) status via
 * lib/ai/appointments/machine.ts before writing anything. Events that
 * map to a real appointments.status value (confirm/cancel/complete/
 * mark_no_show) -- and reschedule, which writes start_at/end_at -- get
 * genuine optimistic-concurrency protection via a compare-and-swap on
 * the coarse status column (the same `.eq("status", ...)` pattern
 * app/actions/appointment-drafts.ts already uses). Events with no
 * matching column (check_in/start/send_reminder) are re-validated
 * against a freshly-re-derived status immediately before the audit
 * write as a lighter-weight guard -- this module doesn't claim
 * distributed-lock-grade protection for those, since losing that race
 * (e.g. two staff clicking "check in" moments apart) has no data-
 * integrity consequence, unlike a double-booked cancellation.
 */
export async function transitionAppointment(
  supabase: SupabaseClient,
  params: TransitionParams & {
    appointmentId: string;
    /** Only used for the reschedule event. */
    newStartAt?: string;
    newEndAt?: string;
  },
): Promise<TransitionOutcome> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select("status, patient_id")
      .eq("id", params.appointmentId)
      .eq("clinic_id", params.clinicId)
      .maybeSingle();

    if (error || !appointment) return { ok: false, reason: "not_found" };

    const { data: latestEventRow } = await supabase
      .from("appointment_lifecycle_events")
      .select("to_status")
      .eq("appointment_id", params.appointmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const coarseStatus = appointment.status as CoarseAppointmentStatus;
    const currentStatus = deriveAppointmentStatus(coarseStatus, (latestEventRow?.to_status as LifecycleStatus | undefined) ?? null);

    const result = transition(currentStatus, params.event);
    if (!result.ok) return { ok: false, reason: "invalid_transition", message: result.message };

    const dbStatus = APPOINTMENT_DB_STATUS_BY_EVENT[params.event];
    const isReschedule = params.event === "reschedule";

    if (dbStatus || isReschedule) {
      const updatePayload: Record<string, unknown> = {};
      if (dbStatus) updatePayload.status = dbStatus;
      if (isReschedule && params.newStartAt && params.newEndAt) {
        updatePayload.start_at = params.newStartAt;
        updatePayload.end_at = params.newEndAt;
      }

      const { data: updated, error: updateError } = await supabase
        .from("appointments")
        .update(updatePayload)
        .eq("id", params.appointmentId)
        .eq("status", coarseStatus) // CAS: someone else may have changed the coarse status since we read it
        .select("id")
        .maybeSingle();

      if (updateError) {
        // e.g. the DB-level overlap exclusion constraint rejecting a reschedule into an already-taken slot.
        return { ok: false, reason: "invalid_transition", message: updateError.message };
      }
      if (!updated) {
        if (attempt < MAX_ATTEMPTS) continue;
        return { ok: false, reason: "conflict" };
      }
    }

    // Skipping any already-scheduled-but-not-yet-sent reminder for a cancelled
    // appointment happens below, via applyNotificationHook -> notifyAppointmentCancelled
    // -> createNotificationEvent's skipPendingDeliveriesForAppointment (against
    // notification_deliveries, the one pipeline every booking path now writes through).

    await recordLifecycleEvent(supabase, {
      clinicId: params.clinicId,
      entityType: "appointment",
      appointmentId: params.appointmentId,
      event: params.event,
      fromStatus: currentStatus,
      toStatus: result.toStatus,
      actor: params.actor,
      actorId: params.actorId ?? null,
      conversationId: params.conversationId ?? null,
      reason: params.reason ?? null,
      metadata: params.metadata ?? {},
    });

    await applyPatientIntelligenceHook(supabase, {
      clinicId: params.clinicId,
      patientId: appointment.patient_id as string | null | undefined,
      event: params.event,
      appointmentId: params.appointmentId,
      conversationId: params.conversationId ?? null,
    });

    await applyNotificationHook(supabase, {
      clinicId: params.clinicId,
      patientId: appointment.patient_id as string | null | undefined,
      event: params.event,
      appointmentId: params.appointmentId,
      conversationId: params.conversationId ?? null,
      reason: params.reason ?? null,
    });

    return { ok: true, fromStatus: currentStatus, toStatus: result.toStatus };
  }

  return { ok: false, reason: "conflict" };
}

/**
 * Transitions an appointment_drafts row. Mirrors transitionAppointment's
 * shape exactly, against appointment_draft_status instead. Deliberately
 * does NOT create the real appointments row that staff approval
 * produces -- that conversion (patient resolution, the real INSERT,
 * notification scheduling) stays app/actions/appointment-drafts.ts's
 * job, unchanged; this is the lower-level, audited primitive it could
 * build on, and what lib/ai/tools/draft-appointment.ts hooks into for
 * the initial create_draft event.
 */
export async function transitionDraft(
  supabase: SupabaseClient,
  params: TransitionParams & { draftId: string },
): Promise<TransitionOutcome> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const { data: draft, error } = await supabase
      .from("appointment_drafts")
      .select("status, patient_id")
      .eq("id", params.draftId)
      .eq("clinic_id", params.clinicId)
      .maybeSingle();

    if (error || !draft) return { ok: false, reason: "not_found" };

    const { data: latestEventRow } = await supabase
      .from("appointment_lifecycle_events")
      .select("to_status")
      .eq("appointment_draft_id", params.draftId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const coarseStatus = draft.status as CoarseDraftStatus;
    const currentStatus = deriveDraftStatus(coarseStatus, (latestEventRow?.to_status as LifecycleStatus | undefined) ?? null);

    const result = transition(currentStatus, params.event);
    if (!result.ok) return { ok: false, reason: "invalid_transition", message: result.message };

    const dbStatus = DRAFT_DB_STATUS_BY_EVENT[params.event];
    if (dbStatus) {
      const { data: updated, error: updateError } = await supabase
        .from("appointment_drafts")
        .update({ status: dbStatus })
        .eq("id", params.draftId)
        .eq("status", coarseStatus)
        .select("id")
        .maybeSingle();

      if (updateError) return { ok: false, reason: "invalid_transition", message: updateError.message };
      if (!updated) {
        if (attempt < MAX_ATTEMPTS) continue;
        return { ok: false, reason: "conflict" };
      }
    }

    await recordLifecycleEvent(supabase, {
      clinicId: params.clinicId,
      entityType: "draft",
      appointmentDraftId: params.draftId,
      event: params.event,
      fromStatus: currentStatus,
      toStatus: result.toStatus,
      actor: params.actor,
      actorId: params.actorId ?? null,
      conversationId: params.conversationId ?? null,
      reason: params.reason ?? null,
      metadata: params.metadata ?? {},
    });

    await applyPatientIntelligenceHook(supabase, {
      clinicId: params.clinicId,
      patientId: draft.patient_id as string | null | undefined,
      event: params.event,
      conversationId: params.conversationId ?? null,
    });

    return { ok: true, fromStatus: currentStatus, toStatus: result.toStatus };
  }

  return { ok: false, reason: "conflict" };
}

/**
 * Logs the initial create_draft event for a brand-new appointment_drafts
 * row -- there's no prior status to validate against (transition(null,
 * "create_draft") always succeeds), so this is a thin, always-safe
 * convenience wrapper rather than going through the full CAS machinery
 * above.
 */
export async function recordDraftCreated(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    appointmentDraftId: string;
    actor: LifecycleActor;
    actorId?: string | null;
    conversationId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const result = transition(null, "create_draft");
  if (!result.ok) return; // unreachable -- create_draft from null is always valid

  await recordLifecycleEvent(supabase, {
    clinicId: params.clinicId,
    entityType: "draft",
    appointmentDraftId: params.appointmentDraftId,
    event: "create_draft",
    fromStatus: null,
    toStatus: result.toStatus,
    actor: params.actor,
    actorId: params.actorId ?? null,
    conversationId: params.conversationId ?? null,
    metadata: params.metadata ?? {},
  });
}
