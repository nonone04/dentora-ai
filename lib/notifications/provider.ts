import { InAppNotificationProvider } from "@/lib/notifications/providers/in-app-provider";
import { ResendEmailProvider } from "@/lib/notifications/providers/resend-email-provider";
import { WhatsAppCloudProvider } from "@/lib/notifications/providers/whatsapp-cloud-provider";

/**
 * Widened to add "in_app" -- the Notification & Communication Platform
 * (lib/notifications/engine.ts) delivers staff-facing notifications
 * in-app in addition to email/sms/whatsapp. Backward compatible: every
 * existing caller only ever passed/received the original three values.
 */
export type NotificationChannel = "email" | "sms" | "whatsapp" | "in_app";

export type NotificationMessage = {
  to: string;
  subject?: string;
  body: string;
  /** Optional branded HTML (see lib/email/) -- only ever set on email sends carrying a rendered template. Other channels never read this. */
  html?: string;
};

export type NotificationResult =
  | { success: true; providerMessageId?: string }
  | { success: false; error: string };

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(message: NotificationMessage): Promise<NotificationResult>;
}

/**
 * Foundation-only default: records the intent to a server log instead of
 * actually dispatching anything. This is the swap point for a real
 * provider (Resend, Twilio, WhatsApp Business API, ...) per channel once
 * delivery is ready to go live -- nothing else in the app should need to
 * change, since callers only depend on the NotificationProvider interface.
 */
class LoggingNotificationProvider implements NotificationProvider {
  constructor(public readonly channel: NotificationChannel) {}

  async send(message: NotificationMessage): Promise<NotificationResult> {
    console.log(
      `[notifications:${this.channel}] to=${message.to}${
        message.subject ? ` subject="${message.subject}"` : ""
      } body="${message.body}"`,
    );
    return { success: true };
  }
}

const providers = new Map<NotificationChannel, NotificationProvider>();

function createProvider(channel: NotificationChannel): NotificationProvider {
  if (channel === "in_app") return new InAppNotificationProvider();

  if (channel === "email" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    return new ResendEmailProvider(process.env.RESEND_API_KEY, process.env.EMAIL_FROM);
  }

  if (channel === "whatsapp" && process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return new WhatsAppCloudProvider(process.env.WHATSAPP_ACCESS_TOKEN, process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  // sms has no real provider wired up yet, and email/whatsapp without
  // configured credentials -- fall back to the safe logging default.
  return new LoggingNotificationProvider(channel);
}

export function getNotificationProvider(channel: NotificationChannel): NotificationProvider {
  let provider = providers.get(channel);
  if (!provider) {
    provider = createProvider(channel);
    providers.set(channel, provider);
  }
  return provider;
}
