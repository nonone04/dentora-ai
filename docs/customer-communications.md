# Customer communications

Dentora's branded email layer and in-app Notification Center, built for the
private-beta sprint focused on making every customer-facing email and
notification feel like it comes from a premium healthcare technology
company. This is a **presentation-layer** sprint: no new product features,
no dashboard redesigns, and no changes to analytics, authentication, AI
logic, or appointment business rules.

One scope reality still shapes what's wired up versus just built: **no
trial/subscription system, contact form, support-ticket system, or
passwordless sign-in exists in the product yet**, so the 13 templates for
those (3 trial, Payment Receipt, Subscription Activated/Cancelled, Contact
Form Auto Reply, Support Ticket Confirmation, Magic Login Link) are built,
branded, and previewable, but nothing triggers them — no fake webhook
handlers or data models were invented to change that.

Everything that *does* have a real, existing trigger in the product is now
wired to send through this app's own branded Resend pipeline, including
account/auth emails that used to be Supabase Auth's own built-in emails
(Verify Email, Password Reset, Staff Invitation) — see "Auth emails" below
for how.

So: **all 19 templates exist, are branded, localized, tested, and
previewable. 10 are wired into a real send path**: the 4 appointment
lifecycle emails (unchanged from before), plus Welcome, Verify Email,
Password Reset, Password Changed, Staff Invitation, and Invitation
Accepted. The remaining 9 are marked "ready" (not "wired") in code and in
the preview page, each because its triggering feature doesn't exist yet.
The full trigger-by-trigger audit is in "Audit: every email trigger" below.

## Architecture

```
lib/email/                              -- the email service
  types.ts, brand.ts, layout.ts,           templates: pure functions,
  wordmark.ts, components.ts               {subject, html, text} out,
  registry.ts, resend.ts                   zero I/O, zero deps beyond React-
  templates/*.ts (19 files)                free string building
  send.ts                                  -- sendTemplatedEmail(id, to, props, lang):
                                               generic one-off bridge from the registry
                                               to the provider, used by every direct
                                               trigger below
        │
        ├─── (4 appointment lifecycle templates) ───────────────────────────
        │
        │  lib/notifications/email-html.ts   -- bridge: NotificationEventType -> lib/email
        │                                        template, behind an explicit allowlist Set
        │           ▼
        │  lib/notifications/dispatch.ts      -- existing delivery pipeline (events, retries,
        │                                        FSM) -- attaches the rendered `html` alongside
        │                                        the pre-existing plain-text `body`
        │
        ├─── (Welcome / Password Changed / Invitation Accepted) ────────────
        │
        │  Direct sendTemplatedEmail() calls at the point the underlying
        │  action succeeds: app/actions/clinics.ts's createClinic (Welcome),
        │  app/actions/auth.ts's completePasswordReset (Password Changed),
        │  app/actions/team.ts's acceptInvitation (Invitation Accepted)
        │
        ├─── (Verify Email / Password Reset / Staff Invitation) ────────────
        │
        │  app/api/auth/send-email-hook/route.ts -- Supabase Auth's "Send
        │  Email" hook target. Once enabled in Supabase Dashboard >
        │  Authentication > Hooks > Send Email, Supabase calls this
        │  endpoint with the verification token instead of sending its own
        │  built-in email; this route verifies the request (standardwebhooks
        │  + SUPABASE_AUTH_HOOK_SECRET), renders the matching template, and
        │  calls sendTemplatedEmail() itself. See "Auth emails" below.
        │
        ▼ (all paths converge here)
lib/notifications/provider.ts           -- NotificationProvider.send({..., html?}), reads
                                            RESEND_API_KEY / EMAIL_FROM
        │
        ▼
lib/notifications/providers/
  resend-email-provider.ts              -- sends via the `resend` SDK (lib/email/resend.ts's
                                            getResendClient()), validates the recipient address,
                                            retries transient errors (rate limits, 5xxs) with
                                            backoff, logs failures
```

`lib/email/resend.ts` holds the one Resend SDK client (`getResendClient(apiKey)`,
lazily constructed) and the recipient-address validator
(`isValidEmailAddress()`) shared by the provider -- the only file that
imports the `resend` package directly, so there's exactly one place email
delivery config lives.

### Auth emails: replacing Supabase's built-in system

