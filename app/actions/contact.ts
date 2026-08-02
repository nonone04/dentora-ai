"use server";

import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { sendTemplatedEmail } from "@/lib/email/send";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { getServerDictionary } from "@/lib/i18n/server";
import { isContactInquiryType } from "@/lib/marketing/contact";
import { track } from "@/lib/telemetry";

export type ContactFormState = { error?: string; success?: boolean } | undefined;

const IP_RATE_LIMIT = 5;
const EMAIL_RATE_LIMIT = 3;
const RATE_WINDOW_MS = 15 * 60 * 1000;

async function getClientIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function optionalField(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Public Contact page -- serves both the general "get in touch" form and
 * the Custom Plan/Enterprise pricing CTA (components/marketing/pricing-content.tsx
 * links straight here since Enterprise has no Stripe checkout, see
 * lib/marketing/pricing-plans.ts). One shared pipeline, routed by
 * `inquiryType`: Custom Plan inquiries (which also collect clinic-sizing
 * details -- country, dentist/clinic counts, current software, requested
 * features) notify the sales inbox alone, everything else notifies the
 * general + support inboxes. Sends the visitor the already-built
 * `contact_auto_reply` template either way. There's no lead-tracking system
 * yet, so email is the whole pipeline -- see lib/email/templates/contact-sales-notification.ts.
 */
export async function submitContactRequest(_prevState: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const t = await getServerDictionary();
  const name = formData.get("name");
  const email = formData.get("email");
  const phone = formData.get("phone");
  const message = formData.get("message");
  const inquiryTypeField = formData.get("inquiryType");
  const inquiryType = isContactInquiryType(inquiryTypeField) ? inquiryTypeField : "general";

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof phone !== "string" ||
    !phone.trim() ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    return { error: t.marketing.contact.form.error };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const ip = await getClientIp();

  if (
    !checkRateLimit(`contact:ip:${ip}`, IP_RATE_LIMIT, RATE_WINDOW_MS) ||
    !checkRateLimit(`contact:email:${normalizedEmail}`, EMAIL_RATE_LIMIT, RATE_WINDOW_MS)
  ) {
    return { error: t.marketing.contact.form.rateLimited };
  }

  const inquiryLabel = t.marketing.contact.inquiryTypes[inquiryType];
  const trimmedName = name.trim();
  const isCustomPlan = inquiryType === "enterprise";

  const notificationProps = {
    inquiryLabel,
    contactName: trimmedName,
    email: normalizedEmail,
    phone: phone.trim(),
    clinicName: optionalField(formData, "company"),
    country: optionalField(formData, "country"),
    dentistCount: optionalField(formData, "dentistCount"),
    clinicCount: optionalField(formData, "clinicCount"),
    currentSoftware: optionalField(formData, "currentSoftware"),
    requestedFeatures: optionalField(formData, "requestedFeatures"),
    message: message.trim(),
  };

  const notificationInboxes = isCustomPlan
    ? [process.env.EMAIL_SALES || "contact@dentora.vip"]
    : [process.env.EMAIL_GENERAL || "hello@dentora.vip", process.env.EMAIL_SUPPORT || "support@dentora.vip"];

  const notificationResults = await Promise.all(
    notificationInboxes.map((to) => sendTemplatedEmail("contact_sales_notification", to, notificationProps, "en")),
  );
  notificationResults.forEach((result, index) => {
    if (!result.success) {
      console.error(`[contact] failed to notify ${notificationInboxes[index]} for ${normalizedEmail}: ${result.error}`);
    }
  });

  const language = await getServerLocale();
  const autoReply = await sendTemplatedEmail(
    "contact_auto_reply",
    normalizedEmail,
    { recipientName: trimmedName, subjectLine: inquiryLabel, expectedResponseTime: t.marketing.contact.form.expectedResponseTime },
    language,
  );
  if (!autoReply.success) {
    // Best-effort -- the inbox notification above already went out, so the
    // visitor's request isn't lost even if their confirmation email fails.
    console.error(`[contact] failed to send auto-reply to ${normalizedEmail}: ${autoReply.error}`);
  }

  await track({ name: "Contact Sales Submitted", properties: { inquiryType } });

  return { success: true };
}
