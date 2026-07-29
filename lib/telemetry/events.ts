import type { ClinicRole } from "@/lib/supabase/clinic";
import type { Locale } from "@/lib/i18n/types";

/**
 * Every property bag below is deliberately restricted to ids, enums,
 * counts, and booleans -- never free text. That is what keeps
 * lib/telemetry/privacy.ts's sanitizeProperties() a defense-in-depth
 * backstop rather than the only thing standing between this file and a
 * leaked medical record. See docs/product-analytics.md.
 */

type Base = {
  clinicId?: string | null;
  userId?: string | null;
};

export type AnalyticsEvent =
  // Authentication
  | (Base & { name: "User Registered"; properties?: Record<string, never> })
  | (Base & { name: "Email Verified"; properties?: Record<string, never> })
  | (Base & { name: "Login"; properties?: Record<string, never> })
  | (Base & { name: "Logout"; properties?: Record<string, never> })
  | (Base & { name: "Password Reset"; properties: { stage: "requested" | "completed" } })
  // Onboarding
  | (Base & { name: "Clinic Created"; properties?: Record<string, never> })
  | (Base & { name: "Staff Invited"; properties: { role: ClinicRole } })
  | (Base & { name: "Demo Started"; properties?: Record<string, never> })
  | (Base & { name: "Demo Reset"; properties?: Record<string, never> })
  | (Base & { name: "CSV Import Started"; properties: { subject: "patients" | "dentists" | "services" } })
  | (Base & {
      name: "CSV Import Completed";
      properties: { subject: "patients" | "dentists" | "services"; imported: number; skipped: number };
    })
  | (Base & { name: "WhatsApp Connected"; properties?: Record<string, never> })
  // Patients
  | (Base & { name: "Patient Created"; properties?: Record<string, never> })
  | (Base & { name: "Patient Updated"; properties?: Record<string, never> })
  // Appointments
  | (Base & { name: "Appointment Created"; properties: { source: "staff" | "ai_assistant" } })
  | (Base & { name: "Appointment Updated"; properties: { status: string } })
  | (Base & { name: "Appointment Cancelled"; properties?: Record<string, never> })
  // AI
  | (Base & { name: "AI Conversation Started"; properties?: Record<string, never> })
  | (Base & { name: "AI Conversation Completed"; properties: { outcome: string } })
  | (Base & { name: "AI Suggestion Accepted"; properties?: Record<string, never> })
  | (Base & { name: "AI Suggestion Dismissed"; properties?: Record<string, never> })
  // Business (no trigger wired yet -- see docs/product-analytics.md)
  | (Base & { name: "Trial Started"; properties?: Record<string, never> })
  | (Base & { name: "Trial Ended"; properties?: Record<string, never> })
  | (Base & { name: "Subscription Activated"; properties?: Record<string, never> })
  | (Base & { name: "Subscription Cancelled"; properties?: Record<string, never> })
  // Feature usage (fired by components/telemetry/feature-usage-beacon.tsx)
  | (Base & { name: "Feature Used"; properties: { feature: FeatureName } });

export type AnalyticsEventName = AnalyticsEvent["name"];

export const FEATURE_NAMES = [
  "calendar",
  "patient_profile",
  "analytics_dashboard",
  "staff_management",
  "security",
  "settings",
  "ai_inbox",
] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];

/**
 * Non-PHI traits attached to a user via identify(). Every field is
 * optional -- most are not collected anywhere in the product yet (no
 * clinic-size question on signup, no billing/plan system), so callers
 * only ever set what they actually know.
 */
export type AnalyticsUserTraits = {
  language?: Locale;
  country?: string;
  clinicSize?: number;
  plan?: string;
  trialStatus?: "none" | "active" | "expired";
  role?: ClinicRole;
  timezone?: string;
};

/**
 * The onboarding funnel from the sprint brief, in order. Used both for
 * typing intent and by lib/telemetry/dashboard.ts to compute per-step
 * completion/drop-off. "Website Visit" and "Start Trial" have no wired
 * trigger (marketing pages are out of scope for this sprint, and no
 * trial system exists yet) -- they're listed so the funnel shape matches
 * the spec and dashboard math degrades gracefully (0 reaching that step)
 * rather than needing a schema change once they exist.
 */
export const ONBOARDING_FUNNEL_STEPS: readonly AnalyticsEventName[] = [
  "User Registered", // proxy for "Website Visit" -> "Start Trial" -> "Verify Email" until a trial system exists
  "Email Verified",
  "Clinic Created",
  "Staff Invited",
  "CSV Import Completed",
  "WhatsApp Connected",
  "Appointment Created",
  "AI Conversation Started",
];
