"use client";

import { useState } from "react";
import { CheckCircle2, Copy, MessageCircle, XCircle } from "lucide-react";
import {
  connectWhatsAppAction,
  disconnectWhatsAppAction,
  sendWhatsAppTestMessageAction,
  testWhatsAppConnectionAction,
} from "@/app/actions/whatsapp-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "@/lib/i18n";
import type { WhatsAppPhoneNumberProfile } from "@/lib/whatsapp/types";
import { cn } from "@/lib/utils";

type Step = "status" | "configure" | "webhook";
type ApiStatus = "unknown" | "connected" | "failed";

function ConnectionStatusPanel({
  clinicId,
  webhookConfigured,
  profile,
  displayNumber,
  phoneNumberId,
}: {
  clinicId: string;
  webhookConfigured: boolean;
  profile: WhatsAppPhoneNumberProfile | null;
  displayNumber: string;
  phoneNumberId: string;
}) {
  const t = useTranslations();
  const wt = t.settings.whatsappWizard.apiStatus;

  const [currentProfile, setCurrentProfile] = useState(profile);
  const [apiStatus, setApiStatus] = useState<ApiStatus>(profile ? "connected" : "unknown");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  async function handleTestConnection() {
    setTesting(true);
    setTestError(null);
    const result = await testWhatsAppConnectionAction(clinicId);
    setTesting(false);
    if (!result.ok) {
      setApiStatus("failed");
      setTestError(result.message);
      return;
    }
    setApiStatus("connected");
    setCurrentProfile(result.profile);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <span className="text-xs font-semibold text-muted-foreground">{wt.title}</span>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div>
          <div className="text-xs text-muted-foreground">{wt.businessNameLabel}</div>
          <div className="font-medium">{currentProfile?.verifiedName || t.common.dash}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{wt.phoneLabel}</div>
          <div className="font-medium" dir="ltr">
            {currentProfile?.displayPhoneNumber || displayNumber || phoneNumberId || t.common.dash}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{wt.webhookLabel}</div>
          <Badge variant={webhookConfigured ? "default" : "outline"} className="mt-0.5">
            {webhookConfigured ? wt.webhookConfigured : wt.webhookNotConfigured}
          </Badge>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{wt.apiLabel}</div>
          <Badge variant={apiStatus === "connected" ? "default" : apiStatus === "failed" ? "destructive" : "outline"} className="mt-0.5">
            {apiStatus === "connected" ? wt.apiConnected : apiStatus === "failed" ? wt.apiFailed : wt.apiUnknown}
          </Badge>
        </div>
      </div>
      {testError && <p className="text-xs text-destructive">{testError}</p>}
      <Button type="button" size="sm" variant="outline" className="w-fit gap-1.5" disabled={testing} onClick={handleTestConnection}>
        {apiStatus === "connected" ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : apiStatus === "failed" ? <XCircle className="size-3.5" aria-hidden="true" /> : null}
        {testing ? wt.testing : wt.testConnection}
      </Button>
    </div>
  );
}

function TestMessagePanel({ clinicId }: { clinicId: string }) {
  const t = useTranslations();
  const wt = t.settings.whatsappWizard.testMessage;
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSend() {
    setPending(true);
    setError(null);
    setSuccess(false);
    const result = await sendWhatsAppTestMessageAction(clinicId, phone);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSuccess(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{wt.title}</p>
      <p className="text-xs text-muted-foreground">{wt.description}</p>
      <div className="flex flex-wrap gap-2">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder={wt.phonePlaceholder} className="w-48" />
        <Button type="button" size="sm" disabled={pending || !phone.trim()} onClick={handleSend}>
          {pending ? wt.sending : wt.send}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-muted-foreground">{wt.success}</p>}
    </div>
  );
}

export function WhatsAppWizard({
  clinicId,
  initialConnected,
  initialDisplayNumber,
  initialPhoneNumberId,
  webhookConfigured,
  initialProfile,
}: {
  clinicId: string;
  initialConnected: boolean;
  initialDisplayNumber: string | null;
  initialPhoneNumberId: string | null;
  webhookConfigured: boolean;
  initialProfile: WhatsAppPhoneNumberProfile | null;
}) {
  const t = useTranslations();
  const wt = t.settings.whatsappWizard;

  const [connected, setConnected] = useState(initialConnected);
  const [displayNumber, setDisplayNumber] = useState(initialDisplayNumber ?? "");
  const [phoneNumberId, setPhoneNumberId] = useState(initialPhoneNumberId ?? "");
  const [step, setStep] = useState<Step>("status");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "";

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await connectWhatsAppAction(clinicId, displayNumber, phoneNumberId);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setConnected(true);
    setStep("webhook");
  }

  async function handleDisconnect() {
    setPending(true);
    const result = await disconnectWhatsAppAction(clinicId);
    setPending(false);
    if (result.ok) {
      setConnected(false);
      setPhoneNumberId("");
      setDisconnectConfirmOpen(false);
      setStep("status");
    } else {
      setError(result.message);
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <ConnectionStatusPanel
        clinicId={clinicId}
        webhookConfigured={webhookConfigured}
        profile={initialProfile}
        displayNumber={displayNumber}
        phoneNumberId={phoneNumberId}
      />

      {step === "status" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                connected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
              )}
            >
              <MessageCircle className="size-4.5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium">{connected ? wt.status.connected : wt.status.notConnected}</p>
              {connected && (displayNumber || phoneNumberId) && (
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {displayNumber || phoneNumberId}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setStep("configure")}>
              {connected ? wt.status.reconfigure : wt.status.start}
            </Button>
            {connected && (
              <Button type="button" size="sm" variant="destructive" onClick={() => setDisconnectConfirmOpen(true)}>
                {wt.status.disconnect}
              </Button>
            )}
          </div>
        </div>
      )}

      {step === "configure" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{wt.configure.description}</p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{wt.configure.displayNumberLabel}</label>
            <Input value={displayNumber} onChange={(e) => setDisplayNumber(e.target.value)} dir="ltr" placeholder="+212600000000" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{wt.configure.phoneNumberIdLabel}</label>
            <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} dir="ltr" placeholder="1234567890" />
            <p className="text-xs text-muted-foreground">{wt.configure.phoneNumberIdHelp}</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setStep("status")} disabled={pending}>
              {wt.configure.back}
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
              {pending ? wt.configure.saving : wt.configure.save}
            </Button>
          </div>
        </div>
      )}

      {step === "webhook" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {wt.webhook.success}
          </div>
          <p className="text-sm text-muted-foreground">{wt.webhook.description}</p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-xs" dir="ltr">
              {webhookUrl}
            </code>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={copyWebhookUrl}>
              <Copy className="size-3.5" aria-hidden="true" />
              {copied ? wt.webhook.copied : wt.webhook.copy}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{wt.webhook.tokenNote}</p>
          <Button type="button" size="sm" className="w-fit" onClick={() => setStep("status")}>
            {wt.webhook.done}
          </Button>
        </div>
      )}

      <Separator />

      <TestMessagePanel clinicId={clinicId} />

      <ConfirmDialog
        open={disconnectConfirmOpen}
        onOpenChange={setDisconnectConfirmOpen}
        title={wt.disconnectDialog.title}
        description={wt.disconnectDialog.description}
        confirmLabel={wt.status.disconnect}
        pendingLabel={t.common.saving}
        cancelLabel={t.common.cancel}
        onConfirm={handleDisconnect}
        pending={pending}
        error={error}
      />
    </div>
  );
}
