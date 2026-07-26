import { BRAND } from "@/lib/brand";

type Props = {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  showMark?: boolean;
  className?: string;
};

const MARK = {
  sm: 26,
  md: 34,
  lg: 42,
} as const;

const WORD = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
} as const;

/**
 * Cullr mark — open ring with a signal cut (cull), not a funnel icon.
 * Inline SVG so favicon/CDN edge cases never blank the chrome.
 */
function LogoMark({
  size,
  variant,
}: {
  size: number;
  variant: "dark" | "light";
}) {
  const tile = variant === "light" ? "#F1F3F6" : "#0E1116";
  const ring = variant === "light" ? "#0E1116" : "#F1F3F6";
  const cut = "#0D6F64";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className="shrink-0"
      aria-hidden
    >
      <rect width="64" height="64" rx="16" fill={tile} />
      <path
        d="M44.5 22.2C41.8 18.6 37.2 16.2 32 16.2c-8.7 0-15.8 7.1-15.8 15.8S23.3 47.8 32 47.8c5.2 0 9.8-2.4 12.5-6.1"
        stroke={ring}
        strokeWidth="5.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M41.2 28.5v7"
        stroke={cut}
        strokeWidth="5.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLogo({
  variant = "dark",
  size = "md",
  showWordmark = true,
  showMark = true,
  className = "",
}: Props) {
  const px = MARK[size];
  const textColor = variant === "light" ? "text-white" : "text-ink";

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {showMark && <LogoMark size={px} variant={variant} />}
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-[-0.04em] ${WORD[size]} ${textColor}`}
        >
          {BRAND.name}
        </span>
      )}
    </span>
  );
}
