import type { ReactNode } from "react";

/**
 * Horizontally scrollable container that keyboard-only readers can focus and scroll
 * (WCAG 2.1.1). The label names the table or chart so the region is announced meaningfully.
 */
export default function ScrollRegion({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={["scroll-region overflow-x-auto", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
