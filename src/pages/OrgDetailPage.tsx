import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm, useWatch, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useOrganization,
  useOrganizationMembers,
  useInviteMember,
  useUpdateOrganization,
  useUpdateMember,
  useRemoveMember,
  useUploadOrgLogo,
  useUploadOrgBanner,
} from "../hooks/useOrganizations";
import { useOrgActivityLogs } from "../hooks/useActivityLogs";
import { useAccessProfiles } from "../hooks/useAccessProfiles";
import {
  inviteMemberSchema,
  updateOrgSchema,
  updateMemberSchema,
  type UpdateOrgPayload,
  type InviteMemberPayload,
  ORG_STATUSES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  MEMBER_ROLE_LABELS,
  ROLE_DEFAULT_ACCESS_SLUG,
  ACTIVITY_ACTION_CATALOG,
  type OrgType,
  type ActivitySeverity,
} from "../types";
import { LoadingState, ErrorState } from "../components/QueryState";
import { FormField } from "../components/forms/FormField";
import { EmailInput } from "../components/forms/EmailInput";
import { PhoneInput } from "../components/forms/PhoneInput";
import { EinInput } from "../components/forms/EinInput";
import { OrgContactFields } from "../components/forms/OrgContactFields";
import { omitPhoneUiFields, parseE164 } from "../lib/validation";
import {
  ArrowLeft,
  Loader2,
  UserPlus2,
  School,
  Briefcase,
  HeartHandshake,
  UserCheck,
  Clock,
  Settings,
  Users,
  ImageIcon,
  Activity,
  Trash2,
  Upload,
} from "lucide-react";
import type { z } from "zod";

type InviteFormInputs = z.input<typeof inviteMemberSchema>;
type UpdateOrgInputs = z.input<typeof updateOrgSchema>;

const TYPE_ICONS: Record<OrgType, typeof School> = {
  school: School,
  nonprofit: HeartHandshake,
  business: Briefcase,
};

type Tab = "members" | "settings" | "media" | "activity";

