import { passwordChecks } from "../../lib/validation";
import { Check, X } from "lucide-react";

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = passwordChecks(password);
  const items = [
    { ok: checks.length, label: "At least 8 characters" },
    { ok: checks.lower, label: "One lowercase letter" },
    { ok: checks.upper, label: "One uppercase letter" },
    { ok: checks.number, label: "One number" },
  ];

  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {items.map(({ ok, label }) => (
        <li key={label} className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-[var(--app-success-fg)]" : "app-muted"}`}>
          {ok ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-60" />}
          {label}
        </li>
      ))}
    </ul>
  );
}
