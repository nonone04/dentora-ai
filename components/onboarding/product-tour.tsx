"use client";

import { useEffect, useState } from "react";
import { completeOnboardingTourAction } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

const STEP_IDS = ["overview", "calendar", "ai-inbox", "patients", "staff", "settings"] as const;
type StepId = (typeof STEP_IDS)[number];

type Rect = { top: number; left: number; width: number; height: number };

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function ProductTour() {
  const t = useTranslations();
  const [stepIds, setStepIds] = useState<StepId[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Only nav items actually rendered for this user's role (and visible at
  // this viewport width) become tour stops -- discovered once on mount by
  // probing the DOM, since role visibility is server-decided and can't be
  // known from this component's props alone. The state update is queued
  // as a microtask (rather than called inline) so it's a callback
  // reacting to the DOM, not a synchronous render-cascading effect body.
  useEffect(() => {
    queueMicrotask(() => {
      const present = STEP_IDS.filter((stepId) => document.querySelector(`[data-tour="${stepId}"]`) !== null);
      setStepIds(present.length > 0 ? present : []);
    });
  }, []);

  const currentId = stepIds?.[stepIndex];

  useEffect(() => {
    if (!currentId) {
      queueMicrotask(() => setRect(null));
      return;
    }

    const target = document.querySelector(`[data-tour="${currentId}"]`);
    if (!target) {
      queueMicrotask(() => setRect(null));
      return;
    }

    const update = () => setRect(measure(target));
    queueMicrotask(update);

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [currentId]);

  if (dismissed || !stepIds || stepIds.length === 0 || !currentId) {
    return null;
  }

  const step = t.onboardingTour.steps[currentId];
  const isLast = stepIndex === stepIds.length - 1;

  function finish() {
    setDismissed(true);
    void completeOnboardingTourAction();
  }

  function next() {
    if (isLast) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  const tooltipTop = rect ? Math.min(rect.top + rect.height + 12, window.innerHeight - 220) : 0;
  const tooltipLeft = rect ? Math.min(Math.max(rect.left, 16), window.innerWidth - 320) : 0;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={t.onboardingTour.title}>
      <div className="absolute inset-0 bg-black/50" onClick={finish} aria-hidden="true" />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-black/50 transition-all duration-200"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <div
        className="absolute w-72 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-all duration-200"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <p className="text-xs font-medium text-muted-foreground">
          {stepIndex + 1} / {stepIds.length}
        </p>
        <h2 className="mt-1 font-semibold">{step.title}</h2>
        <p className="mt-1 text-muted-foreground">{step.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            {t.onboardingTour.skip}
          </Button>
          <Button type="button" size="sm" onClick={next}>
            {isLast ? t.onboardingTour.finish : t.onboardingTour.next}
          </Button>
        </div>
      </div>
    </div>
  );
}
