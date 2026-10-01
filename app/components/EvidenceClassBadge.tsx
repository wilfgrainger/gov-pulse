import { EVIDENCE_CLASS_LABELS, type EvidenceClass } from "@/app/lib/config";

// Distinct, WCAG AA text-on-tint colour per evidence-class category (PR #118
// taxonomy), using the --evidence-* tokens defined in app/globals.css. More
// visually prominent than the previous near-monochrome treatment, while
// keeping the exact same canonical label text and semantics.
const TONE: Record<EvidenceClass, string> = {
  "official-data": "border-[#0a5f8f] bg-[#e3f0fa] text-[#0a5f8f]",
  "public-opinion": "border-[#6a3a9e] bg-[#f1e9fa] text-[#5b3488]",
  "market-signal": "border-[#92590a] bg-[#fbf0dd] text-[#7a4a08]",
  "derived-analysis": "border-[#46525f] bg-[#eef1f4] text-[#3a4450]",
  "user-generated": "border-[#1c6e5a] bg-[#e4f3ee] text-[#17594a]",
};

const RAIL: Record<EvidenceClass, string> = {
  "official-data": "evidence-rail--official-data",
  "public-opinion": "evidence-rail--public-opinion",
  "market-signal": "evidence-rail--market-signal",
  "derived-analysis": "evidence-rail--derived-analysis",
  "user-generated": "evidence-rail--user-generated",
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
      className={`inline-flex min-h-6 items-center gap-1.5 border px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em] ${TONE[evidenceClass]} ${className}`}
      title={EVIDENCE_CLASS_LABELS[evidenceClass]}
    >
      <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${RAIL[evidenceClass]}`} />
      {EVIDENCE_CLASS_LABELS[evidenceClass]}
    </span>
  );
}
