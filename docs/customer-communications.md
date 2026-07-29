# Customer communications

Dentora's branded email layer and in-app Notification Center, built for the
private-beta sprint focused on making every customer-facing email and
notification feel like it comes from a premium healthcare technology
company. This is a **presentation-layer** sprint: no new product features,
no dashboard redesigns, and no changes to analytics, authentication, AI
logic, or appointment business rules.

Two scope realities shaped what's actually wired up versus just built:

- **No trial/subscription system exists in the product yet** (see
  `lib/telemetry/dashboard.ts`'s `computeTrialConversion`), so the three
  trial email templates are built, branded, and previewable, but nothing
  triggers them.
- **Verify Email / Password Reset / Staff Invitation emails are sent by
  Supabase Auth's own built-in email system today** (`app/actions/auth.ts`,
  `app/actions/team.ts`), not by this app's code. Those templates are also
  built and previewable, but the real send path was intentionally left
  untouched.

So: **all 13 templates exist, are branded, localized, tested, and
previewable. Only 4 (the appointment lifecycle emails) are wired into a
real send path** — the ones that already fire today. Every other template
is explicitly marked "ready" (not "wired") wherever it's listed, in code and
in the preview page.

## Architecture

```
lib/email/                              -- the email service (new)
  types.ts, brand.ts, layout.ts,           templates: pure functions,
  wordmark.ts, components.ts               {subject, html, text} out,
  registry.ts                              zero I/O, zero deps beyond React-
  templates/*.ts (13 files)                free string building
        │
        │  (only for the 4 "wired" templates)
        ▼
lib/notifications/email-html.ts         -- bridge: NotificationEventType -> lib/email template,
                                            behind an explicit allowlist Set
        │
        ▼
lib/notifications/dispatch.ts           -- existing delivery pipeline (events, retries,
                                            FSM) -- attaches the rendered `html` alongside
                                            the pre-existing plain-text `body`
        │
        ▼
lib/notifications/provider.ts           -- NotificationProvider.send({..., html?})
        │
        ▼
lib/notifications/providers/
  resend-email-provider.ts              -- passes `html` to Resend's API when present
```

`lib/email/` and `lib/notifications/` are deliberately separate: `lib/email/`
only knows how to render a template given props; it has no idea deliveries,
retries, or event types exist. `lib/notifications/email-html.ts` is the only
file that bridges the two, and it does so through a hard allowlist:

```ts
const HTML_ALLOWLIST: ReadonlySet<NotificationEventType> = new Set([
  "appointment_confirmed",
  "appointment_reminder",
  "appointment_cancelled",
  "appointment_rescheduled",
]);
```

`appointment_booked` and `conversation_escalated` (the pipeline's two other
event types) are not in that set, so they keep sending plain-text-only,
completely unchanged from before this sprint.

## Template catalog

