import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { normalizeEmail } from "../../lib/validation";

interface EmailInputProps<T extends FieldValues> {
  name: Path<T>;
  id?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}

export function EmailInput<T extends FieldValues>({
  name,
  id,
  placeholder = "name@company.com",
  autoComplete = "email",
  required,
}: EmailInputProps<T>) {
  const {
    register,
    formState: { errors },
    setValue,
  } = useFormContext<T>();

  const error = errors[name]?.message as string | undefined;
  const fieldId = id ?? String(name);

  return (
    <input
      id={fieldId}
      type="email"
      inputMode="email"
      autoComplete={autoComplete}
      required={required}
      placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${fieldId}-error` : undefined}
      className={`app-input ${error ? "app-input-error" : ""}`}
      {...register(name, {
        onBlur: (e) => {
          const v = normalizeEmail(e.target.value);
          if (v !== e.target.value) setValue(name, v as T[Path<T>], { shouldValidate: true });
        },
      })}
    />
  );
}