Verify Email, Password Reset, and Staff Invitation used to be sent by
Supabase Auth's own built-in email system (`supabase.auth.signUp`,
`resetPasswordForEmail`, `resend`, `admin.auth.admin.inviteUserByEmail`) --
Supabase-branded, not ours, and outside this app's email pipeline entirely.

Supabase Auth supports a **Send Email Hook**: an HTTPS endpoint (any
endpoint -- doesn't have to be a Supabase Edge Function) that Supabase
calls instead of sending its own email, handing over the token/link data.
`app/api/auth/send-email-hook/route.ts` is that endpoint:

1. Verifies the request via the `standardwebhooks` package against
   `SUPABASE_AUTH_HOOK_SECRET` (401 on failure).
2. Reads `email_data.email_action_type` (`signup` / `recovery` / `invite`
   -- the only three this app can actually trigger; no email-change UI
   exists and MFA is disabled in `supabase/config.toml`, so
   `email_change`/`reauthentication`/etc. never fire in practice) and maps
   it to `verify_email` / `password_reset` / `staff_invitation`.
3. Rebuilds the real `/auth/confirm?token_hash=...&type=...&next=...` link
   itself from `email_data.token_hash` and the plain post-verification path
   the app originally requested (now passed as a plain path in
   `emailRedirectTo`/`redirectTo`, not pre-wrapped -- the hook owns building
   the actual confirm URL).
4. Sends via `sendTemplatedEmail()`, same as every other trigger.
5. **Always returns 200**, even on a send failure or an unrecognized
   action type -- a hook error can block the underlying Supabase auth
   operation itself (e.g. block signup), which must never happen just
   because a branded template doesn't exist yet. Failures are logged.

`admin.auth.admin.inviteUserByEmail` (`app/actions/team.ts`) now also
passes `data` (`inviter_name`, `clinic_name`, `invited_role`, `locale`) as
user metadata, since the hook payload only carries generic Supabase user
fields -- the invite email's clinic-specific copy comes from there.

**Manual step required in the Supabase Dashboard** (can't be done from
this repo): Authentication > Hooks > Send Email > enable, point it at
`<deployed app origin>/api/auth/send-email-hook`, copy the generated
secret into `SUPABASE_AUTH_HOOK_SECRET`. Until that's done, Supabase keeps
sending its own default emails for these three flows -- this is the one
remaining Supabase-branding surface, and it's an infra toggle, not code.
`supabase/config.toml` has a matching commented block for local-dev parity.

### Environment variables

- `RESEND_API_KEY` + `EMAIL_FROM` -- both required for `lib/notifications/provider.ts`'s
  factory to select the real `ResendEmailProvider`; without either, every
  channel falls back to the safe logging provider (nothing sent for real).
  `EMAIL_FROM` must be `Dentora AI <hello@dentora.vip>` (display name +
  verified sending domain).
- `SUPABASE_AUTH_HOOK_SECRET` -- signing secret for the Send Email hook
  above, generated in Supabase Dashboard > Authentication > Hooks > Send
  Email. Format `v1,whsec_<base64>`.
- `EMAIL_SUPPORT` -- support inbox shown in every footer's "Support" link
  (`mailto:`); falls back to `support@dentora.ai` if unset.
- `NEXT_PUBLIC_APP_URL` -- public site URL for the footer's website/privacy/terms
  links and every account-email link's base URL; falls back to
  `https://dentora.ai` if unset. Read directly by
  `lib/email/components.ts`'s `renderFooter()` and the send-email-hook
  route, not threaded through template props, since every email shares one
  footer/base URL.
  Note: this default (`dentora.ai`) differs from the sender domain
  (`dentora.vip`) -- both are already in use elsewhere in the app (Google
  OAuth redirect URLs are configured for `dentora.vip`; marketing copy and
  sample URLs throughout use `dentora.ai`). Set `NEXT_PUBLIC_APP_URL`
  explicitly to whichever is the real production domain; nothing in this
  sprint changes that inconsistency, since only the sender address was
  specified.

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
| Welcome | account | **wired** | Sent by `app/actions/clinics.ts`'s `createClinic`, once the user's first clinic (and dashboard URL) actually exists. |
| Verify Email | account | **wired** | Sent by the Send Email Hook (`app/api/auth/send-email-hook/route.ts`) for `email_action_type: "signup"`, once the hook is enabled in the Supabase Dashboard. |
| Password Reset | account | **wired** | Same hook, `email_action_type: "recovery"`. |
| Password Changed | account | **wired** | Sent directly by `app/actions/auth.ts`'s `completePasswordReset` after a successful password update. |
| Magic Login Link | account | ready | No passwordless/magic-link sign-in flow exists yet; auth is password-based. |
| Staff Invitation | team | **wired** | Same hook, `email_action_type: "invite"`; `app/actions/team.ts`'s `inviteMember` now passes clinic/role/inviter context as user metadata for the hook to render. |
| Invitation Accepted | team | **wired** | Sent by `app/actions/team.ts`'s `acceptInvitation` to the original inviter (tracked via the new `clinic_members.invited_by` column). |
| Appointment Confirmation | appointments | **wired** | Sent by `dispatch.ts` for the `appointment_confirmed` event. |
| Appointment Reminder | appointments | **wired** | Sent by `dispatch.ts` for the `appointment_reminder` event (scheduled ahead via `computeReminderScheduledFor`). |
| Appointment Cancelled | appointments | **wired** | Sent by `dispatch.ts` for the `appointment_cancelled` event. |
| Appointment Rescheduled | appointments | **wired** | Sent by `dispatch.ts` for the `appointment_rescheduled` event. Only the new time is available at send time (see code comment). |
| Payment Receipt | billing | ready | Stripe billing (`lib/stripe/`) creates Checkout sessions only -- no webhook handler exists to confirm a payment or emit a receipt-sent event. |
| Subscription Activated | billing | ready | No subscription lifecycle/webhook exists yet -- Stripe Checkout has no confirmation step wired back into the product. |
| Subscription Cancelled | billing | ready | Same as above. |
| Trial Started | billing | ready | No trial/subscription system exists in the product. Sample data is illustrative. |
| Trial Ending (7 days) | billing | ready | Same caveat as above. |
| Trial Ending (1 day) | billing | ready | Same caveat as above. |
| Contact Form Auto Reply | support | ready | No public contact form exists in the product yet. |
| Support Ticket Confirmation | support | ready | No support-ticket system exists in the product yet. |

Every template exports a typed `Props` type, a deterministic `sampleProps`
fixture (used by both tests and the preview page), and a `render(props,
language, options?)` function returning `{ subject, html, text }`. The
registry (`lib/email/registry.ts`) is the single source of truth the
preview page and test suite both iterate — nothing else hardcodes the
template list.

## Audit: every email trigger

Every sender is `Dentora AI <hello@dentora.vip>` (`EMAIL_FROM`), delivered
via the shared `ResendEmailProvider` (retry with backoff, recipient
validation, structured error logging — see "Reliability" below), except
where noted. "Fully integrated" means: real trigger in the product, sends
our branded template, no Supabase/provider branding reaches the user.

| # | Trigger | Template | Fully integrated? | Limitation |
|---|---|---|---|---|
| 1 | New user completes signup | Verify Email | Yes, **once the Supabase Dashboard hook is enabled** (see "Auth emails") | Language defaults to English — no clinic exists yet at this point, so there's no locale signal to read. |
| 2 | User requests a password reset | Password Reset | Yes, same caveat as #1 | Same language caveat as #1. |
| 3 | Existing user's password is changed (via reset flow) | Password Changed | Yes | Language read from the user's active clinic if they have one, else English. |
| 4 | Manager invites a teammate | Staff Invitation | Yes, same caveat as #1 | Invite-link expiry copy (7 days) is informational; actual link validity is enforced by Supabase's own OTP-expiry setting, not this app. |
| 5 | Invited teammate accepts | Invitation Accepted | Yes | Only sent for invites created after the `invited_by` column shipped — earlier pending invites have no recorded inviter, so acceptance is silent for those. |
| 6 | User creates their first clinic | Welcome | Yes | Language uses the UI locale cookie at creation time, not a stored clinic/user preference. |
| 7 | Appointment confirmed / reminder due / cancelled / rescheduled | Appointment Confirmation / Reminder / Cancelled / Rescheduled | Yes (pre-existing, unchanged) | Rescheduled email only has the new time available, not the old one (see code comment in the template). |
| 8 | Stripe Checkout payment succeeds | Payment Receipt | No | No Stripe webhook handler exists to confirm a charge — `lib/stripe/checkout.ts` only creates the Checkout session. Building that handler is a payment-infrastructure feature, out of scope here; the template is ready for when it exists. |
| 9 | Subscription activated / cancelled | Subscription Activated / Cancelled | No | Same root cause as #8 — no subscription-state webhook/event source. |
| 10 | Trial starts / trial ending soon | Trial Started / Trial Ending (7d, 1d) | No | No trial system exists in the product (`lib/telemetry/dashboard.ts`'s `computeTrialConversion` is telemetry-only, not a real trial state machine). |
| 11 | Public contact form submitted | Contact Form Auto Reply | No | No public contact form exists in the product. |
| 12 | Support ticket opened | Support Ticket Confirmation | No | No support-ticket system exists in the product. |
| 13 | Passwordless ("magic link") sign-in | Magic Login Link | No | Auth is password-based only; no `signInWithOtp`/magic-link flow exists. |

**Remaining Supabase limitation**: until the Send Email Hook is enabled in
the Supabase Dashboard (a one-time manual step outside this repo — see
"Auth emails" above), rows 1, 2, and 4 keep sending Supabase's own default
emails, not ours. Every other Supabase-originated email surface (password
recovery's *destination* page, OAuth consent screens, etc.) is Supabase's
own hosted UI, not an email, and out of scope for this audit.

### Reliability

- **Retry**: `ResendEmailProvider` retries up to 3 times with exponential
  backoff on transient Resend errors (rate limits, 5xxs) — already existed,
  unchanged by this integration.
- **Logging**: every failed send is logged with the recipient and Resend
  error (`resend-email-provider.ts`); the send-email-hook route additionally
  logs unrecognized action types and signature failures.
- **Validation**: `lib/email/resend.ts`'s `isValidEmailAddress()` rejects
  malformed recipients before ever calling the Resend API.
- **Rate limiting**: the send-email-hook route rate-limits per recipient
  (`checkRateLimit`, same helper as the rest of the auth flows) on top of
  Supabase's own `max_frequency` config; `app/actions/auth.ts`'s existing
  per-email/per-IP limits are unchanged.
- **Localization**: all 19 templates are fully localized (en/fr/ar);
  triggers use the best available signal (clinic `default_language`, UI
  locale cookie, or English fallback where no signal exists yet — see the
  audit table above).
- **Future template expansion**: adding a 20th template means adding one
  file under `lib/email/templates/`, registering it in
  `lib/email/registry.ts`, and wiring one `sendTemplatedEmail()` call (or a
  new `email_action_type` case in the hook, for auth-flow emails) — no
  other file needs to change.

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

Every footer (`lib/email/components.ts`'s `renderFooter()`) carries, in
addition to the tagline/copyright: a support mailto link (`EMAIL_SUPPORT`),
a website link, and Privacy Policy / Terms of Service links (both under
`NEXT_PUBLIC_APP_URL`) — all localized. No `/privacy` or `/terms` page
exists in the app yet, so those two links are forward-looking, same
treatment as the "no logo file" wordmark decision above.

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

- `lib/email/registry.test.ts` — every template in the registry, in all 3
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
- `app/api/auth/send-email-hook/route.test.ts` — signature verification
  (valid/invalid), each of the 3 handled `email_action_type`s renders and
  sends the right template, and an unrecognized action type acknowledges
  with 200 without sending anything.
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

## WhatsApp Cloud API integration

Full WhatsApp messaging (reminders, confirmations, cancellations, reschedules,
a post-visit thank-you + Google review request, a staff-facing send panel,
and a clinic-wide message log), built on top of the Notification &
Communication Platform above rather than as a parallel system.

### Architecture

```
lib/whatsapp/               -- the WhatsApp-specific service layer
  types.ts                     shared types (Graph API payloads, WhatsAppSendResult)
  client.ts                    the ONE place that calls Meta's Graph API --
                                sendTextMessage / sendTemplateMessage / getPhoneNumberProfile,
                                with in-process retry+backoff on transient errors
  templates.ts                 branded, localized (en/fr/ar) message copy --
                                warmer/more conversational than the shared
                                lib/notifications/templates.ts table
  send.ts                      standalone, DB-free "compose and send one message"
                                functions (sendAppointmentReminder, sendAppointmentConfirmation,
                                sendCancellationMessage, sendRescheduleMessage,
                                sendCompletedThankYou, sendCustomMessage) -- used by the
                                Settings page's Test Message button and directly callable
                                for programmatic use
  webhook.ts                    signature verification + inbound status-callback handling
  clinic.ts, patient-match.ts   inbound routing helpers (Phase 15, unchanged)

lib/notifications/providers/whatsapp-cloud-provider.ts
  -- the NotificationProvider adapter, delegates to lib/whatsapp/client.ts
     (one Graph API integration, not two)
```

Two send paths, one Graph API client:

- **Automated, preference-driven** (confirm/cancel/reschedule/reminder/
  completed, triggered by appointment lifecycle transitions) flow through
  `lib/notifications/engine.ts` -> `dispatch.ts`, same as every other
  channel -- picks the patient's preferred channel, retries, logs. When the
  resolved channel is `whatsapp`, `lib/notifications/templates.ts`'s
  `renderNotificationTemplate` defers to `lib/whatsapp/templates.ts`'s
  branded copy instead of the shared terse table (email/sms/in_app are
  unaffected).
- **Manual dashboard actions** (Send Reminder/Confirmation/Custom Message/
  Review Request buttons on Appointment Details) always target whatsapp
  regardless of the patient's stored preference --
  `app/actions/whatsapp-messages.ts` calls
  `lib/notifications/engine.ts`'s `createNotificationEvent` with a new
  `channelOverride` param, which bypasses the automatic-send preference
  gates (those model "should we proactively contact this patient", not
  "can staff message them on demand") but still goes through the same
  notification_events/notification_deliveries pipeline for tracking.

### New event types

`appointment_completed` (thank-you + Google review request, fired from
`lib/ai/appointments/store.ts`'s `applyNotificationHook` on the `complete`
lifecycle transition) and `custom_message` (free-form staff-composed text,
routed through the pipeline via `metadata.customBody` rather than a fixed
template) were added to the `notification_event_type` Postgres enum
(`supabase/migrations/20260801220000_whatsapp_notification_event_types.sql`).

### Real delivered/read/failed status

`notification_deliveries` gained a `provider_message_id` column
(`supabase/migrations/20260801230000_notification_deliveries_provider_message_id.sql`),
populated from Meta's `messages[0].id` on send. The inbound webhook route
(`app/api/whatsapp/webhook/route.ts`) now handles Meta's `statuses[]`
payload (delivery/read/failure receipts) alongside the pre-existing
`messages[]` handling, matching each receipt back to its delivery row via
that id and applying the delivery-status FSM's `mark_delivered`/
`mark_read`/`mark_failed` events (`lib/notifications/machine.ts` -- the
first two already existed but were unreachable for lack of this id).

### Dual reminders (24h + 2h)

`ClinicNotificationSettings.secondaryReminderHoursBefore` (default 2h,
`null` to disable) sits alongside the existing `reminderHoursBefore`
(default 24h). `lib/notifications/engine.ts`'s `scheduleAppointmentReminders`
is the one place that schedules every configured reminder for an
appointment -- called from `notifyAppointmentConfirmed`/`Rescheduled` and
directly from `app/actions/appointments.ts`'s `createAppointment` /
`appointment-drafts.ts`'s `approveDraft`. Configurable in Settings >
Notifications.

### Pipeline consolidation

Before this work, two notification code paths coexisted: a legacy
`notifications` table + `lib/notifications/schedule.ts`/`process.ts` (used
only by staff-manual appointment actions) and the modern
`notification_events`/`notification_deliveries` pipeline (used by the
AI-driven lifecycle engine). `app/actions/appointments.ts`'s
`updateAppointmentStatus` now calls `transitionAppointment`
(`lib/ai/appointments`) for confirm/cancel/complete/mark_no_show, exactly
like `app/actions/calendar.ts`'s reschedule action already did -- every
status change gets the same audited FSM, Patient Intelligence hook, and
notification pipeline. `lib/notifications/schedule.ts`, `process.ts`, and
`/api/notifications/process` were removed; the legacy `notifications` table
itself was left in the database (unused, no destructive migration) rather
than dropped. The patient detail page's Notifications card now reads from
`notification_deliveries` (`lib/notifications/queries.ts`'s
`listPatientNotificationDeliveries`).

### Dashboard: Appointment Details WhatsApp panel

`components/calendar/appointment-whatsapp-panel.tsx`, embedded in the
Appointment Details dialog: Send Reminder / Send Confirmation / Send Custom
Message / Send Review Request buttons, plus the most recent WhatsApp
delivery's type/status/timestamp for that appointment
(`lib/notifications/queries.ts`'s `getLatestWhatsAppDeliveryForAppointment`).
Server actions in `app/actions/whatsapp-messages.ts`.

### Communication History

`/clinic/[clinicId]/communications` -- clinic-wide, every channel, newest
first (Time/Patient/Type/Channel/Status/Response columns).
`lib/notifications/queries.ts`'s `listCommunicationHistory`; "Response"
shows a delivered/read timestamp or the provider's failure reason, not the
patient's typed reply (that content lives in `ai_conversations`, a separate
feature not joined against here).

### Settings page

`components/settings/whatsapp-wizard.tsx` now shows, in addition to the
existing connect/reconfigure/disconnect flow: the connected number's
verified business name (from a live Graph API call,
`lib/whatsapp/client.ts`'s `getPhoneNumberProfile`), a Webhook status
badge (a config-presence heuristic -- `WHATSAPP_VERIFY_TOKEN`/
`WHATSAPP_APP_SECRET` both set; Meta doesn't expose a cheap true
subscription check), an API status badge with a **Test Connection** button,
and a **Send Test Message** button (`lib/whatsapp/send.ts`'s
`sendCustomMessage`, no notification_event/delivery bookkeeping since
there's no patient/appointment behind a test ping). The Notifications
settings card also gained a Google review link field
(`ClinicNotificationSettings.googleReviewUrl`), included in the
`appointment_completed` message when set.

### Known limitation: Meta's 24-hour messaging window

Meta only allows **free-form text** messages within 24 hours of the
patient's last inbound message. Outside that window, a proactive/
business-initiated message (a reminder sent days ahead, for instance) must
use a **pre-approved Meta message template** (`type: "template"`) or Meta
rejects the send. `lib/whatsapp/client.ts` implements `sendTemplateMessage`
and is ready for this, but **creating and getting templates approved in
Meta Business Manager is a manual step outside this repo** -- the same
category as the Supabase Auth Hook setup already documented above. Every
send in this integration currently uses free text, matching the behavior
that existed before this work; reminders/confirmations sent to patients who
haven't messaged the clinic recently may fail for this reason until
approved templates are wired in. This is a real product limitation, not a
bug, and is the main piece of "production ready" this integration doesn't
fully close on its own.

### Environment variables

`WHATSAPP_BUSINESS_ACCOUNT_ID` (WABA id, used by the Settings page's health
check and reserved for future template management) and
`NEXT_PUBLIC_WHATSAPP_NUMBER` (display-only connected number) were added
alongside the four existing WhatsApp env vars -- see `.env.example`.

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
- Same for the remaining 6 templates with no underlying feature yet: Magic
  Login Link (needs a passwordless sign-in flow), Payment Receipt /
  Subscription Activated / Subscription Cancelled (need a Stripe webhook
  handler that confirms charges/subscription state and emits the
  corresponding events), and Contact Form Auto Reply / Support Ticket
  Confirmation (need a contact form and a support-ticket system, neither of
  which exist today).
- Enabling the Supabase Dashboard's Send Email hook (see "Auth emails")
  is the one remaining manual step, outside this repo, before Verify
  Email / Password Reset / Staff Invitation actually stop being sent by
  Supabase's own default system in production.
- A stored per-user or per-clinic locale preference, so pre-account emails
  (Verify Email, Password Reset before the recipient has any clinic) don't
  have to default to English for lack of a signal.
- Future SMS support: `lib/notifications/provider.ts`'s `sms` channel
  currently always falls back to the safe logging provider — no real SMS
  provider (Twilio or similar) is wired up. The same `NotificationProvider`
  interface used for email/WhatsApp today would apply unchanged.
- WhatsApp: now fully wired (see "WhatsApp Cloud API integration" above) --
  branded copy, dashboard send panel, delivery status tracking, Communication
  History, and Settings page health checks. The one remaining gap is Meta
  **approved message templates** for proactive sends outside the 24-hour
  customer-service window (`lib/whatsapp/client.ts`'s `sendTemplateMessage`
  is implemented and ready; creating/approving the templates themselves in
  Meta Business Manager is a manual step outside this repo).
- Per-clinic WhatsApp sending: outbound WhatsApp sends currently use one
  global `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` pair for every
  clinic (fine for a single connected number today), while inbound routing
  already supports a per-clinic `whatsapp_phone_number_id`. Sending from
  each clinic's own connected WABA number would need the provider factory
  to resolve credentials per-clinic instead of from process env.
