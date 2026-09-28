"use client";

import { m, LazyMotion, domAnimation, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

type RevealProps = {
  children: React.ReactNode;
  /** Delay in seconds before the entrance begins. */
  delay?: number;
  /** Vertical offset in pixels for the entrance. Kept small to avoid distraction. */
  y?: number;
  /** Optional element tag to render. Defaults to a div. */
  as?: "div" | "section" | "article" | "li";
  className?: string;
};

/**
 * Restrained entrance wrapper.
 *
 * Content is fully visible for server-rendered and no-JS readers: the entrance
 * only applies once the component has mounted on the client. Under
 * prefers-reduced-motion it renders statically with no animation. The entrance
 * uses opacity and a small translate that does not affect layout, so it never
 * introduces cumulative layout shift.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 12,
  as = "div",
  className,
}: RevealProps) {
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Server render, no-JS, and reduced-motion readers get static, visible content.
  if (!mounted || prefersReducedMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const MotionTag = m[as];

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionTag
        className={className}
        initial={{ opacity: 0, y }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </MotionTag>
    </LazyMotion>
  );
}
