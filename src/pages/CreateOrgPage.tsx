import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createOrgSchema, type CreateOrgInput } from "../types";
import { useCreateOrganization } from "../hooks/useOrganizations";
import { 
  Building2, 
  ArrowLeft, 
  Loader2, 
  School, 
  Briefcase, 
  HeartHandshake
} from "lucide-react";

type CreateOrgInputs = z.input<typeof createOrgSchema>;

export default function CreateOrgPage() {
  const navigate = useNavigate();
  const createMutation = useCreateOrganization();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<CreateOrgInputs>({
    resolver: zodResolver(createOrgSchema),
    mode: "all",
    defaultValues: {
      name: "",
      type: "school",
      slug: "",
      description: "",
      website: "",
      contactEmail: "",
      contactPhone: "",
      addressLine1: "",
      city: "",
      stateRegion: "",
      postalCode: "",
      country: "",
      timezone: "UTC",
      currency: "USD",
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

  // Watch selected organization type to conditionally display input fields
  const selectedType = useWatch({
    control,
    name: "type",
  });

  const onSubmit = async (data: CreateOrgInputs) => {
    createMutation.mutate(data as CreateOrgInput, {
      onSuccess: (newOrg) => navigate(`/orgs/${newOrg.id}`),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate("/orgs")}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to directory
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Provision Organization</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create a new tenant organization partition. Organization types govern validation rules and downstream profile options.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
        {createMutation.isError && (
          <div className="mb-6 bg-rose-50 border border-rose-100 rounded-xl p-4 text-xs text-rose-700 font-medium">
            <p className="font-bold">Execution Failed:</p>
            <p className="mt-0.5">{createMutation.error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Organization Name */}
          <div>
            <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Organization Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Greenwood Academy, Red Cross West, Helix Corp"
              className={`w-full px-3.5 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                errors.name 
                  ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" 
                  : "border-slate-300 focus:border-indigo-600"
              }`}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Organization Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Organization Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {/* Option 1: School */}
              <label 
                className={`relative flex flex-col items-center p-3.5 border rounded-xl cursor-pointer text-center transition-all ${
                  selectedType === "school"
                    ? "bg-indigo-50/50 border-indigo-605 text-indigo-700 font-semibold ring-2 ring-indigo-500/10"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50/40"
                }`}
              >
                <input
                  type="radio"
                  value="school"
                  className="sr-only"
                  {...register("type")}
                />
                <School className={`h-5 w-5 mb-1.5 ${selectedType === "school" ? "text-indigo-600" : "text-slate-400"}`} />
                <span className="text-xs">School</span>
              </label>

              {/* Option 2: Nonprofit */}
              <label 
                className={`relative flex flex-col items-center p-3.5 border rounded-xl cursor-pointer text-center transition-all ${
                  selectedType === "nonprofit"
                    ? "bg-indigo-50/50 border-indigo-605 text-indigo-700 font-semibold ring-2 ring-indigo-500/10"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50/40"
                }`}
              >
                <input
                  type="radio"
                  value="nonprofit"
                  className="sr-only"
                  {...register("type")}
                />
                <HeartHandshake className={`h-5 w-5 mb-1.5 ${selectedType === "nonprofit" ? "text-indigo-600" : "text-slate-400"}`} />
                <span className="text-xs">Nonprofit</span>
              </label>

              {/* Option 3: Business */}
              <label 
                className={`relative flex flex-col items-center p-3.5 border rounded-xl cursor-pointer text-center transition-all ${
                  selectedType === "business"
                    ? "bg-indigo-50/50 border-indigo-605 text-indigo-700 font-semibold ring-2 ring-indigo-500/10"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50/40"
                }`}
              >
                <input
                  type="radio"
                  value="business"
                  className="sr-only"
                  {...register("type")}
                />
                <Briefcase className={`h-5 w-5 mb-1.5 ${selectedType === "business" ? "text-indigo-600" : "text-slate-400"}`} />
                <span className="text-xs">Business</span>
              </label>
            </div>
          </div>

          {/* Conditional Downstream Validation Fields */}
          {selectedType === "school" && (
            <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4.5 space-y-4 animate-fadeIn">
              <div className="flex gap-2 items-center text-indigo-900 border-b border-indigo-50/80 pb-2 mb-2">
                <School className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold leading-none">School-Specific Details Needed</span>
              </div>
              <div>
                <label htmlFor="schoolDistrict" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  School District Jurisdiction
                </label>
                <input
                  id="schoolDistrict"
                  type="text"
                  placeholder="e.g. Unified District 80, County West Region"
                  className={`w-full px-3.5 py-2 bg-white rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                    errors.schoolDistrict 
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" 
                      : "border-slate-300 focus:border-indigo-600"
                  }`}
                  {...register("schoolDistrict")}
                />
                {errors.schoolDistrict && (
                  <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.schoolDistrict.message}</p>
                )}
              </div>
            </div>
          )}

          {selectedType === "nonprofit" && (
            <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4.5 space-y-4 animate-fadeIn">
              <div className="flex gap-2 items-center text-indigo-900 border-b border-indigo-50/80 pb-2 mb-2">
                <HeartHandshake className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold leading-none">Tax Nonprofit Verification Required</span>
              </div>
              <div>
                <label htmlFor="nonprofitEin" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Employer Identification Number (EIN)
                </label>
                <input
                  id="nonprofitEin"
                  type="text"
                  placeholder="Format: XX-XXXXXXX (e.g. 12-3456789)"
                  className={`w-full px-3.5 py-2 bg-white rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                    errors.nonprofitEin 
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" 
                      : "border-slate-300 focus:border-indigo-600"
                  }`}
                  {...register("nonprofitEin")}
                />
                {errors.nonprofitEin && (
                  <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.nonprofitEin.message}</p>
                )}
              </div>
            </div>
          )}

          {selectedType === "business" && (
            <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-4.5 space-y-4 animate-fadeIn">
              <div className="flex gap-2 items-center text-indigo-900 border-b border-indigo-50/80 pb-2 mb-2">
                <Briefcase className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-bold leading-none">Commercial Registry Details Needed</span>
              </div>
              <div>
                <label htmlFor="businessRegNumber" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Business Registration ID / Incorporator ID
                </label>
                <input
                  id="businessRegNumber"
                  type="text"
                  placeholder="e.g. CORP-10254-B, US-NV-8123284"
                  className={`w-full px-3.5 py-2 bg-white rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                    errors.businessRegNumber 
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" 
                      : "border-slate-300 focus:border-indigo-600"
                  }`}
                  {...register("businessRegNumber")}
                />
                {errors.businessRegNumber && (
                  <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.businessRegNumber.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Contact & location */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Contact & location</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" {...register("description")} />
              </div>
              {[
                ["website", "Website"],
                ["contactEmail", "Contact email"],
                ["contactPhone", "Contact phone"],
                ["slug", "URL slug (optional)"],
                ["addressLine1", "Address line 1"],
                ["city", "City"],
                ["stateRegion", "State / region"],
                ["postalCode", "Postal code"],
                ["country", "Country"],
                ["timezone", "Timezone"],
                ["currency", "Currency"],
              ].map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" {...register(field as keyof CreateOrgInputs)} />
                </div>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/orgs")}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 font-medium hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-create-org"
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-sm transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Provisioning...
                </>
              ) : (
                "Save Organization"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
