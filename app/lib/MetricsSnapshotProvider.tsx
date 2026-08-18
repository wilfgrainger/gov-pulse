"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MetricsSnapshot } from "./metricsSnapshot";

const MetricsSnapshotContext = createContext<MetricsSnapshot | null>(null);

export function MetricsSnapshotProvider({
  snapshot,
  children,
}: {
  snapshot: MetricsSnapshot | null;
  children: ReactNode;
}) {
  return (
    <MetricsSnapshotContext.Provider value={snapshot}>
      {children}
    </MetricsSnapshotContext.Provider>
  );
}

export function useInitialMetricsSnapshot() {
  return useContext(MetricsSnapshotContext);
}
