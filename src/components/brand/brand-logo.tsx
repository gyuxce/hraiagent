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
      {/* SVG mark — native img avoids next/image SVG config */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND.assets.logoMark}
        alt=""
        width={px}
        height={px}
        className="shrink-0"
      />
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
