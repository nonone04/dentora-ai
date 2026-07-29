"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";

export type TextRevealSegment = { text: string } | { node: React.ReactNode };

type Word = { key: string; content: React.ReactNode };

/**
 * A "node" segment (e.g. the hero's bg-clip-text gradient-highlight span,
 * itself a separately-translated string) is kept as a single atomic word
 * -- splitting a gradient-clipped span into per-word sub-spans would
 * require re-applying background-clip per word, which is fragile and adds
 * nothing visually. Only plain "text" segments are split on whitespace.
 */
function buildWords(segments: TextRevealSegment[]): Word[] {
  const words: Word[] = [];
  let index = 0;
  for (const segment of segments) {
    if ("node" in segment) {
      words.push({ key: `n${index++}`, content: segment.node });
      continue;
    }
    for (const part of segment.text.split(" ").filter(Boolean)) {
      words.push({ key: `w${index++}`, content: part });
    }
  }
  return words;
}

const WORD_STAGGER_SECONDS = 0.045;

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: WORD_STAGGER_SECONDS } },
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

/**
 * Word-by-word headline reveal, ~45ms/word so a typical 6-10 word
 * headline finishes within ~500ms, leaving the rest of the ~1s hero
 * sequence budget for the paragraph/buttons/badges that follow.
 *
 * The animated word spans are `aria-hidden` and the full text is instead
 * exposed via the parent's `aria-label` (see hero-section.tsx) -- this
 * sidesteps any risk of a screen reader announcing per-word fragments
 * instead of the whole heading as one accessible name.
 */
export function TextReveal({ segments, className }: { segments: TextRevealSegment[]; className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  const words = buildWords(segments);

  if (shouldReduceMotion) {
    return (
      <span className={className} aria-hidden="true">
        {words.flatMap((word, index) => [
          <span key={word.key}>{word.content}</span>,
          index < words.length - 1 ? " " : null,
        ])}
      </span>
    );
  }

  return (
    <motion.span className={className} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.6 }} variants={containerVariants} aria-hidden="true">
      {words.flatMap((word, index) => [
        <motion.span key={word.key} variants={wordVariants} style={{ display: "inline-block" }}>
          {word.content}
        </motion.span>,
        index < words.length - 1 ? " " : null,
      ])}
    </motion.span>
  );
}
