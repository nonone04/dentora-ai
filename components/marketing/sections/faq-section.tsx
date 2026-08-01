"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Reveal } from "@/components/marketing/motion/reveal";
import { SectionBackground } from "@/components/marketing/motion/section-background";
import { useTranslations } from "@/lib/i18n";

export function FaqSection() {
  const t = useTranslations();
  const items = t.marketing.home.faq.items;

  return (
    <section className="defer-offscreen relative overflow-hidden bg-white py-20 dark:bg-slate-950 md:py-24">
      <SectionBackground intensity="subtle" />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-10 text-center md:mb-12">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-900 md:text-4xl md:font-semibold dark:text-white">
            {t.marketing.home.faq.title}
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <Accordion className="divide-y divide-slate-200 rounded-2xl border border-slate-200/80 bg-white px-5 md:px-6 dark:divide-white/10 dark:border-white/10 dark:bg-slate-900">
            {items.map((item) => (
              <AccordionItem key={item.question} value={item.question} className="border-slate-200 py-1.5 dark:border-white/10">
                <AccordionTrigger className="min-h-12 py-5 text-base font-medium text-slate-900 md:py-4 dark:text-white">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
