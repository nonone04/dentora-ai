"use server";

import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { sendTemplatedEmail } from "@/lib/email/send";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { getServerDictionary } from "@/lib/i18n/server";
import { isContactInquiryType } from "@/lib/marketing/contact";
import { getNotificationProvider } from "@/lib/notifications/provider";
import { track } from "@/lib/telemetry";

export type ContactFormState = { error?: string; success?: boolean } | undefined;

const IP_RATE_LIMIT = 5;
const EMAIL_RATE_LIMIT = 3;
const RATE_WINDOW_MS = 15 * 60 * 1000;

async function getClientIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Public Contact Sales form -- replaces the Enterprise/Custom plan CTA
 * that used to link straight to /login (see components/marketing/pricing-content.tsx).
 * Sends the visitor the already-built `contact_auto_reply` template
 * (lib/email/templates/contact-auto-reply.ts, previously unwired) and
 * notifies the sales inbox directly via the notification provider --
 * there's no lead-tracking system yet, so email is the whole pipeline.
 */
export async function submitContactRequest(_prevState: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const t = await getServerDictionary();
  const name = formData.get("name");
  const email = formData.get("email");
  const company = formData.get("company");
  const message = formData.get("message");
  const inquiryTypeField = formData.get("inquiryType");
  const inquiryType = isContactInquiryType(inquiryTypeField) ? inquiryTypeField : "general";

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
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

  const subjectLine = t.marketing.contact.inquiryTypes[inquiryType];
  const trimmedName = name.trim();
  const trimmedCompany = typeof company === "string" ? company.trim() : "";
  const companyLine = trimmedCompany ? `\nClinic/Company: ${trimmedCompany}` : "";

  const salesInbox = process.env.EMAIL_SUPPORT || "support@dentora.ai";
  const salesNotification = await getNotificationProvider("email").send({
    to: salesInbox,
    subject: `[Contact Sales] ${subjectLine} -- ${trimmedName}`,
    body: `Name: ${trimmedName}\nEmail: ${normalizedEmail}${companyLine}\nInquiry: ${subjectLine}\n\n${message.trim()}`,
  });
  if (!salesNotification.success) {
    console.error(`[contact] failed to notify sales inbox for ${normalizedEmail}: ${salesNotification.error}`);
  }

  const language = await getServerLocale();
  const autoReply = await sendTemplatedEmail(
    "contact_auto_reply",
    normalizedEmail,
    { recipientName: trimmedName, subjectLine, expectedResponseTime: t.marketing.contact.form.expectedResponseTime },
    language,
  );
  if (!autoReply.success) {
    // Best-effort -- the sales notification above already went out, so the
    // visitor's request isn't lost even if their confirmation email fails.
    console.error(`[contact] failed to send auto-reply to ${normalizedEmail}: ${autoReply.error}`);
  }

  await track({ name: "Contact Sales Submitted", properties: { inquiryType } });

  return { success: true };
}
