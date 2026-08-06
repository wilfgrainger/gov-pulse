type BrandLogoProps = {
  compact?: boolean;
  inverse?: boolean;
};

export default function BrandLogo({ compact = false, inverse = false }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="public-data.org">
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        className={compact ? "h-7 w-7 shrink-0" : "h-9 w-9 shrink-0"}
      >
        <rect width="40" height="40" fill={inverse ? "#f7f3eb" : "#172234"} />
        <path
          d="M10 30V10h9.4c5.8 0 9.1 3.1 9.1 7.7 0 4.8-3.3 7.8-9.1 7.8h-4.1V30H10Zm5.3-9h3.8c2.8 0 4.2-1.1 4.2-3.3 0-2.1-1.4-3.2-4.2-3.2h-3.8V21Z"
          fill={inverse ? "#172234" : "#f7f3eb"}
        />
        <circle cx="31.5" cy="30" r="2.5" fill={inverse ? "#f6a5ad" : "#b54a55"} />
      </svg>
      <span
        className={`${compact ? "text-sm" : "text-xl"} font-semibold tracking-[-0.035em] ${inverse ? "text-white" : "text-[#172234]"}`}
      >
        public-data<span className={inverse ? "text-[#f6a5ad]" : "text-[#8a3540]"}>.org</span>
      </span>
    </span>
  );
}
