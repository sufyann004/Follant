import { useNavigate } from "react-router-dom";
import { useForm, useWatch, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createOrgSchema, type CreateOrgPayload } from "../types";
import { useCreateOrganization } from "../hooks/useOrganizations";
import { FormField } from "../components/forms/FormField";
import { EinInput } from "../components/forms/EinInput";
import { OrgContactFields } from "../components/forms/OrgContactFields";
import { omitPhoneUiFields } from "../lib/validation";
import { DEFAULT_COUNTRY } from "../lib/countries";
import { ORG_TYPE_LABELS } from "../types";
import {
  ArrowLeft,
  Loader2,
  School,
  Briefcase,
  HeartHandshake,
} from "lucide-react";

type CreateOrgInputs = z.input<typeof createOrgSchema>;

export default function CreateOrgPage() {
  const navigate = useNavigate();
  const createMutation = useCreateOrganization();

  const methods = useForm<CreateOrgInputs>({
    resolver: zodResolver(createOrgSchema),
    mode: "all",
    defaultValues: {
      name: "",
      type: "school",
      slug: "",
      description: "",
      website: "",
      contactEmail: "",
      contactPhoneDial: "+44",
      contactPhoneNational: "",
      contactPhone: "",
      addressLine1: "",
      city: "",
      stateRegion: "",
      postalCode: "",
      country: DEFAULT_COUNTRY,
      timezone: "Europe/London",
      currency: "GBP",
      schoolDistrict: "",
      schoolGradeLevels: "",
      schoolAccreditation: "",
      nonprofitEin: "",
      nonprofitTaxStatus: "",
      nonprofitMission: "",
      businessRegNumber: "",
      businessIndustry: "",
      businessCompanySize: "",
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = methods;

  const selectedType = useWatch({ control, name: "type" });

  const onSubmit = async (data: CreateOrgInputs) => {
    const payload = omitPhoneUiFields(data) as CreateOrgPayload;
    createMutation.mutate(payload, {
      onSuccess: (newOrg) => navigate(`/orgs/${newOrg.id}`),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <button
        type="button"
        onClick={() => navigate("/orgs")}
        className="inline-flex items-center gap-1.5 text-xs font-semibold app-muted hover:opacity-80 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to directory
      </button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight app-heading">Create organisation</h1>
        <p className="text-sm app-muted mt-1">
          Add a new school, charity, or business. Required fields are marked with an asterisk.
        </p>
      </div>

      <div className="app-card p-6 sm:p-8">
        {createMutation.isError && (
          <div className="mb-6 app-error-box">
            <p className="font-bold">Something went wrong</p>
            <p className="mt-0.5">{createMutation.error.message}</p>
          </div>
        )}

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <FormField label="Organisation name" htmlFor="name" required error={errors.name?.message}>
              <input
                id="name"
                type="text"
                placeholder="e.g. Greenwood Academy, Hope Food Bank, Helix Ltd"
                className={`app-input ${errors.name ? "app-input-error" : ""}`}
                {...register("name")}
              />
            </FormField>

            <div>
              <span className="app-label">Organisation type</span>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { value: "school" as const, label: ORG_TYPE_LABELS.school, icon: School },
                    { value: "nonprofit" as const, label: ORG_TYPE_LABELS.nonprofit, icon: HeartHandshake },
                    { value: "business" as const, label: ORG_TYPE_LABELS.business, icon: Briefcase },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <label
                    key={value}
                    className={`app-type-option ${selectedType === value ? "app-type-option-selected" : ""}`}
                  >
                    <input type="radio" value={value} className="sr-only" {...register("type")} />
                    <Icon className="h-5 w-5 mb-1.5" />
                    <span className="text-xs">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedType === "school" && (
              <div className="app-card-muted p-4.5 space-y-4 animate-fadeIn">
                <div className="flex gap-2 items-center app-heading border-b pb-2 mb-2" style={{ borderColor: "var(--app-border)" }}>
                  <School className="h-4 w-4 app-muted" />
                  <span className="text-xs font-bold leading-none">School-specific details</span>
                </div>
                <FormField label="Local authority or trust" htmlFor="schoolDistrict" required error={errors.schoolDistrict?.message}>
                  <input
                    id="schoolDistrict"
                    type="text"
                    placeholder="e.g. Greenwich Council or Oak Multi-Academy Trust"
                    className={`app-input ${errors.schoolDistrict ? "app-input-error" : ""}`}
                    {...register("schoolDistrict")}
                  />
                </FormField>
              </div>
            )}

            {selectedType === "nonprofit" && (
              <div className="app-card-muted p-4.5 space-y-4 animate-fadeIn">
                <div className="flex gap-2 items-center app-heading border-b pb-2 mb-2" style={{ borderColor: "var(--app-border)" }}>
                  <HeartHandshake className="h-4 w-4 app-muted" />
                  <span className="text-xs font-bold leading-none">Charity details</span>
                </div>
                <FormField
                  label="Charity registration number"
                  htmlFor="nonprofitEin"
                  required
                  hint="From the Charity Commission — usually 6 to 8 digits"
                  error={errors.nonprofitEin?.message}
                >
                  <EinInput name="nonprofitEin" id="nonprofitEin" />
                </FormField>
              </div>
            )}

            {selectedType === "business" && (
              <div className="app-card-muted p-4.5 space-y-4 animate-fadeIn">
                <div className="flex gap-2 items-center app-heading border-b pb-2 mb-2" style={{ borderColor: "var(--app-border)" }}>
                  <Briefcase className="h-4 w-4 app-muted" />
                  <span className="text-xs font-bold leading-none">Company details</span>
                </div>
                <FormField
                  label="Companies House number"
                  htmlFor="businessRegNumber"
                  required
                  hint="The 8-digit number from Companies House"
                  error={errors.businessRegNumber?.message}
                >
                  <input
                    id="businessRegNumber"
                    type="text"
                    placeholder="e.g. 12345678"
                    className={`app-input ${errors.businessRegNumber ? "app-input-error" : ""}`}
                    {...register("businessRegNumber")}
                  />
                </FormField>
              </div>
            )}

            <div className="app-divider pt-6 space-y-4">
              <h3 className="text-xs font-bold app-heading uppercase tracking-wide">Contact & location</h3>
              <OrgContactFields />
            </div>

            <div className="pt-4 app-divider flex items-center justify-end gap-3">
              <button type="button" onClick={() => navigate("/orgs")} className="app-btn-ghost">
                Cancel
              </button>
              <button id="submit-create-org" type="submit" disabled={createMutation.isPending} className="app-btn-primary">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Save organisation"
                )}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
