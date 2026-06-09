import { z } from "zod";
import { COUNTRY_DIAL_OPTIONS, DEFAULT_COUNTRY, DEFAULT_DIAL } from "./countries";

/** Trim and lowercase email for consistent storage and comparison. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Practical email validation beyond basic @ check. */
export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value);
  if (email.length < 5 || email.length > 254) return false;
  if (email.includes("..") || email.startsWith(".") || email.endsWith(".")) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain || !domain.includes(".")) return false;
  const tld = domain.split(".").pop();
  if (!tld || tld.length < 2) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export const emailField = z
  .string()
  .min(1, "Email is required")
  .transform(normalizeEmail)
  .refine(isValidEmail, "Enter a valid email address (e.g. name@company.co.uk)");

export const optionalEmailField = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? normalizeEmail(v) : ""))
  .refine((v) => v === "" || isValidEmail(v), "Enter a valid email address");

/** Build E.164 from dial code (+1) and national digits. */
export function toE164(dialCode: string, nationalNumber: string): string {
  const dial = dialCode.replace(/\D/g, "");
  const national = nationalNumber.replace(/\D/g, "");
  if (!national) return "";
  return `+${dial}${national}`;
}

export function isValidE164(phone: string): boolean {
  const normalized = phone.replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}

/** Parse stored international number into dial + national for inputs. */
export function parseE164(phone: string | null | undefined): { dial: string; national: string } {
  if (!phone?.trim()) return { dial: DEFAULT_DIAL, national: "" };
  const normalized = phone.replace(/[\s()-]/g, "");
  if (!normalized.startsWith("+")) {
    return { dial: DEFAULT_DIAL, national: normalized.replace(/\D/g, "") };
  }
  const sorted = [...COUNTRY_DIAL_OPTIONS].sort(
    (a, b) => b.dial.length - a.dial.length,
  );
  for (const c of sorted) {
    const dialDigits = c.dial.replace("+", "");
    if (normalized.startsWith(c.dial)) {
      return {
        dial: c.dial,
        national: normalized.slice(c.dial.length).replace(/\D/g, ""),
      };
    }
    if (normalized.startsWith(`+${dialDigits}`)) {
      return {
        dial: c.dial,
        national: normalized.slice(1 + dialDigits.length).replace(/\D/g, ""),
      };
    }
  }
  const digits = normalized.slice(1);
  return { dial: DEFAULT_DIAL, national: digits };
}

export function formatNationalPhoneDisplay(national: string, dial = DEFAULT_DIAL): string {
  const d = national.replace(/\D/g, "").slice(0, 15);
  if (!d) return "";
  if (dial === "+44") {
    if (d.length <= 5) return d;
    if (d.length <= 8) return `${d.slice(0, 5)} ${d.slice(5)}`;
    return `${d.slice(0, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 11)}${d.slice(11)}`;
}

/** Optional string for API payloads — normalizes null/undefined to "" (Zod 4 safe). */
export function optionalStringField(maxLen?: number) {
  let inner = z.string();
  if (typeof maxLen === "number") inner = inner.max(maxLen);
  return z.preprocess((v) => (v == null ? "" : v), inner.transform((s) => s.trim()));
}

export const optionalPhoneField = z.preprocess(
  (v) => (v == null ? "" : v),
  z
    .string()
    .transform((v) => (v ? v.replace(/[\s()-]/g, "") : ""))
    .refine((v) => v === "" || isValidE164(v), "Enter a valid phone number (e.g. +44 7911 123456)"),
);

export function phoneFromParts(dial: string, national: string): string {
  const e164 = toE164(dial, national);
  if (!e164 || e164 === `+${dial.replace(/\D/g, "")}`) return "";
  return isValidE164(e164) ? e164 : "";
}

export const phonePartsSchema = z
  .object({
    phoneDial: z.string().min(1),
    phoneNational: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const national = (data.phoneNational ?? "").replace(/\D/g, "");
    if (!national) return;
    const e164 = toE164(data.phoneDial, national);
    if (!isValidE164(e164)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phoneNational"],
        message: "Enter a valid phone number for the selected country",
      });
    }
  });

