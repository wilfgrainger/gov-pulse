type BrandLogoProps = {
  compact?: boolean;
  inverse?: boolean;
};

export default function BrandLogo({ compact = false, inverse = false }: BrandLogoProps) {
  const mark = inverse ? "#ebe6dc" : "#ebe6dc";
  const field = inverse ? "#0c0f12" : "#0c0f12";
  const accent = "#e8352e";

  return (
    <span className="inline-flex items-center gap-2.5" aria-label="public-data.org">
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        className={compact ? "h-7 w-7 shrink-0" : "h-9 w-9 shrink-0"}
      >
        <rect width="40" height="40" fill={field} />
        <rect x="0" y="0" width="40" height="3" fill={accent} />
        <path
          d="M10 30V10h9.4c5.8 0 9.1 3.1 9.1 7.7 0 4.8-3.3 7.8-9.1 7.8h-4.1V30H10Zm5.3-9h3.8c2.8 0 4.2-1.1 4.2-3.3 0-2.1-1.4-3.2-4.2-3.2h-3.8V21Z"
          fill={mark}
        />
        <circle cx="31.5" cy="30" r="2.5" fill={accent} />
      </svg>
      <span
        className={`${compact ? "text-sm" : "text-xl"} font-semibold tracking-[-0.04em] ${inverse ? "text-[#ebe6dc]" : "text-[#ebe6dc]"}`}
        style={{ fontFamily: "var(--font-editorial)" }}
      >
        public-data<span className="text-[var(--accent)]">.org</span>
      </span>
    </span>
  );
}
