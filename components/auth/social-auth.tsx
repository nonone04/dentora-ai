"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

/** "or continue with" divider + Google sign-in button, shown below the sign-in/sign-up tabs. */
export function SocialAuth({ next }: { next?: string | null }) {
  const t = useTranslations();

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className="flex items-center gap-3 text-xs font-medium text-white/40">
        <span className="h-px flex-1 bg-white/10" />
        {t.login.orContinueWith}
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form action={signInWithGoogle}>
        {next && <input type="hidden" name="next" value={next} />}
        <GoogleButton label={t.login.continueWithGoogle} redirectingLabel={t.login.redirectingToGoogle} />
      </form>

      <p className="text-center text-xs leading-relaxed text-white/40">{t.login.termsFooter}</p>
    </div>
  );
}

function GoogleButton({ label, redirectingLabel }: { label: string; redirectingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="h-11 w-full gap-2 rounded-xl border-white/10 bg-white/5 text-[15px] font-medium text-white/70 hover:bg-white/10 hover:text-white"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <GoogleIcon className="size-4" aria-hidden="true" />
      )}
      {pending ? redirectingLabel : label}
    </Button>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="currentColor"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="currentColor"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.56.4-2.28V6.63H1.29A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.29 5.37z"
      />
      <path
        fill="currentColor"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
