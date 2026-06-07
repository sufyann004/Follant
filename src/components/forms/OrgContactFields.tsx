import { useFormContext } from "react-hook-form";
import { countryOptionsForSelect, DEFAULT_COUNTRY } from "../../lib/countries";
import { FormField } from "./FormField";
import { EmailInput } from "./EmailInput";
import { PhoneInput } from "./PhoneInput";

/** Contact email, phone, website, and address fields for organisation forms. */
export function OrgContactFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const fieldError = (key: string) => errors[key]?.message as string | undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <FormField label="Description" htmlFor="description">
          <textarea id="description" rows={2} className="app-textarea" {...register("description")} />
        </FormField>
      </div>

      <FormField
        label="Website"
        htmlFor="website"
        hint="We'll add https:// if you leave it out"
        error={fieldError("website")}
      >
        <input
          id="website"
          type="url"
          inputMode="url"
          placeholder="https://example.org.uk"
          className={`app-input ${fieldError("website") ? "app-input-error" : ""}`}
          {...register("website")}
        />
      </FormField>

      <FormField label="Contact email" htmlFor="contactEmail" error={fieldError("contactEmail")}>
        <EmailInput name="contactEmail" id="contactEmail" autoComplete="email" />
      </FormField>

      <FormField
        label="Contact phone"
        hint="Select your country code, then enter the rest of the number"
        error={fieldError("contactPhoneNational") || fieldError("contactPhone")}
      >
        <PhoneInput
          name="contactPhone"
          dialField="contactPhoneDial"
          nationalField="contactPhoneNational"
        />
      </FormField>

      <FormField
        label="Short web name"
        htmlFor="slug"
        hint="Optional. Example: greenwood-academy"
        error={fieldError("slug")}
      >
        <input
          id="slug"
          type="text"
          placeholder="greenwood-academy"
          className={`app-input ${fieldError("slug") ? "app-input-error" : ""}`}
          {...register("slug")}
        />
      </FormField>

      <FormField label="Address line 1" htmlFor="addressLine1">
        <input id="addressLine1" type="text" autoComplete="street-address" className="app-input" {...register("addressLine1")} />
      </FormField>

      <FormField label="Town or city" htmlFor="city">
        <input id="city" type="text" autoComplete="address-level2" className="app-input" {...register("city")} />
      </FormField>

      <FormField label="County" htmlFor="stateRegion">
        <input id="stateRegion" type="text" autoComplete="address-level1" placeholder="e.g. Greater London" className="app-input" {...register("stateRegion")} />
      </FormField>

      <FormField label="Country" htmlFor="country">
        <select id="country" className="app-input" defaultValue={DEFAULT_COUNTRY} {...register("country")}>
          <option value="">Select country</option>
          {countryOptionsForSelect().map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Postcode" htmlFor="postalCode" error={fieldError("postalCode")}>
        <input
          id="postalCode"
          type="text"
          autoComplete="postal-code"
          placeholder="SW1A 1AA"
          className={`app-input ${fieldError("postalCode") ? "app-input-error" : ""}`}
          {...register("postalCode")}
        />
      </FormField>

      <FormField label="Time zone" htmlFor="timezone" hint="Usually Europe/London for the UK">
        <input id="timezone" type="text" placeholder="Europe/London" className="app-input" {...register("timezone")} />
      </FormField>

      <FormField label="Currency" htmlFor="currency">
        <input id="currency" type="text" placeholder="GBP" maxLength={3} className="app-input uppercase" {...register("currency")} />
      </FormField>
    </div>
  );
}
