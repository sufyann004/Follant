import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateProfileSchema,
  updatePreferencesSchema,
  changePasswordSchema,
  THEME_PREFERENCES,
} from "../types";
import { useAuth } from "../contexts/AuthContext";
import {
  useUpdateProfile,
  useUpdatePreferences,
  useChangePassword,
  useUploadAvatar,
  useSessions,
  useRevokeSession,
  useDeactivateAccount,
} from "../hooks/useAccount";
import {
  User,
  Shield,
  Bell,
  Monitor,
  Loader2,
  Upload,
  Trash2,
  AlertTriangle,
} from "lucide-react";

type Tab = "profile" | "security" | "preferences" | "sessions";

const tabs: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "preferences", label: "Preferences", icon: Bell },
  { id: "sessions", label: "Sessions", icon: Monitor },
];

export default function AccountSettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const { user, refreshUser, signOut } = useAuth();
  const navigate = useNavigate();

  const updateProfile = useUpdateProfile();
  const updatePreferences = useUpdatePreferences();
  const changePassword = useChangePassword();
  const uploadAvatar = useUploadAvatar();
  const { data: sessions } = useSessions();
  const revokeSession = useRevokeSession();
  const deactivate = useDeactivateAccount();

  const profileForm = useForm({
    resolver: zodResolver(updateProfileSchema),
    values: {
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      jobTitle: user?.jobTitle || "",
      department: user?.department || "",
      bio: user?.bio || "",
      timezone: user?.timezone || "UTC",
      locale: user?.locale || "en-US",
    },
  });

  const prefsForm = useForm({
    resolver: zodResolver(updatePreferencesSchema),
    values: {
      theme: user?.theme || "system",
      notifyEmail: user?.notifyEmail ?? true,
      notifyPush: user?.notifyPush ?? false,
      notifySms: user?.notifySms ?? false,
      notifyMarketing: user?.notifyMarketing ?? false,
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your profile, security, notifications, and active sessions.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <nav className="md:w-52 shrink-0 flex md:flex-col gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                tab === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          {tab === "profile" && (
            <form
              className="space-y-4"
              onSubmit={profileForm.handleSubmit((data) =>
                updateProfile.mutate(data, { onSuccess: () => refreshUser() })
              )}
            >
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="h-16 w-16 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xl font-bold text-indigo-600">
                      {user.fullName.charAt(0)}
                    </div>
                  )}
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" />
                  Upload avatar
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAvatar.mutate(file, { onSuccess: () => refreshUser() });
                    }}
                  />
                </label>
              </div>

              {[
                ["fullName", "Full name"],
                ["phone", "Phone"],
                ["jobTitle", "Job title"],
                ["department", "Department"],
                ["timezone", "Timezone"],
                ["locale", "Locale"],
              ].map(([name, label]) => (
                <div key={name}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    {...profileForm.register(name as keyof typeof profileForm.formState.defaultValues)}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bio</label>
                <textarea rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" {...profileForm.register("bio")} />
              </div>
              <button type="submit" disabled={updateProfile.isPending} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-70">
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Save profile"}
              </button>
            </form>
          )}

          {tab === "security" && (
            <div className="space-y-8">
              <form
                className="space-y-4"
                onSubmit={passwordForm.handleSubmit((data) =>
                  changePassword.mutate(data, { onSuccess: () => passwordForm.reset() })
                )}
              >
                <h2 className="font-bold text-sm text-slate-900">Change password</h2>
                {(["currentPassword", "newPassword", "confirmPassword"] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 capitalize">{field.replace(/([A-Z])/g, " $1")}</label>
                    <input type="password" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" {...passwordForm.register(field)} />
                    {passwordForm.formState.errors[field] && (
                      <p className="text-rose-500 text-[11px] mt-1">{passwordForm.formState.errors[field]?.message}</p>
                    )}
                  </div>
                ))}
                <button type="submit" disabled={changePassword.isPending} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg cursor-pointer">
                  Update password
                </button>
              </form>

              <div className="border-t border-slate-100 pt-6">
                <h2 className="font-bold text-sm text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Deactivate account
                </h2>
                <p className="text-xs text-slate-500 mt-1 mb-3">This disables sign-in and logs you out immediately.</p>
                <button
                  type="button"
                  onClick={() =>
                    deactivate.mutate(undefined, {
                      onSuccess: () => {
                        signOut();
                        navigate("/sign-in");
                      },
                    })
                  }
                  className="px-4 py-2 border border-rose-300 text-rose-700 text-sm font-semibold rounded-lg cursor-pointer hover:bg-rose-50"
                >
                  Deactivate my account
                </button>
              </div>
            </div>
          )}

          {tab === "preferences" && (
            <form
              className="space-y-4"
              onSubmit={prefsForm.handleSubmit((data) =>
                updatePreferences.mutate(data, { onSuccess: () => refreshUser() })
              )}
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Theme</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" {...prefsForm.register("theme")}>
                  {THEME_PREFERENCES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {[
                ["notifyEmail", "Email notifications"],
                ["notifyPush", "Push notifications"],
                ["notifySms", "SMS notifications"],
                ["notifyMarketing", "Marketing emails"],
              ].map(([name, label]) => (
                <label key={name} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" {...prefsForm.register(name as "notifyEmail")} />
                  {label}
                </label>
              ))}
              <button type="submit" disabled={updatePreferences.isPending} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg cursor-pointer">
                Save preferences
              </button>
            </form>
          )}

          {tab === "sessions" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Revoke sessions on devices you no longer use.</p>
              {sessions?.map((s) => (
                <div key={s.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">{s.deviceLabel || "Unknown device"}</p>
                    <p className="text-slate-500">{s.ipAddress || "IP unknown"} · Last active {new Date(s.lastActiveAt).toLocaleString()}</p>
                    {s.isCurrent && <span className="text-emerald-600 font-semibold">Current session</span>}
                  </div>
                  {!s.isCurrent && !s.revokedAt && (
                    <button
                      type="button"
                      onClick={() => revokeSession.mutate(s.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Revoke session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
