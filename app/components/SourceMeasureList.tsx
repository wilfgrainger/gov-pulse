"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

type Item = { id: string; node: ReactNode };

function Filtered({ items }: { items: Item[] }) {
  const measure = useSearchParams()?.get("measure") ?? null;
  if (measure === null) return <>{items.map((item) => item.node)}</>;
  const match = items.filter((item) => item.id === measure);
  return match.length
    ? <>{match.map((item) => item.node)}</>
    : <li role="status" className="p-4 text-sm">This measure is not in this source collection.</li>;
}

/** Static export cannot read ?measure= on the server; the browser narrows the list instead. */
export default function SourceMeasureList({ items }: { items: Item[] }) {
  return <Suspense fallback={<>{items.map((item) => item.node)}</>}><Filtered items={items} /></Suspense>;
}
