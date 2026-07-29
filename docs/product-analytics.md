# Product analytics

Dentora's product-analytics layer, built for the private-beta sprint focused
on understanding adoption, engagement, onboarding friction, and retention
across clinics. It lives entirely under `lib/telemetry/` and is separate from
`lib/analytics/`, which computes each *clinic's own* operational metrics
(appointments, AI resolution, notifications) for their dashboard -- the two
answer different questions and should not be merged.

## Architecture

```
app code (server actions, routes, pages)
        │  track(event) / identify(userId, traits)
        ▼
lib/telemetry/index.ts        -- the only import surface the app uses
        │  sanitizeProperties()
        ▼
lib/telemetry/privacy.ts      -- denylist backstop, see "Privacy" below
        │
        ▼
lib/telemetry/provider.ts     -- AnalyticsProvider interface
        │
        ▼
lib/telemetry/providers/supabase-provider.ts   -- default (only) provider today
        │
        ▼
analytics_events / analytics_user_traits (Postgres, service-role only)
```

The app never imports a provider directly. `track()` and `identify()` in
`lib/telemetry/index.ts` are the only two functions call sites use, and both
are **best-effort**: a failure is caught and logged, never thrown, so
analytics can never break a user-facing request.

### Swapping in a new provider

1. Implement `AnalyticsProvider` (`lib/telemetry/provider.ts`) --
   `capture(event)` and `identify(userId, traits)`.
2. Add it under `lib/telemetry/providers/`.
3. Change what `getProvider()` returns in `lib/telemetry/index.ts`.

No call site anywhere else in the app needs to change.

## Events

Defined as a single discriminated union, `AnalyticsEvent`, in
`lib/telemetry/events.ts`. Every payload is restricted to ids, enums,
counts, and booleans -- never free text (see Privacy).

| Category | Event | Fires from |
|---|---|---|
| Auth | `User Registered` | `app/actions/auth.ts` `signUp` |
| Auth | `Email Verified` | `app/auth/confirm/route.ts` |
| Auth | `Login` / `Logout` | `app/actions/auth.ts` `signIn` / `signOut` |
| Auth | `Password Reset` (`stage: "requested" \| "completed"`) | `app/actions/auth.ts` `requestPasswordReset` / `completePasswordReset` |
| Onboarding | `Clinic Created` | `app/actions/clinics.ts` `createClinic` |
| Onboarding | `Staff Invited` | `app/actions/team.ts` `inviteMember` |
| Onboarding | `Demo Started` / `Demo Reset` | `app/actions/demo.ts` |
| Onboarding | `CSV Import Started` / `CSV Import Completed` | `app/actions/import.ts` |
| Onboarding | `WhatsApp Connected` | `app/actions/whatsapp-settings.ts` |
| Patients | `Patient Created` | `app/actions/patients.ts` `createPatient` |
| Patients | `Patient Updated` | **not wired** -- no update action exists yet |
| Appointments | `Appointment Created` (`source: "staff" \| "ai_assistant"`) | `app/actions/appointments.ts`, `app/actions/appointment-drafts.ts` |
| Appointments | `Appointment Updated` / `Appointment Cancelled` | `app/actions/appointments.ts` `updateAppointmentStatus` |
| AI | `AI Conversation Started` | `lib/ai/orchestrator.ts`, on the first turn of a new `ai_conversations` row |
| AI | `AI Conversation Completed` | `lib/ai/orchestrator.ts`, once per resolved turn (see "Known approximations") |
| AI | `AI Suggestion Accepted` / `AI Suggestion Dismissed` | `app/actions/appointment-drafts.ts` `approveDraft` / `rejectDraft` |
| Business | `Trial Started` / `Trial Ended` / `Subscription Activated` / `Subscription Cancelled` | **not wired** -- no trial/billing system exists yet |
| Feature usage | `Feature Used` (`feature: FeatureName`) | `components/telemetry/feature-usage-beacon.tsx`, dropped into calendar, patient profile, clinic dashboard, staff management, account security, settings, and AI inbox pages |

### User properties (`identify`)

Non-PHI traits, stored in `analytics_user_traits`, merged on every call:
`language`, `country`, `clinicSize`, `plan`, `trialStatus`, `role`,
`timezone`. Most are not collected anywhere in the product yet (no
clinic-size question at signup, no billing) -- callers only set what they
actually know. Today, `identify()` is called once, at `Clinic Created`, with
`role: "owner"` and the clinic creator's locale.

### Onboarding funnel

