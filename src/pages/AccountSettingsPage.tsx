import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
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
import { useTheme } from "next-themes";
import type { ThemePreference, UpdateProfilePayload } from "../types";
import { FormField } from "../components/forms/FormField";
import { PhoneInput } from "../components/forms/PhoneInput";
import { PasswordStrength } from "../components/forms/PasswordStrength";
import { omitPhoneUiFields, parseE164 } from "../lib/validation";
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
  const { setTheme } = useTheme();
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

  const phoneParts = parseE164(user?.phone);

  const profileForm = useForm({
    resolver: zodResolver(updateProfileSchema),
    mode: "onChange",
    values: {
      fullName: user?.fullName || "",
      phoneDial: phoneParts.dial,
      phoneNational: phoneParts.national,
      phone: user?.phone || "",
      jobTitle: user?.jobTitle || "",
      department: user?.department || "",
      bio: user?.bio || "",
      timezone: user?.timezone || "Europe/London",
      locale: user?.locale || "en-GB",
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
        <h1 className="text-2xl font-bold text-app-heading">Account Settings</h1>
        <p className="text-sm app-muted mt-1">Manage your profile, security, notifications, and active sessions.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <nav className="md:w-52 shrink-0 flex md:flex-col gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                tab === id ? "app-nav-settings-active" : "app-muted hover:bg-[var(--app-hover)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 app-card p-6">
          {tab === "profile" && (
            <FormProvider {...profileForm}>
            <form
              className="space-y-4"
              onSubmit={profileForm.handleSubmit((data) =>
                updateProfile.mutate(omitPhoneUiFields(data) as UpdateProfilePayload, { onSuccess: () => refreshUser() })
              )}
              noValidate
            >
              <div className="flex items-center gap-4 pb-4 app-divider">
                <div className="h-16 w-16 rounded-full overflow-hidden app-media-border">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full app-avatar text-xl">
                      {user.fullName.charAt(0)}
                    </div>
                  )}
                </div>
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--app-border-strong)] rounded-lg text-xs font-semibold cursor-pointer hover:bg-[var(--app-hover)]">
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

              <FormField label="Full name" required error={profileForm.formState.errors.fullName?.message}>
                <input
                  className={`app-input ${profileForm.formState.errors.fullName ? "app-input-error" : ""}`}
                  autoComplete="name"
                  {...profileForm.register("fullName")}
                />
              </FormField>

              <FormField
                label="Phone"
                error={profileForm.formState.errors.phoneNational?.message || profileForm.formState.errors.phone?.message}
              >
                <PhoneInput name="phone" dialField="phoneDial" nationalField="phoneNational" />
              </FormField>

              <FormField label="Job title">
                <input className="app-input" autoComplete="organization-title" {...profileForm.register("jobTitle")} />
              </FormField>

              <FormField label="Department">
                <input className="app-input" {...profileForm.register("department")} />
              </FormField>

              <FormField label="Time zone">
                <select className="app-input" {...profileForm.register("timezone")}>
                  <option value="Europe/London">United Kingdom (London)</option>
                  <option value="Europe/Dublin">Ireland (Dublin)</option>
                  <option value="Europe/Edinburgh">Scotland (Edinburgh)</option>
                </select>
              </FormField>

              <FormField label="Bio" error={profileForm.formState.errors.bio?.message}>
                <textarea rows={3} className="app-textarea" maxLength={500} {...profileForm.register("bio")} />
              </FormField>

              <button type="submit" disabled={updateProfile.isPending} className="app-btn-primary cursor-pointer disabled:opacity-70">
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Save profile"}
              </button>
            </form>
            </FormProvider>
          )}

          {tab === "security" && (
            <div className="space-y-8">
              <form
                className="space-y-4"
                onSubmit={passwordForm.handleSubmit((data) =>
                  changePassword.mutate(data, { onSuccess: () => passwordForm.reset() })
                )}
              >
                <h2 className="font-bold text-sm app-heading">Change password</h2>
                {(["currentPassword", "newPassword", "confirmPassword"] as const).map((field) => (
                  <div key={field}>
                  <FormField
                    label={field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                    error={passwordForm.formState.errors[field]?.message}
                  >
                    <input
                      type="password"
                      autoComplete={field === "currentPassword" ? "current-password" : "new-password"}
                      className={`app-input ${passwordForm.formState.errors[field] ? "app-input-error" : ""}`}
                      {...passwordForm.register(field)}
                    />
                    {field === "newPassword" && <PasswordStrength password={passwordForm.watch("newPassword") ?? ""} />}
                  </FormField>
                  </div>
                ))}
                <button type="submit" disabled={changePassword.isPending} className="app-btn-primary cursor-pointer">
                  Update password
                </button>
              </form>

              <div className="app-divider pt-6">
                <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--app-error-fg)" }}>
                  <AlertTriangle className="h-4 w-4" />
                  Deactivate account
                </h2>
                <p className="text-xs app-muted mt-1 mb-3">This disables sign-in and logs you out immediately.</p>
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
                  className="app-btn-ghost text-sm cursor-pointer"
                  style={{ borderColor: "var(--app-error-border)", color: "var(--app-error-fg)" }}
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
                updatePreferences.mutate(data, {
                  onSuccess: () => {
                    setTheme(data.theme as ThemePreference);
                    localStorage.setItem("theme", data.theme);
                    refreshUser();
                  },
                })
              )}
            >
              <div>
                <label className="app-label">Theme</label>
                <select className="app-input" {...prefsForm.register("theme")}>
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
                <label key={name} className="flex items-center gap-2 text-sm app-heading cursor-pointer">
                  <input type="checkbox" {...prefsForm.register(name as "notifyEmail")} />
                  {label}
                </label>
              ))}
              <button type="submit" disabled={updatePreferences.isPending} className="app-btn-primary cursor-pointer">
                Save preferences
              </button>
            </form>
          )}

          {tab === "sessions" && (
            <div className="space-y-3">
              <p className="text-xs app-muted">Revoke sessions on devices you no longer use.</p>
              {sessions?.map((s) => (
                <div key={s.id} className="flex items-center justify-between app-card-muted p-3 text-xs">
                  <div>
                    <p className="font-semibold app-heading">{s.deviceLabel || "Unknown device"}</p>
                    <p className="app-muted">
                      {s.ipAddress ? `From ${s.ipAddress}` : "Location not recorded"}
                      {" · "}Last active {new Date(s.lastActiveAt).toLocaleString("en-GB")}
                    </p>
                    {s.isCurrent && <span className="app-status-pill mt-1">Current session</span>}
                  </div>
                  {!s.isCurrent && !s.revokedAt && (
                    <button
                      type="button"
                      onClick={() => revokeSession.mutate(s.id)}
                      className="p-2 rounded-lg cursor-pointer hover:bg-[var(--app-hover)]"
                      style={{ color: "var(--app-error-fg)" }}
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
