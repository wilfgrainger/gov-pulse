"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** The exact numeric value to count up to. */
  value: number;
  /**
   * Formats the final (and every intermediate) displayed value. Must be the
   * SAME formatter used for the static value elsewhere, so the animation
   * never shows a representation the data itself didn't produce.
   */
  format: (value: number) => string;
  /** Animation duration in ms. Kept short — this is a flourish, not a loader. */
  durationMs?: number;
  className?: string;
};

/**
 * Animates a headline figure counting up from 0 to its real, already-known
 * value on mount. Purely decorative: the server-rendered and no-JS reader
 * sees the final formatted value immediately (no layout shift, no missing
 * content), and a user with prefers-reduced-motion sees the same static
 * final value with no animation at all. Never fabricates or interpolates a
 * value that doesn't appear in the underlying data — it only animates the
 * reveal of a value that's already been computed.
 */
export default function CountUpNumber({ value, format, durationMs = 900, className }: Props) {
  const [animated, setAnimated] = useState(false);
  const frameRef = useRef<number | null>(null);
  const displayRef = useRef<HTMLSpanElement>(null);

  // Defer the "start animating" flag to a rAF callback (not the effect body
  // itself) so the setState driving the entrance is never synchronous within
  // the effect — matches the mount-detection pattern already used by
  // app/components/Reveal.tsx.
  useEffect(() => {
    const prefersReducedMotion = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
    if (prefersReducedMotion || !Number.isFinite(value)) return;
    const frame = window.requestAnimationFrame(() => setAnimated(true));
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  useEffect(() => {
    if (!animated || !displayRef.current) return;
    const node = displayRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic: fast start, settles precisely on the real value.
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = format(value * eased);
      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        node.textContent = format(value);
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [animated, value, format, durationMs]);

  // Server render / no-JS / reduced-motion: show the real final value,
  // static, with no separate SR-only duplicate needed since nothing animates.
  if (!animated) {
    return <span className={className}>{format(value)}</span>;
  }

  // Once animating, assistive tech gets the real, final, static value via a
  // visually-hidden span; the visible animated span (updated imperatively via
  // the ref above, not re-render) is hidden from AT so a screen reader never
  // reads out the transient in-between numbers.
  return (
    <span className={className}>
      <span ref={displayRef} aria-hidden="true">{format(0)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
