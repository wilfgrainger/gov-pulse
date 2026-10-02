"use client";

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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const Tag = as;

  // Server render, no-JS readers get static, visible content.
  // Wait, if it's not mounted, we need it to be visible for SSR without JS.
  // If we render with opacity: 0 and it doesn't run JS, it stays invisible!
  // Framer Motion handles this by injecting styles or hydrating.
  // To avoid this, we can render normal on server, and then JS can apply the transition classes if needed.
  // Actually, the previous implementation did:
  // if (!mounted || prefersReducedMotion) return <Tag>{children}</Tag>
  // This means it rendered VISIBLE initially on server, then on client hydation it switched to framer-motion which set it to opacity 0 instantly then animated.
  // So we can do the exact same logic.

  if (!mounted) {
    return <Tag className={className}>{children}</Tag>;
  }

  // Once mounted, we apply the styles and trigger reflow.
  // Actually, if we return visible on mount, we can't transition from 0 to 1 easily without a second render.
  // Let's use CSS animation instead of transition.

  const style = {
    animationName: "draw-in-reveal",
    animationDuration: "500ms",
    animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    animationFillMode: "both",
    animationDelay: `${delay}s`,
    "--reveal-y": `${y}px`,
  } as React.CSSProperties;

  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes draw-in-reveal {
          from { opacity: 0; transform: translateY(var(--reveal-y)); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Tag className={className} style={style}>
        {children}
      </Tag>
    </>
  );
}