`ONBOARDING_FUNNEL_STEPS` in `lib/telemetry/events.ts` is the ordered list
the internal dashboard's funnel chart walks: User Registered → Email
Verified → Clinic Created → Staff Invited → CSV Import Completed →
WhatsApp Connected → Appointment Created → AI Conversation Started.
"Website Visit" and "Start Trial" (from the sprint brief's funnel) are not
represented -- marketing pages are out of scope for this sprint, and there
is no trial system to start.

### Known approximations

- **AI Conversation Completed** fires once per resolved orchestrator turn,
  not once per conversation thread. The orchestrator (`lib/ai/orchestrator.ts`)
  has no concept of a thread "closing" -- a WhatsApp conversation can span
  many turns over hours or days with no explicit end. Grouping by
  `conversationId` downstream can reconstruct thread-level completion once
  that's needed; this sprint reports per-turn completion instead of adding
  new product logic to invent a close event.
- **Trial Started / Trial Ended / Subscription Activated / Subscription
  Cancelled** are typed and ready but not fired anywhere -- there is no
  trial or billing system in the codebase today. The internal dashboard's
  trial-conversion metric reports `insufficient_data` until they exist.
- **Patient Updated** has no trigger -- there is currently no
  `updatePatient` server action.

## Internal dashboard

`/admin/analytics`, gated by `lib/telemetry/admin-access.ts`'s
`requirePlatformAdmin()`: a comma-separated, case-insensitive allowlist of
emails in the `ANALYTICS_ADMIN_EMAILS` environment variable. This is
intentionally **not** the per-clinic `owner` `clinic_role` -- the dashboard
answers cross-clinic questions (which clinics are active, platform-wide
DAU/WAU/MAU) that no single clinic's owner should be able to see. Without
`ANALYTICS_ADMIN_EMAILS` set, the route 404s for everyone.

Shows: daily/weekly/monthly active users, activation rate (clinics that
booked an appointment or started an AI conversation within 14 days of
creation), feature adoption and most-used features, onboarding funnel
drop-off, demo usage, and trial conversion.

Aggregation logic lives in `lib/telemetry/dashboard.ts` as pure functions
over already-fetched rows (`lib/telemetry/query.ts` does the fetching),
mirroring the fetch/aggregate split already used by `lib/analytics/`.

## Privacy

**Never tracked**: patient notes, medical records, conversation contents,
passwords, tokens, email-verification tokens, API keys, or other sensitive
healthcare information. Enforced two ways:

1. **By construction** -- every `AnalyticsEvent` payload type in
   `lib/telemetry/events.ts` only ever contains ids, enums, counts, and
   booleans. There is no field a call site could put a note or message body
   into even by accident.
2. **Defense in depth** -- `lib/telemetry/privacy.ts`'s `sanitizeProperties()`
   runs on every `track()` call and strips a denylist of key names
   (`notes`, `message`, `content`, `body`, `transcript`, `diagnosis`,
   `treatment`, `password`, `token`, `secret`, `apiKey`, `email`, `phone`,
   `address`, `ssn`, `dob`, ...). In development and tests, a denylisted key
   throws immediately instead of being silently dropped, so a bad call site
   is caught in code review, not in production data.

`analytics_events` and `analytics_user_traits` (see
`supabase/migrations/20260730050000_product_analytics.sql`) have Row Level
Security enabled with **no policies** -- only the service-role client
(`lib/supabase/admin.ts`) can read or write them. No clinic member, through
any normal session, can query this data.

## Naming conventions

- Event names are Title Case, human-readable strings (`"Appointment
  Created"`, not `appointment_created`) -- they double as what's shown in
  any future analytics UI without translation.
- Feature-usage events share one event name, `Feature Used`, with a
  `feature: FeatureName` property, rather than one event per feature --
  keeps the event vocabulary small and makes "most used features" a single
  group-by instead of a union of N event names.
- Every event optionally carries `clinicId` and `userId` for scoping; both
  are nullable (system-level AI events have a clinic but no end-user; a
  failed anonymous login has neither).

## Testing

See `lib/telemetry/*.test.ts`:
- `privacy.test.ts` -- denylisted keys are stripped/thrown on, clean
  payloads pass through unchanged.
- `index.test.ts` -- `track()`/`identify()` call the provider exactly once
  and never throw, even when the provider rejects (no duplicate events, no
  broken user flows).
- `once-guard.test.ts` -- the beacon's dedup guard only ever fires once.
- `dashboard.test.ts` -- DAU/WAU/MAU, activation, feature-adoption, and
  funnel math against fixture rows.

A representative sample of instrumented server actions (`signIn`,
`createAppointment`, `approveDraft`) also have tests asserting the right
event fires with the right properties. Localization is covered by the
existing `lib/i18n/dictionary-parity.test.ts`, which now also checks the
new `adminAnalytics` dictionary keys across `en`/`fr`/`ar`.
