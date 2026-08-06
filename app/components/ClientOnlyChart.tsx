"use client";

import { useEffect, useRef, useState } from "react";

interface ClientOnlyChartProps {
  children: React.ReactNode;
  heightClass: string;
  fallbackLabel?: React.ReactNode;
}

export default function ClientOnlyChart({
  children,
  heightClass,
  fallbackLabel = "Interactive chart unavailable. The published figures remain available in the surrounding summary and source information.",
}: ClientOnlyChartProps) {
  const [mounted, setMounted] = useState(false);
  const [hasSize, setHasSize] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame: number | null = null;
    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setHasSize(width > 0 && height > 0);
    };

    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateSize)
      : null;
    observer?.observe(container);
    frame = window.requestAnimationFrame(() => {
      setMounted(true);
      updateSize();
    });

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={`chart-shell min-w-0 ${heightClass}`}>
      {mounted && hasSize ? (
        children
      ) : (
        <div className="flex h-full flex-col justify-between border border-black/10 bg-[#fbfaf7] p-5 animate-pulse" aria-busy="true">
          <span className="sr-only">{fallbackLabel}</span>
          <div className="flex justify-between items-center">
            <div className="h-3 w-24 bg-gray-200/80 rounded"></div>
            <div className="h-3 w-16 bg-gray-200/80 rounded"></div>
          </div>
          <div className="flex items-end gap-2 h-36 mt-4">
            <div className="h-[20%] w-full bg-gray-200/60 rounded-sm"></div>
            <div className="h-[40%] w-full bg-gray-200/60 rounded-sm"></div>
            <div className="h-[30%] w-full bg-gray-200/60 rounded-sm"></div>
            <div className="h-[65%] w-full bg-gray-200/60 rounded-sm"></div>
            <div className="h-[50%] w-full bg-gray-200/60 rounded-sm"></div>
            <div className="h-[85%] w-full bg-gray-200/60 rounded-sm"></div>
            <div className="h-[75%] w-full bg-gray-200/60 rounded-sm"></div>
            <div className="h-[90%] w-full bg-gray-200/60 rounded-sm"></div>
          </div>
          <div className="mt-4 flex gap-4">
            <div className="h-2 w-16 bg-gray-200/80 rounded"></div>
            <div className="h-2 w-16 bg-gray-200/80 rounded"></div>
          </div>
        </div>
      )}
    </div>
  );
}
