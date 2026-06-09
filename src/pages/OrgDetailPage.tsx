import { useState, type ReactNode } from "react";
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
  useDeleteOrgLogo,
  useDeleteOrgBanner,
  useDeleteOrganization,
} from "../hooks/useOrganizations";
import { useOrgActivityLogs } from "../hooks/useActivityLogs";
import { useAccessProfiles } from "../hooks/useAccessProfiles";
import {
  inviteMemberSchema,
  updateOrgSchema,
  updateMemberSchema,
  type UpdateOrgPayload,
  ORG_STATUSES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  MEMBER_ROLE_LABELS,
  MEMBER_STATUS_LABELS,
  getMemberStatusLabel,
  ORG_STATUS_LABELS,
  ORG_TYPE_LABELS,
  ROLE_DEFAULT_ACCESS_SLUG,
  ACTIVITY_ACTION_CATALOG,
  type OrgType,
  type Organization,
  type OrganizationMember,
  type ActivitySeverity,
} from "../types";
import { LoadingState, ErrorState } from "../components/QueryState";
import { FormField } from "../components/forms/FormField";
import { EmailInput } from "../components/forms/EmailInput";
import { PhoneInput } from "../components/forms/PhoneInput";
import { EinInput } from "../components/forms/EinInput";
import { OrgContactFields } from "../components/forms/OrgContactFields";
import { omitPhoneUiFields, parseE164, toInviteMemberPayload } from "../lib/validation";
import { countryOptionsForSelect } from "../lib/countries";
import { useConfirm } from "../components/ConfirmProvider";
import { useAuth } from "../contexts/AuthContext";
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

function countryLabel(code: string | null | undefined) {
  if (!code) return null;
  return countryOptionsForSelect().find((c) => c.value === code)?.label ?? code;
}

