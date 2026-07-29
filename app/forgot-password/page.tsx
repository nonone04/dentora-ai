"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";

const initialState: AuthFormState = undefined;

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.forgotPassword.title}</CardTitle>
          <CardDescription>{t.forgotPassword.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium">
                {t.forgotPassword.emailLabel}
              </label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            {state?.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
            <Button type="submit" disabled={pending} className="mt-1 w-full">
              {pending ? t.forgotPassword.submitting : t.forgotPassword.submit}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t.forgotPassword.backToLogin}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