const SEVERITY_CLASS: Record<ActivitySeverity, string> = {
  info: "app-severity-info",
  notice: "app-severity-notice",
  warning: "app-severity-warning",
  critical: "app-severity-critical",
};

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("members");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const { data: org, isLoading: orgLoading, isError: orgError, error: orgErrorObj, refetch: refetchOrg } = useOrganization(id);
  const { data: members, isLoading: membersLoading, isError: membersError, refetch: refetchMembers } = useOrganizationMembers(id);
  const { data: orgActivity, isLoading: activityLoading } = useOrgActivityLogs(id);
  const { data: accessProfiles } = useAccessProfiles("organization");

  const inviteMutation = useInviteMember(id);
  const updateOrgMutation = useUpdateOrganization(id);
  const updateMemberMutation = useUpdateMember(id);
  const removeMemberMutation = useRemoveMember(id);
  const uploadLogo = useUploadOrgLogo(id);
  const uploadBanner = useUploadOrgBanner(id);

  const profileName = (profileId?: string | null) =>
    accessProfiles?.find((p) => p.id === profileId)?.name ?? "—";

  const inviteForm = useForm<InviteFormInputs>({
    resolver: zodResolver(inviteMemberSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      role: "member",
      title: "",
      department: "",
      phoneDial: "+44",
      phoneNational: "",
      phone: "",
      inviteMessage: "",
    },
  });

  const inviteRole = useWatch({ control: inviteForm.control, name: "role", defaultValue: "member" });
  const inviteAccessProfile = accessProfiles?.find(
    (p) => p.slug === ROLE_DEFAULT_ACCESS_SLUG[inviteRole ?? "member"]
  );

  const orgForm = useForm<UpdateOrgInputs>({
    resolver: zodResolver(updateOrgSchema),
    mode: "onChange",
    values: org
      ? (() => {
          const phoneParts = parseE164(org.contactPhone);
          return {
          name: org.name,
          slug: org.slug || "",
          description: org.description || "",
          website: org.website || "",
          contactEmail: org.contactEmail || "",
          contactPhoneDial: phoneParts.dial,
          contactPhoneNational: phoneParts.national,
          contactPhone: org.contactPhone || "",
          status: org.status,
          addressLine1: org.addressLine1 || "",
          addressLine2: org.addressLine2 || "",
          city: org.city || "",
          stateRegion: org.stateRegion || "",
          postalCode: org.postalCode || "",
          country: org.country || "",
          timezone: org.timezone || "",
          locale: org.locale || "",
          currency: org.currency || "",
          type: org.type,
          schoolDistrict: org.schoolDistrict || "",
          schoolGradeLevels: org.schoolGradeLevels || "",
          schoolAccreditation: org.schoolAccreditation || "",
          schoolStudentCount: org.schoolStudentCount ?? "",
          nonprofitEin: org.nonprofitEin || "",
          nonprofitTaxStatus: org.nonprofitTaxStatus || "",
          nonprofitMission: org.nonprofitMission || "",
          nonprofitFoundedYear: org.nonprofitFoundedYear ?? "",
          businessRegNumber: org.businessRegNumber || "",
          businessIndustry: org.businessIndustry || "",
          businessCompanySize: org.businessCompanySize || "",
          businessTaxId: org.businessTaxId || "",
          businessDunsNumber: org.businessDunsNumber || "",
        };
        })()
      : undefined,
  });

  const memberEditForm = useForm<
    z.input<typeof updateMemberSchema>,
    unknown,
    z.infer<typeof updateMemberSchema>
  >({
    resolver: zodResolver(updateMemberSchema),
  });

  const isPageLoading = orgLoading || membersLoading;
  const isPageError = orgError || membersError;

  if (isPageLoading) {
    return <LoadingState message="Loading organization…" variant="skeleton" rows={1} />;
  }

  if (isPageError || !org) {
    return (
      <ErrorState
        title="Organisation not found"
        message={orgErrorObj?.message ?? "This organization may have been removed or you may not have access."}
        onRetry={() => {
          refetchOrg();
          refetchMembers();
        }}
        action={
          <Link to="/orgs" className="inline-flex items-center gap-1.5 px-4 py-2 app-btn-primary text-xs font-semibold">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to directory
          </Link>
        }
      />
    );
  }

  const TypeIcon = TYPE_ICONS[org.type] || School;
  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "members", label: "Members", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "media", label: "Images", icon: ImageIcon },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/orgs")} className="inline-flex items-center gap-1.5 text-xs font-semibold app-muted hover:opacity-80 cursor-pointer">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to directory
      </button>

      <div className="app-card rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          {org.logoUrl ? (
            <img src={org.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover app-media-border" />
          ) : (
            <div className="h-14 w-14 rounded-xl app-icon-brand">
              <TypeIcon className="h-7 w-7" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase app-muted">{org.type} · {org.status}</p>
            <h1 className="text-xl font-bold app-heading">{org.name}</h1>
            {org.description && <p className="text-sm app-muted mt-1">{org.description}</p>}
          </div>
        </div>
        {org.bannerUrl && (
          <img src={org.bannerUrl} alt="" className="mt-4 w-full h-32 object-cover rounded-lg app-media-border" />
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto app-tabs-bar pb-px">
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={`app-tab flex items-center gap-1.5 -mb-px ${tab === tabId ? "app-tab-active" : ""}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="app-card rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2"><UserPlus2 className="h-4 w-4 app-heading" /> Invite member</h2>
            <FormProvider {...inviteForm}>
            <form
              onSubmit={inviteForm.handleSubmit((data) =>
                inviteMutation.mutate(
                  omitPhoneUiFields(data) as InviteMemberPayload,
                  {
                    onSuccess: () =>
                      inviteForm.reset({
                        email: "",
                        role: "member",
                        title: "",
                        department: "",
                        phoneDial: "+44",
                        phoneNational: "",
                        phone: "",
                        inviteMessage: "",
                      }),
                  }
                )
              )}
              className="space-y-3"
              noValidate
            >
              <FormField label="Email" required error={inviteForm.formState.errors.email?.message}>
                <EmailInput name="email" />
              </FormField>
              <FormField label="Role">
                <select className="app-input" {...inviteForm.register("role")}>
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </FormField>
              {inviteAccessProfile && (
                <div className="app-info-panel">
                  <p className="font-semibold">Permission level: {inviteAccessProfile.name}</p>
                  <p className="app-muted mt-0.5">{inviteAccessProfile.description}</p>
                </div>
              )}
              <FormField label="Title (optional)">
                <input placeholder="e.g. Program Manager" className="app-input" {...inviteForm.register("title")} />
              </FormField>
              <FormField label="Department (optional)">
                <input placeholder="e.g. Operations" className="app-input" {...inviteForm.register("department")} />
              </FormField>
              <FormField
                label="Phone (optional)"
                error={inviteForm.formState.errors.phoneNational?.message || inviteForm.formState.errors.phone?.message}
              >
                <PhoneInput name="phone" dialField="phoneDial" nationalField="phoneNational" />
              </FormField>
              <FormField label="Invite message (optional)">
                <textarea placeholder="Personal note included in the invitation" rows={2} className="app-textarea" {...inviteForm.register("inviteMessage")} />
              </FormField>
              <button type="submit" disabled={inviteMutation.isPending} className="app-btn-primary">
                {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Send invitation"}
              </button>
            </form>
            </FormProvider>
            {accessProfiles && accessProfiles.length > 0 && (
              <div className="pt-3 app-divider space-y-2">
                <p className="text-[10px] font-bold uppercase text-app-muted">Permission levels</p>
                {accessProfiles.map((p) => (
                  <div key={p.id} className="text-[11px] text-[var(--app-muted)]">
                    <span className="font-semibold text-[var(--app-fg)]">{p.name}</span>
                    <p className="text-app-muted">{p.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 app-card rounded-xl p-5 shadow-sm overflow-x-auto">
            <h2 className="font-bold text-sm mb-4">Members ({members?.length || 0})</h2>
            <table className="w-full text-xs">
              <thead className="app-table-head text-[10px] uppercase border-b border-[var(--app-border)]">
                <tr>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Role</th>
                  <th className="py-2 text-left">Permission level</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members?.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 font-semibold">{m.email}</td>
                    <td className="py-3">{MEMBER_ROLE_LABELS[m.role]?.split(" — ")[0] ?? m.role}</td>
                    <td className="py-3 text-[var(--app-muted)]">{profileName(m.accessProfileId)}</td>
                    <td className="py-3">
                      {m.status === "active" ? (
                        <span className="app-status-pill"><UserCheck className="inline h-3 w-3" /> active</span>
                      ) : (
                        <span className="app-status-pill app-muted"><Clock className="inline h-3 w-3" /> {m.status}</span>
                      )}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        type="button"
                        className="app-link text-xs cursor-pointer bg-transparent border-none p-0"
                        onClick={() => {
                          setEditingMemberId(m.id);
                          memberEditForm.reset({
                            role: m.role,
                            status: m.status,
                            title: m.title || "",
                            department: m.department || "",
                            accessProfileId: m.accessProfileId || "",
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-rose-600 cursor-pointer"
                        onClick={() => removeMemberMutation.mutate(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {editingMemberId && (
              <form
                className="mt-4 p-4 app-card-muted space-y-3"
                onSubmit={memberEditForm.handleSubmit((data) =>
                  updateMemberMutation.mutate(
                    { memberId: editingMemberId, data },
                    { onSuccess: () => setEditingMemberId(null) }
                  )
                )}
              >
                <p className="text-xs font-bold">Edit member</p>
                <select className="app-input" {...memberEditForm.register("role")}>
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <select className="app-input" {...memberEditForm.register("accessProfileId")}>
                  <option value="">Default for role</option>
                  {accessProfiles?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.description}</option>
                  ))}
                </select>
                <select className="app-input" {...memberEditForm.register("status")}>
                  {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-1.5 app-btn-primary text-xs cursor-pointer">Save</button>
                  <button type="button" onClick={() => setEditingMemberId(null)} className="app-btn-ghost text-xs">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <FormProvider {...orgForm}>
        <form
          className="app-card rounded-xl p-6 shadow-sm space-y-6"
          onSubmit={orgForm.handleSubmit((data) =>
            updateOrgMutation.mutate(omitPhoneUiFields(data) as UpdateOrgPayload)
          )}
          noValidate
        >
          <FormField label="Organisation name" htmlFor="org-name" required error={orgForm.formState.errors.name?.message}>
            <input id="org-name" className={`app-input ${orgForm.formState.errors.name ? "app-input-error" : ""}`} {...orgForm.register("name")} />
          </FormField>
          <OrgContactFields />
          <div>
            <label className="app-label">Status</label>
            <select className="app-input" {...orgForm.register("status")}>
              {ORG_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {org.type === "school" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Local authority or trust" error={orgForm.formState.errors.schoolDistrict?.message}>
                <input className="app-input" {...orgForm.register("schoolDistrict")} />
              </FormField>
              <FormField label="Year groups">
                <input className="app-input" placeholder="e.g. Reception–Year 11" {...orgForm.register("schoolGradeLevels")} />
              </FormField>
              <FormField label="Accreditation" htmlFor="schoolAccreditation">
                <input id="schoolAccreditation" className="app-input" {...orgForm.register("schoolAccreditation")} />
              </FormField>
            </div>
          )}
          {org.type === "nonprofit" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Charity registration number" error={orgForm.formState.errors.nonprofitEin?.message}>
                <EinInput name="nonprofitEin" />
              </FormField>
              <FormField label="Charity status" hint="e.g. Registered charity">
                <input className="app-input" placeholder="Registered charity" {...orgForm.register("nonprofitTaxStatus")} />
              </FormField>
              <FormField label="Mission" htmlFor="nonprofitMission">
                <textarea id="nonprofitMission" rows={2} className="app-textarea md:col-span-2" {...orgForm.register("nonprofitMission")} />
              </FormField>
            </div>
          )}
          {org.type === "business" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Companies House number" error={orgForm.formState.errors.businessRegNumber?.message}>
                <input className="app-input" {...orgForm.register("businessRegNumber")} />
              </FormField>
              <FormField label="Industry">
                <input className="app-input" {...orgForm.register("businessIndustry")} />
              </FormField>
              <FormField label="Company size">
                <input className="app-input" {...orgForm.register("businessCompanySize")} />
              </FormField>
            </div>
          )}
          <div>
            <button type="submit" disabled={updateOrgMutation.isPending} className="px-4 py-2 app-btn-primary text-sm cursor-pointer">
              Save organisation details
            </button>
          </div>
        </form>
        </FormProvider>
      )}

      {tab === "media" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: "Logo", url: org.logoUrl, mutation: uploadLogo },
            { label: "Banner", url: org.bannerUrl, mutation: uploadBanner },
          ].map(({ label, url, mutation }) => (
            <div key={label} className="app-card rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-sm">{label}</h3>
              {url ? <img src={url} alt="" className="w-full h-32 object-cover rounded-lg border border-[var(--app-border)]" /> : <div className="h-32 app-card-muted rounded-lg border border-dashed flex items-center justify-center app-muted text-xs">No {label.toLowerCase()} uploaded</div>}
              <label className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--app-border-strong)] rounded-lg text-xs font-semibold cursor-pointer hover:bg-[var(--app-hover)]">
                <Upload className="h-3.5 w-3.5" /> Upload {label.toLowerCase()}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) mutation.mutate(f); }} />
              </label>
            </div>
          ))}
        </div>
      )}

      {tab === "activity" && (
        <div className="app-card rounded-xl shadow-sm overflow-x-auto">
          <p className="px-4 py-3 text-xs app-muted app-tabs-bar">
            Recent activity for this organisation — invites, updates, and file uploads.
          </p>
          {activityLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin app-muted" /></div>
          ) : (
            <table className="w-full text-xs">
              <thead className="app-table-head text-[10px] uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">What happened</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Who</th>
                  <th className="px-4 py-3 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orgActivity?.map((log) => {
                  const catalog = ACTIVITY_ACTION_CATALOG[log.action];
                  const label = log.actionLabel ?? catalog?.label ?? log.action;
                  const severity = (log.severity ?? catalog?.severity ?? "info") as ActivitySeverity;
                  return (
                    <tr key={log.id} className="app-row-hover align-top">
                      <td className="px-4 py-3 text-app-muted whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold app-heading">{label}</div>
                        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-medium ${SEVERITY_CLASS[severity]}`}>
                          {severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--app-muted)]">{log.category ?? catalog?.category ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--app-fg)]">{log.actorName ?? "—"}</div>
                        {log.actorEmail && <div className="app-muted text-[10px]">{log.actorEmail}</div>}
                      </td>
                      <td className="px-4 py-3 max-w-xs app-heading">{log.description}</td>
                    </tr>
                  );
                })}
                {orgActivity?.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center app-muted">No activity for this organization yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
