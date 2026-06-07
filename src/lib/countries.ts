/** Common countries for phone dial codes (ISO 3166-1 alpha-2). UK-first for this product. */
export interface CountryDialOption {
  code: string;
  name: string;
  dial: string;
  /** Example national number without country code */
  example: string;
}

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { code: "GB", name: "United Kingdom", dial: "+44", example: "7911123456" },
  { code: "IE", name: "Ireland", dial: "+353", example: "851234567" },
  { code: "US", name: "United States", dial: "+1", example: "2025550123" },
  { code: "CA", name: "Canada", dial: "+1", example: "4165550123" },
  { code: "AU", name: "Australia", dial: "+61", example: "412345678" },
  { code: "DE", name: "Germany", dial: "+49", example: "15123456789" },
  { code: "FR", name: "France", dial: "+33", example: "612345678" },
  { code: "IN", name: "India", dial: "+91", example: "9876543210" },
  { code: "PK", name: "Pakistan", dial: "+92", example: "3001234567" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", example: "501234567" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", example: "512345678" },
  { code: "BR", name: "Brazil", dial: "+55", example: "11987654321" },
  { code: "MX", name: "Mexico", dial: "+52", example: "5512345678" },
  { code: "NG", name: "Nigeria", dial: "+234", example: "8012345678" },
  { code: "ZA", name: "South Africa", dial: "+27", example: "821234567" },
  { code: "JP", name: "Japan", dial: "+81", example: "9012345678" },
  { code: "SG", name: "Singapore", dial: "+65", example: "81234567" },
];

export const DEFAULT_DIAL = "+44";
export const DEFAULT_COUNTRY = "GB";

export function dialByCountryCode(iso: string): string {
  return COUNTRY_DIAL_OPTIONS.find((c) => c.code === iso)?.dial ?? DEFAULT_DIAL;
}

export function countryOptionsForSelect(): { value: string; label: string }[] {
  return COUNTRY_DIAL_OPTIONS.map((c) => ({ value: c.code, label: c.name }));
}
