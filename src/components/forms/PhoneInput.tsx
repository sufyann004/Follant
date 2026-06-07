import { useEffect } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { COUNTRY_DIAL_OPTIONS, DEFAULT_DIAL } from "../../lib/countries";
import { formatNationalPhoneDisplay, parseE164, phoneFromParts, toE164 } from "../../lib/validation";

interface PhoneInputProps<T extends FieldValues> {
  /** Form field storing E.164 (e.g. +12025550123) or empty string */
  name: Path<T>;
  dialField: Path<T>;
  nationalField: Path<T>;
  required?: boolean;
}

export function PhoneInput<T extends FieldValues>({
  name,
  dialField,
  nationalField,
  required,
}: PhoneInputProps<T>) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<T>();

  const dial = watch(dialField) as string;
  const national = watch(nationalField) as string;
  const stored = watch(name) as string;

  useEffect(() => {
    if (stored && !national) {
      const parsed = parseE164(stored);
      setValue(dialField, parsed.dial as T[Path<T>], { shouldValidate: false });
      setValue(nationalField, parsed.national as T[Path<T>], { shouldValidate: false });
    }
  }, [stored, national, dialField, nationalField, setValue]);

  const syncE164 = (nextDial: string, nextNational: string) => {
    const e164 = phoneFromParts(nextDial, nextNational);
    setValue(name, e164 as T[Path<T>], { shouldValidate: true });
  };

  const dialError = errors[dialField]?.message as string | undefined;
  const nationalError = errors[nationalField]?.message as string | undefined;
  const nameError = errors[name]?.message as string | undefined;
  const error = nationalError || dialError || nameError;

  const selected = COUNTRY_DIAL_OPTIONS.find((c) => c.dial === (dial || DEFAULT_DIAL));

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          className={`app-input w-[7.5rem] shrink-0 ${error ? "app-input-error" : ""}`}
          value={dial || DEFAULT_DIAL}
          {...register(dialField, {
            onChange: (e) => syncE164(e.target.value, national ?? ""),
          })}
        >
          {COUNTRY_DIAL_OPTIONS.map((c) => (
            <option key={c.code} value={c.dial}>
              {c.code} {c.dial}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          placeholder={selected ? `e.g. ${selected.example}` : "Phone number"}
          aria-invalid={error ? true : undefined}
          className={`app-input flex-1 ${error ? "app-input-error" : ""}`}
          value={formatNationalPhoneDisplay(national ?? "", dial || DEFAULT_DIAL)}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 15);
            setValue(nationalField, raw as T[Path<T>], { shouldValidate: true });
            syncE164(dial || DEFAULT_DIAL, raw);
          }}
        />
      </div>
      {error && (
        <p className="app-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Hidden field sync helper — validates E.164 on the combined field */
export function hiddenPhoneE164(dial: string, national: string): string {
  const e164 = toE164(dial, national);
  return e164 && /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : "";
}
