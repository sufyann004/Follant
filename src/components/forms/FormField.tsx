import type { ReactNode } from "react";
import { Label } from "@/src/components/ui/label";
import { cn } from "@/src/lib/utils";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className={cn(error && "text-destructive")}>
        {label}
        {required && (
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-[0.8rem] text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-[0.8rem] font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
