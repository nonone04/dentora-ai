"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "@/lib/i18n";

const initialState: AuthFormState = undefined;

export default function LoginPage() {
  const t = useTranslations();

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.login.title}</CardTitle>
          <CardDescription>{t.login.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="signin" className="flex-1">
                {t.login.signIn}
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
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
        </CardContent>
      </Card>
    </div>
  );
}

function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  const t = useTranslations();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("resetSuccess") === "1";

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label={t.login.email} name="email" type="email" autoComplete="email" required />
      <Field
        label={t.login.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox name="rememberMe" defaultChecked />
          {t.login.rememberMe}
        </label>
        <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t.login.forgotPasswordLink}
        </Link>
      </div>
      {resetSuccess && <p className="text-sm text-muted-foreground">{t.login.resetSuccess}</p>}
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? t.login.signingIn : t.login.signIn}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialState);
  const t = useTranslations();

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label={t.login.fullName} name="fullName" type="text" autoComplete="name" required />
      <Field label={t.login.email} name="email" type="email" autoComplete="email" required />
      <Field
        label={t.login.password}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? t.login.signingUp : t.login.signUp}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
