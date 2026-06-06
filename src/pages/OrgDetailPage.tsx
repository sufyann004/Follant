import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
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
  type UpdateOrgInput,
  ORG_STATUSES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  MEMBER_ROLE_LABELS,
  ROLE_DEFAULT_ACCESS_SLUG,
  ACTIVITY_ACTION_CATALOG,
  type OrgType,
  type ActivitySeverity,
} from "../types";
import {
  ArrowLeft,
  Loader2,
  UserPlus2,
  School,
  Briefcase,
  HeartHandshake,
  UserCheck,
  Clock,
  ShieldAlert,
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

const ORG_SEVERITY_STYLES: Record<ActivitySeverity, string> = {
  info: "bg-slate-100 text-slate-700",
  notice: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-800",
  critical: "bg-rose-50 text-rose-700",
};

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("members");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const { data: org, isLoading: orgLoading, isError: orgError, error: orgErrorObj } = useOrganization(id);
  const { data: members, isLoading: membersLoading, isError: membersError } = useOrganizationMembers(id);
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
    defaultValues: { email: "", role: "member", title: "", department: "", phone: "", inviteMessage: "" },
  });

  const inviteRole = useWatch({ control: inviteForm.control, name: "role", defaultValue: "member" });
  const inviteAccessProfile = accessProfiles?.find(
    (p) => p.slug === ROLE_DEFAULT_ACCESS_SLUG[inviteRole ?? "member"]
  );

  const orgForm = useForm<UpdateOrgInputs>({
    resolver: zodResolver(updateOrgSchema),
    values: org
      ? {
          name: org.name,
          slug: org.slug || "",
          description: org.description || "",
          website: org.website || "",
          contactEmail: org.contactEmail || "",
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
        }
      : undefined,
  });

  const memberEditForm = useForm<z.infer<typeof updateMemberSchema>>({
    resolver: zodResolver(updateMemberSchema),
  });

  const isPageLoading = orgLoading || membersLoading;
  const isPageError = orgError || membersError;

  if (isPageLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="h-28 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  if (isPageError || !org) {
    return (
      <div className="space-y-6 text-center max-w-md mx-auto py-12">
        <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="font-bold text-slate-900 text-lg">Organization not found</h2>
        <p className="text-sm text-slate-500">{orgErrorObj?.message}</p>
        <Link to="/orgs" className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to directory
        </Link>
      </div>
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
      <button onClick={() => navigate("/orgs")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to directory
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          {org.logoUrl ? (
            <img src={org.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover border border-slate-200" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <TypeIcon className="h-7 w-7" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase text-indigo-600">{org.type} · {org.status}</p>
            <h1 className="text-xl font-bold text-slate-900">{org.name}</h1>
            {org.description && <p className="text-sm text-slate-500 mt-1">{org.description}</p>}
          </div>
        </div>
        {org.bannerUrl && (
          <img src={org.bannerUrl} alt="" className="mt-4 w-full h-32 object-cover rounded-lg border border-slate-100" />
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-px">
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
              tab === tabId ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2"><UserPlus2 className="h-4 w-4 text-indigo-600" /> Invite member</h2>
            <form
              onSubmit={inviteForm.handleSubmit((data) =>
                inviteMutation.mutate(
                  { ...data, role: data.role ?? "member" } as z.infer<typeof inviteMemberSchema>,
                  { onSuccess: () => inviteForm.reset({ email: "", role: "member" }) }
                )
              )}
              className="space-y-3"
            >
              <input type="email" placeholder="Email" className="w-full px-3 py-2 border rounded-lg text-sm" {...inviteForm.register("email")} />
              <select className="w-full px-3 py-2 border rounded-lg text-sm" {...inviteForm.register("role")}>
                {MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</option>
                ))}
              </select>
              {inviteAccessProfile && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[11px] text-indigo-900">
                  <p className="font-semibold">Access type: {inviteAccessProfile.name}</p>
                  <p className="text-indigo-700 mt-0.5">{inviteAccessProfile.description}</p>
                </div>
              )}
              <input placeholder="Title" className="w-full px-3 py-2 border rounded-lg text-sm" {...inviteForm.register("title")} />
              <input placeholder="Department" className="w-full px-3 py-2 border rounded-lg text-sm" {...inviteForm.register("department")} />
              <textarea placeholder="Invite message" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" {...inviteForm.register("inviteMessage")} />
              <button type="submit" disabled={inviteMutation.isPending} className="w-full py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg cursor-pointer">
                {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Send invitation"}
              </button>
            </form>
            {accessProfiles && accessProfiles.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">Access types</p>
                {accessProfiles.map((p) => (
                  <div key={p.id} className="text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <p className="text-slate-500">{p.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm overflow-x-auto">
            <h2 className="font-bold text-sm mb-4">Members ({members?.length || 0})</h2>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-slate-500 border-b">
                <tr>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Role</th>
                  <th className="py-2 text-left">Access type</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members?.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 font-semibold">{m.email}</td>
                    <td className="py-3">{MEMBER_ROLE_LABELS[m.role]?.split(" — ")[0] ?? m.role}</td>
                    <td className="py-3 text-slate-600">{profileName(m.accessProfileId)}</td>
                    <td className="py-3">
                      {m.status === "active" ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]"><UserCheck className="inline h-3 w-3" /> active</span>
                      ) : (
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full text-[10px]"><Clock className="inline h-3 w-3" /> {m.status}</span>
                      )}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        type="button"
                        className="text-indigo-600 font-semibold cursor-pointer"
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
                className="mt-4 p-4 border border-slate-200 rounded-lg space-y-3"
                onSubmit={memberEditForm.handleSubmit((data) =>
                  updateMemberMutation.mutate(
                    { memberId: editingMemberId, data },
                    { onSuccess: () => setEditingMemberId(null) }
                  )
                )}
              >
                <p className="text-xs font-bold">Edit member</p>
                <select className="w-full px-3 py-2 border rounded-lg text-sm" {...memberEditForm.register("role")}>
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <select className="w-full px-3 py-2 border rounded-lg text-sm" {...memberEditForm.register("accessProfileId")}>
                  <option value="">Default for role</option>
                  {accessProfiles?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.description}</option>
                  ))}
                </select>
                <select className="w-full px-3 py-2 border rounded-lg text-sm" {...memberEditForm.register("status")}>
                  {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg cursor-pointer">Save</button>
                  <button type="button" onClick={() => setEditingMemberId(null)} className="px-3 py-1.5 border text-xs rounded-lg cursor-pointer">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <form
          className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={orgForm.handleSubmit((data) => updateOrgMutation.mutate(data as unknown as UpdateOrgInput))}
        >
          {[
            ["name", "Organization name"],
            ["slug", "URL slug"],
            ["description", "Description"],
            ["website", "Website"],
            ["contactEmail", "Contact email"],
            ["contactPhone", "Contact phone"],
            ["city", "City"],
            ["stateRegion", "State / region"],
            ["postalCode", "Postal code"],
            ["country", "Country"],
            ["timezone", "Timezone"],
            ["currency", "Currency"],
          ].map(([field, label]) => (
            <div key={field} className={field === "description" ? "md:col-span-2" : ""}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
              {field === "description" ? (
                <textarea rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register(field as keyof UpdateOrgInputs)} />
              ) : (
                <input className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register(field as keyof UpdateOrgInputs)} />
              )}
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register("status")}>
              {ORG_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {org.type === "school" && (
            <>
              <input placeholder="School district" className="w-full px-3 py-2 border rounded-lg text-sm md:col-span-2" {...orgForm.register("schoolDistrict")} />
              <input placeholder="Grade levels" className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register("schoolGradeLevels")} />
              <input placeholder="Accreditation" className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register("schoolAccreditation")} />
            </>
          )}
          {org.type === "nonprofit" && (
            <>
              <input placeholder="EIN" className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register("nonprofitEin")} />
              <input placeholder="Tax status" className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register("nonprofitTaxStatus")} />
              <textarea placeholder="Mission" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm md:col-span-2" {...orgForm.register("nonprofitMission")} />
            </>
          )}
          {org.type === "business" && (
            <>
              <input placeholder="Registration number" className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register("businessRegNumber")} />
              <input placeholder="Industry" className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register("businessIndustry")} />
              <input placeholder="Company size" className="w-full px-3 py-2 border rounded-lg text-sm" {...orgForm.register("businessCompanySize")} />
            </>
          )}
          <div className="md:col-span-2">
            <button type="submit" disabled={updateOrgMutation.isPending} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg cursor-pointer">
              Save organization settings
            </button>
          </div>
        </form>
      )}

      {tab === "media" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: "Logo", url: org.logoUrl, mutation: uploadLogo },
            { label: "Banner", url: org.bannerUrl, mutation: uploadBanner },
          ].map(({ label, url, mutation }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-sm">{label}</h3>
              {url ? <img src={url} alt="" className="w-full h-32 object-cover rounded-lg border" /> : <div className="h-32 bg-slate-50 rounded-lg border border-dashed flex items-center justify-center text-slate-400 text-xs">No {label.toLowerCase()} uploaded</div>}
              <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" /> Upload {label.toLowerCase()}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) mutation.mutate(f); }} />
              </label>
            </div>
          ))}
        </div>
      )}

      {tab === "activity" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
          <p className="px-4 py-3 text-xs text-slate-500 border-b border-slate-100">
            Organization activity in plain language — invites, updates, uploads, and access changes.
          </p>
          {activityLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
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
                    <tr key={log.id} className="hover:bg-slate-50/50 align-top">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{label}</div>
                        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-medium ${ORG_SEVERITY_STYLES[severity]}`}>
                          {severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.category ?? catalog?.category ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{log.actorName ?? "—"}</div>
                        {log.actorEmail && <div className="text-slate-400 text-[10px]">{log.actorEmail}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs">{log.description}</td>
                    </tr>
                  );
                })}
                {orgActivity?.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No activity for this organization yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
