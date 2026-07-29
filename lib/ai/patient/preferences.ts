import type { NotificationChannel } from "@/lib/notifications/provider";
import type { CommunicationPreferences, SchedulingPreferences, TimeOfDayPreference } from "@/lib/ai/patient/types";

/** Plurality vote -- the most frequent value, or null when there's nothing to vote on. Ties resolve to whichever value was encountered first, so the result is deterministic given a stable input order (callers pass data ordered oldest-first). */
function mostCommon<T>(items: T[]): T | null {
  if (items.length === 0) return null;

  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);

  let best: T | null = null;
  let bestCount = 0;
  for (const item of items) {
    const count = counts.get(item)!;
    if (count > bestCount) {
      best = item;
      bestCount = count;
    }
  }
  return best;
}

/**
 * ai_conversations.channel ("whatsapp"/"web_chat"/"sms") only partially
 * overlaps with NotificationChannel ("email"/"sms"/"whatsapp") --
 * "web_chat" isn't a channel a reminder could ever be sent on, so a
 * conversation on it is excluded from this vote entirely rather than
 * mismapped to something it isn't.
 */
function toNotificationChannel(conversationChannel: string): NotificationChannel | null {
  return conversationChannel === "whatsapp" || conversationChannel === "sms" ? conversationChannel : null;
}

/**
 * Learned from which channel the patient's past conversations actually
 * happened on (ai_conversations.channel) -- not from a single stored
 * setting, so it reflects real behavior and can shift over time as a
 * patient's habits change. Pure.
 */
export function learnCommunicationPreferences(conversationChannels: string[]): CommunicationPreferences {
  const relevantChannels = conversationChannels
    .map(toNotificationChannel)
    .filter((channel): channel is NotificationChannel => channel !== null);

  return {
    preferredChannel: mostCommon(relevantChannels),
    sampleSize: relevantChannels.length,
  };
}

function timeOfDayFor(startAt: string): TimeOfDayPreference {
  const hour = new Date(startAt).getUTCHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * Learned from the patient's *completed* appointments only -- a
 * cancelled or no-show appointment doesn't tell you what time actually
 * works for them, or which dentist they actually got along with. Pure.
 */
export function learnSchedulingPreferences(
  completedAppointments: { dentistId: string; startAt: string }[],
): SchedulingPreferences {
  return {
    preferredTimeOfDay: mostCommon(completedAppointments.map((appointment) => timeOfDayFor(appointment.startAt))),
    preferredDentistId: mostCommon(completedAppointments.map((appointment) => appointment.dentistId)),
    sampleSize: completedAppointments.length,
  };
}
