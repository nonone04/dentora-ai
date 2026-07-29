/**
 * Pure text-matching helpers -- NLU only ever gives the engine raw text
 * ("cleaning", "Dr. Amrani"), never a database id, so these resolve a
 * patient's words against the clinic's actual services/dentists. Kept
 * separate from the I/O (lib/ai/availability/resolve.ts) so the matching
 * rule itself is trivially unit-testable.
 */

export type ServiceCandidate = { id: string; nameTranslations: Record<string, string> | null };
export type DentistCandidate = { id: string; fullName: string };

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/** Case-insensitive substring match against any translation of the service's name. First match wins -- good enough for a clinic's small, curated service list. */
export function findServiceMatch(services: ServiceCandidate[], serviceText: string | null | undefined): string | null {
  if (!serviceText) return null;
  const needle = normalize(serviceText);
  if (!needle) return null;

  const match = services.find((service) => {
    if (!service.nameTranslations) return false;
    return Object.values(service.nameTranslations).some(
      (name) => typeof name === "string" && normalize(name).includes(needle),
    );
  });

  return match?.id ?? null;
}

/** Strips a leading "Dr."/"Docteur" (NLU's own dentist-entity format -- see lib/ai/nlu/rule-based-client.ts's extractDentist) before matching, so "Dr. Amrani" matches a dentist named "Amrani Youssef". */
export function findDentistMatch(dentists: DentistCandidate[], dentistText: string | null | undefined): string | null {
  if (!dentistText) return null;
  const needle = normalize(dentistText.replace(/^(dr\.?|docteur)\s+/i, ""));
  if (!needle) return null;

  const match = dentists.find((dentist) => normalize(dentist.fullName).includes(needle));
  return match?.id ?? null;
}