function formatWhen(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function formatAddress(org: Organization) {
  const parts = [
    org.addressLine1,
    org.addressLine2,
    org.city,
    org.stateRegion,
    org.postalCode,
    countryLabel(org.country),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-2.5 border-b border-[var(--app-border)] last:border-0">
      <dt className="text-[10px] font-bold uppercase app-muted">{label}</dt>
      <dd className="sm:col-span-2 text-sm text-[var(--app-fg)] whitespace-pre-wrap break-words">{empty ? "—" : value}</dd>
    </div>
  );
}

function memberDisplayName(member: OrganizationMember) {
  return member.title?.trim() || member.email;
}

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("members");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [orgSaveNotice, setOrgSaveNotice] = useState<string | null>(null);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [deleteNameInput, setDeleteNameInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { user } = useAuth();

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
  const deleteLogo = useDeleteOrgLogo(id);
  const deleteBanner = useDeleteOrgBanner(id);
  const deleteOrgMutation = useDeleteOrganization(id);

  const canDeleteOrg = Boolean(
    org && user && (user.isAdmin || org.createdBy === user.id),
  );

  const confirm = useConfirm();

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
  const orgAddress = formatAddress(org);
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
            <p className="text-[10px] font-bold uppercase app-muted">
              {ORG_TYPE_LABELS[org.type]} · {ORG_STATUS_LABELS[org.status] ?? org.status}
            </p>
            <h1 className="text-xl font-bold app-heading">{org.name}</h1>
            {org.description && <p className="text-sm app-muted mt-1">{org.description}</p>}
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {org.contactEmail && (
                <div>
                  <dt className="text-[10px] font-bold uppercase app-muted">Contact email</dt>
                  <dd className="mt-0.5 font-medium">{org.contactEmail}</dd>
                </div>
              )}
              {org.contactPhone && (
                <div>
                  <dt className="text-[10px] font-bold uppercase app-muted">Contact phone</dt>
                  <dd className="mt-0.5 font-medium">{org.contactPhone}</dd>
                </div>
              )}
              {org.website && (
                <div>
                  <dt className="text-[10px] font-bold uppercase app-muted">Website</dt>
                  <dd className="mt-0.5">
                    <a href={org.website} target="_blank" rel="noreferrer" className="app-link font-medium">
                      {org.website.replace(/^https?:\/\//, "")}
                    </a>
                  </dd>
                </div>
              )}
              {orgAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase app-muted">Address</dt>
                  <dd className="mt-0.5 font-medium">{orgAddress}</dd>
                </div>
              )}
            </dl>
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
              onSubmit={inviteForm.handleSubmit(async (data) => {
                const roleLabel =
                  MEMBER_ROLE_LABELS[data.role ?? "member"]?.split(" — ")[0] ?? data.role ?? "member";
                const inviteTitle = typeof data.title === "string" ? data.title.trim() : "";
                const ok = await confirm({
                  title: "Send invitation?",
                  description: (
                    <>
                      Send an invitation to <strong>{data.email}</strong> as {roleLabel}?
                      {inviteTitle ? (
                        <span className="block mt-1">Title: {inviteTitle}</span>
                      ) : null}
                    </>
                  ),
                  confirmLabel: "Send invitation",
                });
                if (!ok) return;

                const payload = toInviteMemberPayload(
                  {
                    email: data.email,
                    role: data.role,
                    phoneDial: data.phoneDial,
                    phoneNational: data.phoneNational,
                    phone: typeof data.phone === "string" ? data.phone : undefined,
                    title: typeof data.title === "string" ? data.title : undefined,
                    department: typeof data.department === "string" ? data.department : undefined,
                    inviteMessage: typeof data.inviteMessage === "string" ? data.inviteMessage : undefined,
                    accessProfileId: typeof data.accessProfileId === "string" ? data.accessProfileId : undefined,
                  },
                  inviteAccessProfile?.id,
                );
                setInviteNotice(null);
                inviteMutation.mutate(payload, {
                  onSuccess: (member, variables) => {
                    const name = variables.title?.trim() || variables.email;
                    setInviteNotice(
                      member.emailSent === false
                        ? `${name} is on the member list with status "Invitation pending". The invitation email could not be sent — share the accept link with them manually.`
                        : `${name} is on the member list with status "Invitation pending". They can accept using the link in their invitation email.`,
                    );
                    inviteForm.reset({
                      email: "",
                      role: "member",
                      title: "",
                      department: "",
                      phoneDial: "+44",
                      phoneNational: "",
                      phone: "",
                      inviteMessage: "",
                    });
                  },
                  onError: () => setInviteNotice(null),
                });
              })}
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
                {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Add to member list"}
              </button>
              {inviteMutation.isError && (
                <div className="app-error-box text-xs">
                  <p className="font-bold">Could not add member</p>
                  <p className="mt-0.5">{inviteMutation.error.message}</p>
                </div>
              )}
              {inviteNotice && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
                  {inviteNotice}
                </p>
              )}
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

          <div className="lg:col-span-2 app-card rounded-xl p-5 shadow-sm">
            <h2 className="font-bold text-sm mb-4">Members ({members?.length || 0})</h2>
            {removeMemberMutation.isError && (
              <div className="app-error-box text-xs mb-4">
                <p className="font-bold">Could not remove member</p>
                <p className="mt-0.5">{removeMemberMutation.error.message}</p>
              </div>
            )}
            {updateMemberMutation.isError && (
              <div className="app-error-box text-xs mb-4">
                <p className="font-bold">Could not update member</p>
                <p className="mt-0.5">{updateMemberMutation.error.message}</p>
              </div>
            )}
            {!members?.length ? (
              <p className="text-sm app-muted py-8 text-center">No members yet. Send an invitation to add someone.</p>
            ) : (
              <div className="space-y-3">
                {members.map((m) => {
                  const isOpen = viewingMemberId === m.id;
                  const profile = accessProfiles?.find((p) => p.id === m.accessProfileId);
                  return (
                    <div key={m.id} className="rounded-lg border border-[var(--app-border)] overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{memberDisplayName(m)}</p>
                          {(m.title?.trim() || m.status === "invited") && (
                            <p className="text-xs app-muted truncate">{m.email}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {(() => {
                              const statusLabel = getMemberStatusLabel(m, org.createdBy);
                              const isPending = m.status === "invited";
                              return (
                                <span
                                  className={`app-status-pill ${isPending || m.status === "suspended" || m.status === "removed" ? "app-muted" : ""}`}
                                >
                                  {isPending ? (
                                    <Clock className="inline h-3 w-3" />
                                  ) : (
                                    <UserCheck className="inline h-3 w-3" />
                                  )}{" "}
                                  {statusLabel}
                                </span>
                              );
                            })()}
                            <span className="text-[10px] app-muted">{MEMBER_ROLE_LABELS[m.role]?.split(" — ")[0] ?? m.role}</span>
                            {m.department && <span className="text-[10px] app-muted">· {m.department}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-semibold border border-[var(--app-border-strong)] rounded-lg hover:bg-[var(--app-hover)]"
                            onClick={() => {
                              setEditingMemberId(null);
                              setViewingMemberId(isOpen ? null : m.id);
                            }}
                          >
                            {isOpen ? "Hide details" : "View details"}
                          </button>
                          <button
                            type="button"
                            className="app-link text-xs cursor-pointer bg-transparent border-none p-0"
                            onClick={() => {
                              setViewingMemberId(m.id);
                              setEditingMemberId(m.id);
                              memberEditForm.reset({
                                role: m.role,
                                status: m.status,
                                title: m.title || "",
                                department: m.department || "",
                                phone: m.phone || "",
                                accessProfileId: m.accessProfileId || "",
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-rose-600 cursor-pointer p-1"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Remove member?",
                                description: (
                                  <>
                                    Remove <strong>{memberDisplayName(m)}</strong> from this organisation?
                                    They will lose access immediately.
                                  </>
                                ),
                                confirmLabel: "Remove member",
                                variant: "destructive",
                              });
                              if (!ok) return;
                              removeMemberMutation.mutate(m.id);
                            }}
                            aria-label={`Remove ${memberDisplayName(m)}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="px-4 pb-4 border-t border-[var(--app-border)] bg-[var(--app-hover)]/30">
                          <dl className="pt-3">
                            <DetailRow label="Email" value={m.email} />
                            <DetailRow label="Title" value={m.title} />
                            <DetailRow label="Role" value={MEMBER_ROLE_LABELS[m.role] ?? m.role} />
                            <DetailRow label="Department" value={m.department} />
                            <DetailRow label="Phone" value={m.phone} />
                            <DetailRow
                              label="Permission level"
                              value={
                                profile ? (
                                  <>
                                    <span className="font-semibold">{profile.name}</span>
                                    {profile.description ? (
                                      <span className="block text-xs app-muted mt-1">{profile.description}</span>
                                    ) : null}
                                  </>
                                ) : (
                                  profileName(m.accessProfileId)
                                )
                              }
                            />
                            <DetailRow label="Status" value={getMemberStatusLabel(m, org.createdBy)} />
                            {m.status === "invited" && (
                              <DetailRow label="Invitation" value="Pending — waiting for them to accept" />
                            )}
                            {m.status === "active" && m.joinedAt && m.userId !== org.createdBy && (
                              <DetailRow label="Invitation" value="Accepted" />
                            )}
                            <DetailRow label="Invite message" value={m.inviteMessage} />
                            <DetailRow label="Invited on" value={formatWhen(m.invitedAt)} />
                            <DetailRow label="Joined on" value={formatWhen(m.joinedAt)} />
                            <DetailRow label="Last active" value={formatWhen(m.lastActiveAt)} />
                            <DetailRow
                              label="Invited by"
                              value={
                                m.invitedByName || m.invitedByEmail ? (
                                  <>
                                    {m.invitedByName && <span className="font-semibold">{m.invitedByName}</span>}
                                    {m.invitedByEmail && (
                                      <span className={`block text-xs app-muted ${m.invitedByName ? "mt-0.5" : ""}`}>
                                        {m.invitedByEmail}
                                      </span>
                                    )}
                                  </>
                                ) : null
                              }
                            />
                            <DetailRow label="Last updated" value={formatWhen(m.updatedAt)} />
                          </dl>
                        </div>
                      )}

                      {editingMemberId === m.id && (
                        <form
                          className="px-4 pb-4 border-t border-[var(--app-border)] space-y-3 bg-[var(--app-card-muted)]"
                          onSubmit={memberEditForm.handleSubmit(async (data) => {
                            if (data.status === "suspended" || data.status === "removed") {
                              const ok = await confirm({
                                title: data.status === "removed" ? "Remove member?" : "Suspend member?",
                                description:
                                  data.status === "removed" ? (
                                    <>
                                      Mark <strong>{memberDisplayName(m)}</strong> as removed? They will lose
                                      access to this organisation.
                                    </>
                                  ) : (
                                    <>
                                      Suspend <strong>{memberDisplayName(m)}</strong>? They will not be able to
                                      use this organisation until reactivated.
                                    </>
                                  ),
                                confirmLabel: data.status === "removed" ? "Remove member" : "Suspend member",
                                variant: "destructive",
                              });
                              if (!ok) return;
                            }
                            updateMemberMutation.mutate(
                              { memberId: m.id, data },
                              { onSuccess: () => setEditingMemberId(null) }
                            );
                          })}
                        >
                          <p className="text-xs font-bold pt-3">Edit member</p>
                          <FormField label="Title">
                            <input className="app-input" placeholder="e.g. Program Manager" {...memberEditForm.register("title")} />
                          </FormField>
                          <FormField label="Department">
                            <input className="app-input" placeholder="e.g. Operations" {...memberEditForm.register("department")} />
                          </FormField>
                          <FormField label="Phone">
                            <input className="app-input" placeholder="+44 7700 900123" {...memberEditForm.register("phone")} />
                          </FormField>
                          <FormField label="Role">
                            <select className="app-input" {...memberEditForm.register("role")}>
                              {MEMBER_ROLES.map((r) => (
                                <option key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                          </FormField>
                          <FormField label="Permission level">
                            <select className="app-input" {...memberEditForm.register("accessProfileId")}>
                              <option value="">Default for role</option>
                              {accessProfiles?.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} — {p.description}</option>
                              ))}
                            </select>
                          </FormField>
                          <FormField label="Status">
                            <select className="app-input" {...memberEditForm.register("status")}>
                              {MEMBER_STATUSES.map((s) => (
                                <option key={s} value={s}>{MEMBER_STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          </FormField>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={updateMemberMutation.isPending}
                              className="px-3 py-1.5 app-btn-primary text-xs cursor-pointer disabled:opacity-70"
                            >
                              {updateMemberMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                              ) : (
                                "Save changes"
                              )}
                            </button>
                            <button type="button" onClick={() => setEditingMemberId(null)} className="app-btn-ghost text-xs">Cancel</button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-6">
        <FormProvider {...orgForm}>
        <form
          className="app-card rounded-xl p-6 shadow-sm space-y-6"
          onSubmit={orgForm.handleSubmit(async (data) => {
            const nextStatus = data.status ?? org.status;
            if (
              nextStatus !== org.status &&
              (nextStatus === "archived" || nextStatus === "inactive")
            ) {
              const ok = await confirm({
                title: nextStatus === "archived" ? "Archive organisation?" : "Mark organisation inactive?",
                description: (
                  <>
                    Change status from <strong>{ORG_STATUS_LABELS[org.status]}</strong> to{" "}
                    <strong>{ORG_STATUS_LABELS[nextStatus]}</strong>? Members may lose access depending on
                    your settings.
                  </>
                ),
                confirmLabel: "Save changes",
                variant: "destructive",
              });
              if (!ok) return;
            }
            updateOrgMutation.mutate(omitPhoneUiFields(data) as UpdateOrgPayload, {
              onSuccess: () => {
                setOrgSaveNotice("Organisation details saved.");
              },
              onError: () => setOrgSaveNotice(null),
            });
          })}
          noValidate
        >
          {updateOrgMutation.isError && (
            <div className="app-error-box text-xs">
              <p className="font-bold">Could not save organisation</p>
              <p className="mt-0.5">{updateOrgMutation.error.message}</p>
            </div>
          )}
          {orgSaveNotice && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
              {orgSaveNotice}
            </p>
          )}
          <FormField label="Organisation name" htmlFor="org-name" required error={orgForm.formState.errors.name?.message}>
            <input id="org-name" className={`app-input ${orgForm.formState.errors.name ? "app-input-error" : ""}`} {...orgForm.register("name")} />
          </FormField>
          <OrgContactFields />
          <div>
            <label className="app-label">Status</label>
            <select className="app-input" {...orgForm.register("status")}>
              {ORG_STATUSES.map((s) => (
                <option key={s} value={s}>{ORG_STATUS_LABELS[s]}</option>
              ))}
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
            <button type="submit" disabled={updateOrgMutation.isPending} className="px-4 py-2 app-btn-primary text-sm cursor-pointer disabled:opacity-70">
              {updateOrgMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin inline" /> Saving…
                </>
              ) : (
                "Save organisation details"
              )}
            </button>
          </div>
        </form>
        </FormProvider>

        {canDeleteOrg && org && (
          <section className="app-card rounded-xl p-6 shadow-sm border border-red-200 dark:border-red-900/60 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Danger zone</h3>
              <p className="text-xs app-muted mt-1">
                Permanently delete this organisation, its members, and related data. This cannot be undone.
              </p>
            </div>

            {deleteOrgMutation.isError && (
              <div className="app-error-box text-xs">
                <p className="font-bold">Could not delete organisation</p>
                <p className="mt-0.5">{deleteOrgMutation.error.message}</p>
              </div>
            )}

            {!showDeleteConfirm ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-70"
                disabled={deleteOrgMutation.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete this organisation?",
                    description: (
                      <>
                        You are about to delete <strong>{org.name}</strong>. All members will lose access and
                        organisation data will be removed permanently.
                      </>
                    ),
                    confirmLabel: "Continue",
                    variant: "destructive",
                  });
                  if (!ok) return;
                  setDeleteNameInput("");
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete organisation
              </button>
            ) : (
              <div className="space-y-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 p-4">
                <p className="text-xs text-red-800 dark:text-red-300">
                  Type <strong>{org.name}</strong> below to confirm permanent deletion.
                </p>
                <input
                  type="text"
                  className="app-input"
                  value={deleteNameInput}
                  onChange={(e) => setDeleteNameInput(e.target.value)}
                  placeholder={org.name}
                  autoComplete="off"
                  aria-label="Organisation name confirmation"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={
                      deleteOrgMutation.isPending ||
                      deleteNameInput.trim() !== org.name.trim()
                    }
                    onClick={async () => {
                      if (deleteNameInput.trim() !== org.name.trim()) return;
                      const ok = await confirm({
                        title: "Permanently delete organisation?",
                        description: (
                          <>
                            This is your final confirmation. <strong>{org.name}</strong> and all associated
                            data will be deleted immediately.
                          </>
                        ),
                        confirmLabel: "Delete permanently",
                        variant: "destructive",
                      });
                      if (!ok) return;
                      deleteOrgMutation.mutate(undefined, {
                        onSuccess: () => navigate("/orgs", { replace: true }),
                      });
                    }}
                  >
                    {deleteOrgMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin inline" /> Deleting…
                      </>
                    ) : (
                      "Delete permanently"
                    )}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm app-btn-secondary cursor-pointer"
                    disabled={deleteOrgMutation.isPending}
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteNameInput("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        </div>
      )}

      {tab === "media" && (
        <div className="space-y-4">
          {(uploadLogo.isError || uploadBanner.isError || deleteLogo.isError || deleteBanner.isError) && (
            <div className="app-error-box text-xs">
              <p className="font-bold">Image update failed</p>
              <p className="mt-0.5">
                {uploadLogo.error?.message ??
                  uploadBanner.error?.message ??
                  deleteLogo.error?.message ??
                  deleteBanner.error?.message}
              </p>
            </div>
          )}
          {mediaNotice && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
              {mediaNotice}
            </p>
          )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: "Logo", url: org.logoUrl, upload: uploadLogo, remove: deleteLogo },
            { label: "Banner", url: org.bannerUrl, upload: uploadBanner, remove: deleteBanner },
          ].map(({ label, url, upload, remove }) => (
            <div key={label} className="app-card rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-sm">{label}</h3>
              {url ? (
                <img src={url} alt="" className="w-full h-32 object-cover rounded-lg border border-[var(--app-border)]" />
              ) : (
                <div className="h-32 app-card-muted rounded-lg border border-dashed flex items-center justify-center app-muted text-xs">
                  No {label.toLowerCase()} uploaded
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--app-border-strong)] rounded-lg text-xs font-semibold cursor-pointer hover:bg-[var(--app-hover)]">
                  <Upload className="h-3.5 w-3.5" /> Upload {label.toLowerCase()}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        upload.mutate(f, {
                          onSuccess: () => setMediaNotice(`${label} updated.`),
                          onError: () => setMediaNotice(null),
                        });
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {url && (
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Remove ${label.toLowerCase()}?`,
                        description: `The ${label.toLowerCase()} will be removed from this organisation. You can upload a new one at any time.`,
                        confirmLabel: `Remove ${label.toLowerCase()}`,
                        variant: "destructive",
                      });
                      if (!ok) return;
                      remove.mutate(undefined, {
                        onSuccess: () => setMediaNotice(`${label} removed.`),
                        onError: () => setMediaNotice(null),
                      });
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50"
                  >
                    {remove.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Remove {label.toLowerCase()}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
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
