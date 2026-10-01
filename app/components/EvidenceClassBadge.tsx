import { EVIDENCE_CLASS_LABELS, type EvidenceClass } from "@/app/lib/config";

const TONE: Record<EvidenceClass, string> = {
  "official-data": "border-[#14243b] bg-[#eef1f4] text-[#14243b]",
  "public-opinion": "border-[#5b3a8a] bg-[#f1ecf8] text-[#3f2a62]",
  "market-signal": "border-[#8a5a12] bg-[#fbf1e2] text-[#5c3c0c]",
  "derived-analysis": "border-black/30 bg-[#f3f4f6] text-gray-700",
  "user-generated": "border-blue-300 bg-blue-50 text-blue-900",
};

/**
 * Small, consistently-styled tag naming a measure's evidence TYPE (not a quality
 * score) using the existing canonical taxonomy in app/lib/config.ts
 * (EvidenceClass / EVIDENCE_CLASS_LABELS). These are the same categories already
 * shown in prose on /sources and in MetricsStatus — this just makes the category
 * visible as a compact badge directly on a measure's card/section.
 */
export default function EvidenceClassBadge({
  evidenceClass,
  className = "",
}: {
  evidenceClass: EvidenceClass;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] ${TONE[evidenceClass]} ${className}`}
      title={EVIDENCE_CLASS_LABELS[evidenceClass]}
    >
      {EVIDENCE_CLASS_LABELS[evidenceClass]}
    </span>
  );
}
