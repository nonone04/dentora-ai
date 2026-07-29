import Link from "next/link";
import type { ResponseLanguage } from "@/lib/ai/nlu/language";
import { isResponseLanguage } from "@/lib/ai/nlu/language";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EMAIL_CATEGORIES, EMAIL_TEMPLATE_IDS, type EmailCategory, type EmailTemplateId } from "@/lib/email/types";
import { EMAIL_TEMPLATES } from "@/lib/email/registry";
import type { EmailColorScheme } from "@/lib/email/brand";
import { requirePlatformAdmin } from "@/lib/telemetry/admin-access";

type Device = "desktop" | "mobile";
type Theme = "light" | "dark";

const DEVICE_WIDTH: Record<Device, string> = { desktop: "640px", mobile: "375px" };

const CATEGORY_LABEL: Record<EmailCategory, string> = {
  account: "Account",
  team: "Team",
  appointments: "Appointments",
  billing: "Billing",
};

function isEmailTemplateId(value: string | undefined): value is EmailTemplateId {
  return !!value && (EMAIL_TEMPLATE_IDS as readonly string[]).includes(value);
}

function buildHref(params: { template: string; device: Device; theme: Theme; lang: ResponseLanguage }) {
  const search = new URLSearchParams(params);
  return `/admin/email-preview?${search.toString()}`;
}

function ToolbarLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
          : "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }
    >
      {label}
    </Link>
  );
}

/**
 * Internal-only preview of every branded email template -- gated by the
 * same platform-admin allowlist as /admin/analytics (ANALYTICS_ADMIN_EMAILS).
 * Pure server-rendered navigation (plain <Link>s updating the query
 * string) since nothing here needs client-side interactivity. The iframe
 * isolates the email's own inline/`<style>` markup from the app's
 * Tailwind so it renders exactly as an email client would.
 */
export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; device?: string; theme?: string; lang?: string }>;
}) {
  await requirePlatformAdmin();

  const params = await searchParams;
  const templateId: EmailTemplateId = isEmailTemplateId(params.template) ? params.template : "welcome";
  const device: Device = params.device === "mobile" ? "mobile" : "desktop";
  const theme: Theme = params.theme === "dark" ? "dark" : "light";
  const lang: ResponseLanguage = isResponseLanguage(params.lang ?? "") ? (params.lang as ResponseLanguage) : "en";

  const entry = EMAIL_TEMPLATES[templateId];
  const forceColorScheme: EmailColorScheme | undefined = theme === "dark" ? "dark" : undefined;
  const rendered = entry.render(entry.sampleProps, lang, { forceColorScheme });

  const templatesByCategory = EMAIL_CATEGORIES.map((category) => ({
    category,
    templates: EMAIL_TEMPLATE_IDS.filter((id) => EMAIL_TEMPLATES[id].category === category),
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold">Email template preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal-only. &ldquo;Wired&rdquo; templates are sent by real app code today; &ldquo;Ready&rdquo; templates are built and
          branded but not yet triggered by anything -- see docs/customer-communications.md.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-4">
          {templatesByCategory.map(({ category, templates }) => (
            <div key={category} className="flex flex-col gap-1">
              <p className="px-2 text-xs font-semibold text-muted-foreground">{CATEGORY_LABEL[category]}</p>
              {templates.map((id) => {
                const active = id === templateId;
                return (
                  <Link
                    key={id}
                    href={buildHref({ template: id, device, theme, lang })}
                    className={
                      active
                        ? "flex items-center justify-between rounded-md bg-accent px-2 py-1.5 text-sm font-medium text-accent-foreground"
                        : "flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                    }
                  >
                    <span className="truncate">{id}</span>
                    <Badge variant={EMAIL_TEMPLATES[id].status === "wired" ? "outline" : "secondary"} className="shrink-0">
                      {EMAIL_TEMPLATES[id].status}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <ToolbarLink active={device === "desktop"} href={buildHref({ template: templateId, device: "desktop", theme, lang })} label="Desktop" />
              <ToolbarLink active={device === "mobile"} href={buildHref({ template: templateId, device: "mobile", theme, lang })} label="Mobile" />
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <ToolbarLink active={theme === "light"} href={buildHref({ template: templateId, device, theme: "light", lang })} label="Light" />
              <ToolbarLink active={theme === "dark"} href={buildHref({ template: templateId, device, theme: "dark", lang })} label="Dark" />
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              {(["en", "fr", "ar"] as const).map((code) => (
                <ToolbarLink
                  key={code}
                  active={lang === code}
                  href={buildHref({ template: templateId, device, theme, lang: code })}
                  label={code.toUpperCase()}
                />
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-1 border-b border-border pb-4">
              <span className="text-xs font-medium text-muted-foreground">Subject</span>
              <span className="text-sm font-medium">{rendered.subject}</span>
            </CardContent>
            <CardContent className="flex justify-center overflow-x-auto bg-muted/40 py-8">
              <iframe
                title={`${templateId} preview`}
                srcDoc={rendered.html}
                sandbox=""
                style={{ width: DEVICE_WIDTH[device], height: "720px", border: "none", background: "white" }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