/** UK charity registration (Charity Commission) or company number formatting. */
export function formatCharityRegNumber(value: string): string {
  const cleaned = value.replace(/\s/g, "").toUpperCase();
  const alnum = cleaned.replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return alnum;
}

export function isValidCharityRegNumber(value: string): boolean {
  const v = formatCharityRegNumber(value);
  if (/^\d{6,8}$/.test(v)) return true;
  if (/^[A-Z]{2}\d{6}$/.test(v)) return true;
  return false;
}

/** @deprecated Use formatCharityRegNumber — kept for existing imports */
export function formatEin(value: string): string {
  return formatCharityRegNumber(value);
}

/** @deprecated Use isValidCharityRegNumber */
export function isValidEin(value: string): boolean {
  return isValidCharityRegNumber(value);
}

export const charityRegField = z
  .string()
  .min(1, "Charity registration number is required")
  .transform(formatCharityRegNumber)
  .refine(isValidCharityRegNumber, "Enter a valid charity registration number (6–8 digits, e.g. 1234567)");

export const einField = charityRegField;

export const optionalUrlField = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => {
    const trimmed = (v ?? "").trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  })
  .refine((v) => v === "" || z.string().url().safeParse(v).success, "Enter a valid website URL");

export function validatePostalCode(country: string | undefined, postal: string): boolean {
  const code = postal.trim();
  if (!code) return true;
  const c = (country ?? DEFAULT_COUNTRY).trim().toUpperCase();
  if (c === "GB" || c === "UK" || c === "UNITED KINGDOM") {
    return /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(code);
  }
  if (c === "US" || c === "USA" || c === "UNITED STATES") {
    return /^\d{5}(-\d{4})?$/.test(code);
  }
  if (c === "CA" || c === "CAN" || c === "CANADA") {
    return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(code);
  }
  return code.length >= 2 && code.length <= 12;
}

export const passwordStrengthSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((p) => /[a-z]/.test(p), "Include at least one lowercase letter")
  .refine((p) => /[A-Z]/.test(p), "Include at least one uppercase letter")
  .refine((p) => /\d/.test(p), "Include at least one number");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

/** API payloads must use real UUIDs (Supabase). Legacy local ids like ap-org-member are dropped. */
export function accessProfileIdForApi(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return isUuid(value) ? value.trim() : "";
}

export function omitPhoneUiFields<T extends Record<string, unknown>>(data: T) {
  const {
    phoneDial: _pd,
    phoneNational: _pn,
    contactPhoneDial: _cpd,
    contactPhoneNational: _cpn,
    ...rest
  } = data;
  return rest;
}

/** Map profile form values (with dial/national parts) to the API payload. */
export function toUpdateProfilePayload(data: {
  fullName: string;
  phoneDial?: string;
  phoneNational?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
}) {
  const phone = phoneFromParts(data.phoneDial ?? DEFAULT_DIAL, data.phoneNational ?? "");
  return {
    ...omitPhoneUiFields(data),
    phone,
  };
}

/** Map invite form values (with dial/national parts) to the API payload. */
export function toInviteMemberPayload(
  data: {
    email: string;
    role?: "admin" | "member" | "viewer";
    phoneDial?: string;
    phoneNational?: string;
    phone?: string;
    title?: string;
    department?: string;
    inviteMessage?: string;
    accessProfileId?: string;
  },
  accessProfileIdOverride?: string,
) {
  const phone = phoneFromParts(data.phoneDial ?? DEFAULT_DIAL, data.phoneNational ?? "");
  const accessProfileId =
    accessProfileIdForApi(accessProfileIdOverride) || accessProfileIdForApi(data.accessProfileId);
  return {
    email: normalizeEmail(data.email),
    role: data.role ?? "member",
    title: (data.title ?? "").trim(),
    department: (data.department ?? "").trim(),
    phone,
    inviteMessage: (data.inviteMessage ?? "").trim(),
    accessProfileId,
  };
}

export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
}

export const fullNameField = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters")
  .max(80, "Full name is too long")
  .refine((n) => /[\p{L}]/u.test(n), "Use letters in your name");
