import follantLogo from "../follantlogo.png";
import { cn } from "../lib/utils";

type FollantLogoProps = {
  className?: string;
  /** Accessible label; omit when decorative (alt="") */
  alt?: string;
};

export function FollantLogo({ className, alt = "Follant" }: FollantLogoProps) {
  return (
    <img
      src={follantLogo}
      alt={alt}
      className={cn("object-contain", className)}
      decoding="async"
    />
  );
}

type FollantBrandProps = {
  logoClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
};

/** Logo + optional “Follant” wordmark for headers and auth screens. */
export function FollantBrand({
  logoClassName = "h-9 w-9",
  showWordmark = true,
  wordmarkClassName = "font-bold text-lg tracking-tight",
  className,
}: FollantBrandProps) {
  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <FollantLogo className={cn("shrink-0 rounded-lg", logoClassName)} alt="" />
      {showWordmark ? <span className={cn("truncate", wordmarkClassName)}>Follant</span> : null}
    </div>
  );
}