| Template | Category | Status | Notes |
|---|---|---|---|
| Welcome | account | ready | No code path sends this; Supabase handles account creation. |
| Verify Email | account | ready | Supabase Auth sends the real verification email today. |
| Password Reset | account | ready | Supabase Auth sends the real reset email today. |
| Password Changed | account | ready | No "password changed" event/hook exists yet. |
| Staff Invitation | team | ready | `app/actions/team.ts` uses `admin.auth.admin.inviteUserByEmail` (Supabase's own email), not this template. |
| Invitation Accepted | team | ready | No "invite accepted" notification hook exists yet. |
| Appointment Confirmation | appointments | **wired** | Sent by `dispatch.ts` for the `appointment_confirmed` event. |
| Appointment Reminder | appointments | **wired** | Sent by `dispatch.ts` for the `appointment_reminder` event (scheduled ahead via `computeReminderScheduledFor`). |
| Appointment Cancelled | appointments | **wired** | Sent by `dispatch.ts` for the `appointment_cancelled` event. |
| Appointment Rescheduled | appointments | **wired** | Sent by `dispatch.ts` for the `appointment_rescheduled` event. Only the new time is available at send time (see code comment). |
| Trial Started | billing | ready | No trial/subscription system exists in the product. Sample data is illustrative. |
| Trial Ending (7 days) | billing | ready | Same caveat as above. |
| Trial Ending (1 day) | billing | ready | Same caveat as above. |

Every template exports a typed `Props` type, a deterministic `sampleProps`
fixture (used by both tests and the preview page), and a `render(props,
language, options?)` function returning `{ subject, html, text }`. The
registry (`lib/email/registry.ts`) is the single source of truth the
preview page and test suite both iterate — nothing else hardcodes the list
of 13.

## Brand design

Colors are hex conversions of the OKLCH tokens in `app/globals.css`
(`--brand`, `--success`, `--warning`, `--destructive`, `--info`), since
email HTML renders outside Tailwind/CSS-variable context. A few tokens
(the base brand teal used as body/link text, `--success`, `--info`) are
darkened one step relative to their in-app value specifically to clear
WCAG AA 4.5:1 for normal-size text — see `lib/email/brand.ts` and
`brand.test.ts`, which asserts every color pair actually used clears AA.

There's no logo file anywhere in the repo (`public/` has none), so the
brand mark is a styled text wordmark ("Dentora"), with a documented,
currently-unused prop slot for a future per-clinic name/logo
(`renderWordmark(clinicName?)` — see "Future work").

Dark mode: production sends ship a `@media (prefers-color-scheme: dark)`
stylesheet block alongside the light-mode default (the safe fallback for
clients that ignore `<style>`/media queries) — real clients that support it
auto-adapt; nothing about the send path itself branches on theme. The
internal preview page additionally accepts a `forceColorScheme` override
(never used by real sends) so the dark variant can be inspected
deterministically regardless of the viewer's own OS/browser theme.

Responsive layout is table-based with a single `max-width: 560px` centered
card, standard email-HTML practice for reliable rendering across clients.

## In-app Notification Center

A header bell (`components/clinic/notification-bell.tsx`), backed by the
same `notification_deliveries` table the existing pipeline already writes
to — nothing new was added to the data model except one column.

- **Unread count / list**: `lib/notifications/queries.ts`'s
  `countUnreadNotifications` / `listNotificationCenterItems`, scoped to the
  `in_app` channel. **Clinic-wide, not per-user** — `notification_deliveries`
  has no per-staff-member recipient id today (`recipient_type: "staff"` is
  clinic-wide), so "read" and "unread" are clinic-wide states, consistent
  with the pre-existing dashboard widget.
- **Mark read**: reuses the existing delivery-status FSM
  (`lib/notifications/machine.ts`'s `mark_read` event) — no new backend
  logic.
- **Archive**: a new nullable `archived_at` column
  (`supabase/migrations/20260730060000_notification_center_archive.sql`),
  mutated directly by `lib/notifications/store.ts`'s `archiveDelivery()`,
  deliberately bypassing the FSM since archived-vs-not is a visibility axis
  orthogonal to delivery status. One-directional (no unarchive).
- **Categories**: `lib/notifications/categories.ts` maps the 6 existing
  `NotificationEventType`s to 5 categories (Appointments, Security, AI,
  Team, System). **Only Appointments and AI have any live data today** —
  Security/Team/System tabs render an honest empty state, since no event
  type in the pipeline feeds them yet. This is a real limitation, not a bug:
  building those categories out would mean adding new event types and
  emitting code at new call sites, which is a product feature, out of
  scope for this sprint.

The pre-existing dashboard widget (`components/dashboard/notification-center.tsx`,
a compact "last 6" all-channel activity feed) is unchanged in behavior; it
was refactored to call the same `listNotificationCenterItems` helper the
bell now uses, purely to avoid duplicating the Supabase query.

## Notification preferences

Stored in the existing `clinics.settings.notifications` JSONB blob (no
migration needed), extended with:

```ts
channels?: { email?: boolean; inApp?: boolean };
categories?: {
  appointmentReminders?: boolean;
  securityAlerts?: boolean;   // UI-only, see below
  aiSummaries?: boolean;
  teamActivity?: boolean;     // UI-only, see below
};
```

All fields default to `true` when unset (fully backward compatible with
existing clinics). Wired into `lib/notifications/engine.ts`'s
`buildDeliveryPlans`:

- `channels.email` / `channels.inApp` — real per-channel kill switches;
  disabling one drops any delivery plan on that channel.
- `categories.appointmentReminders` — an additional gate alongside the
  existing `patient.reminderOptIn` check on `appointment_reminder`.
- `categories.aiSummaries` — gates `conversation_escalated` only, **not**
  `appointment_booked` (that one is an operational staff alert, not an "AI
  summary").
- `categories.securityAlerts` / `categories.teamActivity` — stored and
  toggleable in the settings UI, labeled "Coming soon", but there is no
  security or team-activity event type in the pipeline for them to gate
  yet.

UI: `components/clinic/notification-settings-form.tsx`, inside the existing
Notifications card on the clinic settings page — no new card, no layout
change.

## Preview page

`/admin/email-preview`, gated by the same `requirePlatformAdmin()` /
`ANALYTICS_ADMIN_EMAILS` allowlist as `/admin/analytics` (no new env var).
Server-rendered, query-string driven (`?template=&device=&theme=&lang=`);
every template renders inside a sandboxed `<iframe srcDoc>` so the email's
own inline styles never collide with the app's Tailwind. Desktop/mobile
toggles just change the iframe's width; the theme toggle uses the
`forceColorScheme` preview-only override described above.

## Testing

- `lib/email/registry.test.ts` — every one of the 13 templates, in all 3
  languages: non-empty subject/html/text, a full HTML document, the
  dark-mode media query present, sample data actually interpolated, and the
  plain-text version free of HTML tags.
- `lib/email/brand.test.ts` — WCAG contrast-ratio checks on every
  text/background color pair actually used (body text, muted/footer text,
  brand links, button text, destructive/warning text), via a small
  `contrastRatio()` utility.
- `lib/notifications/email-html.test.ts` — the allowlist behavior itself:
  the 4 wired event types return real HTML, the 2 unwired ones (and every
  non-email channel) return `null`.
- Localization coverage of the new settings/bell UI strings needs no new
  test — the pre-existing `lib/i18n/dictionary-parity.test.ts` already
  fails the build if `en.ts`/`fr.ts`/`ar.ts` fall out of key-path sync.
- **No duplicate notifications**: there is no DB uniqueness constraint on
  `notification_events`/`notification_deliveries` — dedup isn't a
  database-level guarantee. It actually lives one layer up, in
  `lib/ai/appointments/store.ts`'s `transitionAppointment`: a lifecycle
  event is only notified after a successful compare-and-swap status
  transition, and a repeated event against the *same* real-world action
  re-enters from the *new* status, which the appointment FSM rejects as
  `invalid_transition` before the notification hook is ever reached. A
  regression test in `lib/ai/appointments/store.notifications.test.ts`
  calls `transitionAppointment` twice with an identical "confirm" event and
  asserts the notification mock fires exactly once.

## Future work

- Per-user staff notification targeting (today, in-app deliveries and their
  read/unread state are clinic-wide, since `notification_deliveries` has no
  per-staff-member recipient id).
- A per-clinic logo/branding column on `clinics`, so `renderWordmark()`'s
  `clinicName` slot could become a real logo image.
- Real `security` and `team` notification-center categories once those
  event types exist in the pipeline.
- A real trial/subscription system, at which point Trial Started / Trial
  Ending (7d/1d) would move from "ready" to "wired".
- If Dentora's own code ever takes over sending Welcome / Verify Email /
  Password Reset / Password Changed / Staff Invitation / Invitation
  Accepted (rather than relying on Supabase Auth's built-in emails), those
  6 templates are already built and waiting.
- Future SMS support: `lib/notifications/provider.ts`'s `sms` channel
  currently always falls back to the safe logging provider — no real SMS
  provider (Twilio or similar) is wired up. The same `NotificationProvider`
  interface used for email/WhatsApp today would apply unchanged.
- Future WhatsApp support: partially real already —
  `lib/notifications/providers/whatsapp-cloud-provider.ts` sends real
  WhatsApp Cloud API messages when `WHATSAPP_ACCESS_TOKEN` /
  `WHATSAPP_PHONE_NUMBER_ID` are configured, but WhatsApp messages are
  plain text only; a branded WhatsApp template system (approved Meta
  message templates) would be new work.
