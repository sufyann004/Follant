import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { formatCharityRegNumber } from "../../lib/validation";

interface EinInputProps<T extends FieldValues> {
  name: Path<T>;
  id?: string;
}

export function EinInput<T extends FieldValues>({ name, id }: EinInputProps<T>) {
  const {
    control,
    formState: { errors },
  } = useFormContext<T>();

  const error = errors[name]?.message as string | undefined;
  const fieldId = id ?? String(name);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <input
          id={fieldId}
          type="text"
          inputMode="numeric"
          placeholder="1234567"
          maxLength={10}
          aria-invalid={error ? true : undefined}
          className={`app-input ${error ? "app-input-error" : ""}`}
          value={formatCharityRegNumber(field.value ?? "")}
          onChange={(e) => field.onChange(formatCharityRegNumber(e.target.value))}
          onBlur={field.onBlur}
          ref={field.ref}
        />
      )}
    />
  );
}
