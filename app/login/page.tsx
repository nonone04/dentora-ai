"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Mail, User } from "lucide-react";
import { signIn, signUp, type AuthFormState } from "@/app/actions/auth";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { SocialAuth } from "@/components/auth/social-auth";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "@/lib/i18n";

const initialState: AuthFormState = undefined;

export default function LoginPage() {
  const t = useTranslations();

  return (
    <AuthShell t={t}>
      <div className="flex flex-col gap-1.5 text-center sm:text-start">
        <h2 className="text-2xl font-semibold tracking-tight text-white">{t.login.title}</h2>
        <p className="text-sm text-white/50">{t.login.description}</p>
      </div>

      <Tabs defaultValue="signin" className="mt-7">
        <TabsList variant="line" className="mb-6 h-9 w-full justify-start gap-6 border-b border-white/10 bg-transparent p-0">
          <TabsTrigger
            value="signin"
            className="rounded-none px-0 pb-3 text-sm font-medium text-white/45 after:bg-blue-400 data-active:bg-transparent data-active:text-white"
          >
            {t.login.signIn}
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="rounded-none px-0 pb-3 text-sm font-medium text-white/45 after:bg-blue-400 data-active:bg-transparent data-active:text-white"
          >
            {t.login.signUp}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="signin">
          <Suspense>
            <SignInForm />
          </Suspense>
        </TabsContent>
        <TabsContent value="signup">
          <SignUpForm />
        </TabsContent>
      </Tabs>

      <SocialAuth />
    </AuthShell>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function FormNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  const t = useTranslations();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("resetSuccess") === "1";
  const oauthError = searchParams.get("error") === "oauth";

  return (
    <form action={action} className="flex flex-col gap-4">
      <AuthField label={t.login.email} name="email" type="email" icon={Mail} autoComplete="email" required />
      <PasswordField label={t.login.password} name="password" autoComplete="current-password" required />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-white/60">
          <Checkbox
            name="rememberMe"
            defaultChecked
            className="border-white/20 bg-white/5 data-[checked]:border-blue-500 data-[checked]:bg-blue-500"
          />
          {t.login.rememberMe}
        </label>
        <Link href="/forgot-password" className="text-sm font-medium text-blue-300 underline-offset-4 hover:underline">
          {t.login.forgotPasswordLink}
        </Link>
      </div>
      {resetSuccess && <FormNotice>{t.login.resetSuccess}</FormNotice>}
      {oauthError && <FormError>{t.login.oauthError}</FormError>}
      {state?.error && <FormError>{state.error}</FormError>}
      <AuthButton type="submit" disabled={pending} className="mt-1">
        {pending ? t.login.signingIn : t.login.signIn}
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        )}
      </AuthButton>
    </form>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialState);
  const t = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-4">
      <AuthField label={t.login.fullName} name="fullName" type="text" icon={User} autoComplete="name" required />
      <AuthField label={t.login.email} name="email" type="email" icon={Mail} autoComplete="email" required />
      <PasswordField label={t.login.password} name="password" autoComplete="new-password" required minLength={8} />
      {state?.error && <FormError>{state.error}</FormError>}
      {state?.message && <FormNotice>{state.message}</FormNotice>}
      <AuthButton type="submit" disabled={pending} className="mt-1">
        {pending ? t.login.signingUp : t.login.signUp}
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        )}
      </AuthButton>
    </form>
  );
}
