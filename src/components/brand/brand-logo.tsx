import { BRAND } from "@/lib/brand";

type Props = {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
};

const MARK = {
  sm: 28,
  md: 36,
  lg: 44,
} as const;

const WORD = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
} as const;

/** Inline mark — no external file load (avoids broken <img> on CDN/cache edge cases). */
function LogoMark({
  size,
  variant,
}: {
  size: number;
  variant: "dark" | "light";
}) {
  const tile = variant === "light" ? "#F7F4EF" : "#0B1F33";
  const funnel = variant === "light" ? "#0B1F33" : "#F7F4EF";
  const dots = "#E85D4C";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className="shrink-0"
      aria-hidden
    >
      <rect width="64" height="64" rx="14" fill={tile} />
      <path
        d="M18 20h28c0 6.5-5.2 11-12 12.2V36h8v6H22v-6h8v-3.8C23.2 31 18 26.5 18 20Z"
        fill={funnel}
      />
      <circle cx="26" cy="24" r="1.7" fill={dots} />
      <circle cx="32" cy="24" r="1.7" fill={dots} />
      <circle cx="38" cy="24" r="1.7" fill={dots} />
      <circle cx="29" cy="28" r="1.7" fill={dots} />
      <circle cx="35" cy="28" r="1.7" fill={dots} />
    </svg>
  );
}

export function BrandLogo({
  variant = "dark",
  size = "md",
  showWordmark = true,
  className = "",
}: Props) {
  const px = MARK[size];
  const textColor = variant === "light" ? "text-white" : "text-ink";

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={px} variant={variant} />
      {showWordmark && (
        <span
          className={`font-display font-extrabold tracking-tight ${WORD[size]} ${textColor}`}
        >
          {BRAND.name}
        </span>
      )}
    </span>
  );
}
