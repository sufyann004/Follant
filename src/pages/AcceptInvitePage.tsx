import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../contexts/AuthContext";
import { acceptInviteSchema, MEMBER_ROLE_LABELS } from "../types";
import { fetchInvitePreview } from "../lib/auth-api";
import { FormField } from "../components/forms/FormField";
import { EmailInput } from "../components/forms/EmailInput";
import { PhoneInput } from "../components/forms/PhoneInput";
import { PasswordStrength } from "../components/forms/PasswordStrength";
import { FollantLogo } from "../components/FollantLogo";
import { Eye, EyeOff, Loader2, Mail } from "lucide-react";
import type { z } from "zod";

type AcceptInviteInputs = z.input<typeof acceptInviteSchema>;

export default function AcceptInvitePage() {
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org") ?? searchParams.get("orgId") ?? "";
  const inviteEmail = (searchParams.get("email") ?? "").trim().toLowerCase();

  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const previewQuery = useQuery({
    queryKey: ["invite-preview", orgId, inviteEmail],
    queryFn: () => fetchInvitePreview(orgId, inviteEmail),
    enabled: Boolean(orgId && inviteEmail),
    retry: false,
  });

  const methods = useForm<AcceptInviteInputs>({
    resolver: zodResolver(acceptInviteSchema),
    mode: "onChange",
    values: {
      fullName: "",
      email: inviteEmail,
      password: "",
      phoneDial: "+44",
      phoneNational: "",
      phone: "",
      jobTitle: previewQuery.data?.title?.trim() ?? "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = methods;

  const password = watch("password") ?? "";
  const preview = previewQuery.data;

  const onSubmit = async (data: AcceptInviteInputs) => {
    if (!orgId) return;
    setGlobalError(null);
    try {
      const acceptedOrgId = await acceptInvite(orgId, data.email, data.password, data.fullName, {
        phone: typeof data.phone === "string" ? data.phone || undefined : undefined,
        jobTitle: typeof data.jobTitle === "string" ? data.jobTitle || undefined : undefined,
        timezone: typeof data.timezone === "string" ? data.timezone || undefined : undefined,
      });
      navigate(`/orgs/${acceptedOrgId}`);
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : "Could not accept this invitation.");
    }
  };

  if (!orgId || !inviteEmail) {
    return (
      <InviteShell>
        <div className="app-error-box text-sm">
          <p className="font-bold">Invalid invitation link</p>
          <p className="mt-1">Use the link from your invitation email, or ask your organisation admin to send a new invite.</p>
        </div>
        <p className="mt-6 text-center text-xs app-muted">
          Already have an account? <Link to="/sign-in" className="app-link">Sign in</Link>
        </p>
      </InviteShell>
    );
  }

  if (previewQuery.isLoading) {
    return (
      <InviteShell>
        <div className="flex items-center justify-center gap-2 py-12 app-muted text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking invitation…
        </div>
      </InviteShell>
    );
  }

  if (previewQuery.isError || !preview) {
    return (
      <InviteShell>
        <div className="app-error-box text-sm">
          <p className="font-bold">Invitation not found</p>
          <p className="mt-1">
            {previewQuery.error instanceof Error
              ? previewQuery.error.message
              : "This link may have expired or already been used."}
          </p>
        </div>
        <p className="mt-6 text-center text-xs app-muted">
          <Link to="/sign-in" className="app-link">Sign in</Link> if you already accepted this invite.
        </p>
      </InviteShell>
    );
  }

  if (preview.memberStatus === "active") {
    return (
      <InviteShell>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-muted)] p-5 text-sm">
          <p className="font-bold app-heading">Invitation already accepted</p>
          <p className="mt-2 app-muted">
            <strong>{preview.email}</strong> is already an active member of <strong>{preview.orgName}</strong>.
          </p>
          <Link to="/sign-in" className="inline-flex mt-4 app-btn-primary text-sm px-4 py-2">
            Sign in
          </Link>
        </div>
      </InviteShell>
    );
  }

  if (preview.memberStatus !== "invited") {
    return (
      <InviteShell>
        <div className="app-error-box text-sm">
          <p className="font-bold">Invitation not available</p>
          <p className="mt-1">
            This invitation for <strong>{preview.orgName}</strong> is no longer active. Contact your organisation
            administrator if you need access.
          </p>
        </div>
        <p className="mt-6 text-center text-xs app-muted">
          <Link to="/sign-in" className="app-link">Sign in</Link> if you already have an account.
        </p>
      </InviteShell>
    );
  }

  if (preview.canAcceptWhileSignedIn) {
    return (
      <InviteShell>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-muted)] p-5 text-sm space-y-3">
          <p className="font-bold app-heading">Sign in to accept</p>
          <p className="app-muted">
            You already have an account for <strong>{preview.email}</strong>. Sign in to join{" "}
            <strong>{preview.orgName}</strong> as {MEMBER_ROLE_LABELS[preview.role]?.split(" — ")[0] ?? preview.role}.
          </p>
          <Link
            to={`/sign-in?email=${encodeURIComponent(preview.email)}&org=${encodeURIComponent(orgId)}`}
            className="inline-flex app-btn-primary text-sm px-4 py-2"
          >
            Sign in to accept
          </Link>
        </div>
      </InviteShell>
    );
  }

  return (
    <InviteShell
      subtitle={
        <>
          Join <strong>{preview.orgName}</strong> as{" "}
          {MEMBER_ROLE_LABELS[preview.role]?.split(" — ")[0] ?? preview.role}
        </>
      }
    >
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-muted)] p-4 text-sm">
        <Mail className="h-5 w-5 shrink-0 app-muted mt-0.5" />
        <div>
          <p className="font-semibold app-heading">Invitation pending</p>
          <p className="mt-1 app-muted">
            Set up your account for <strong>{preview.email}</strong>. Access is by invitation only.
          </p>
        </div>
      </div>

      {globalError && <div className="mb-5 app-error-box">{globalError}</div>}

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <FormField label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Sarah Jenkins"
              className={`app-input ${errors.fullName ? "app-input-error" : ""}`}
              {...register("fullName")}
            />
          </FormField>

          <FormField label="Email address" htmlFor="email" required error={errors.email?.message}>
            <EmailInput name="email" id="email" readOnly />
          </FormField>

          <FormField
            label="Phone"
            hint="Optional — used for account recovery and notifications"
            error={errors.phoneNational?.message || errors.phone?.message}
          >
            <PhoneInput name="phone" dialField="phoneDial" nationalField="phoneNational" />
          </FormField>

          <FormField label="Job title" htmlFor="jobTitle" hint="Optional">
            <input
              id="jobTitle"
              type="text"
              autoComplete="organization-title"
              placeholder="Director of Operations"
              className="app-input"
              {...register("jobTitle")}
            />
          </FormField>

          <FormField label="Password" htmlFor="password" required error={errors.password?.message}>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`app-input pr-10 ${errors.password ? "app-input-error" : ""}`}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 app-muted hover:opacity-80 focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </FormField>

          <input type="hidden" {...register("timezone")} />

          <button type="submit" disabled={isSubmitting} className="w-full app-btn-primary py-2.5">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Accepting invitation…
              </>
            ) : (
              "Accept invitation"
            )}
          </button>
        </form>
      </FormProvider>

      <p className="mt-6 text-center text-xs app-muted">
        Already have an account?{" "}
        <Link
          to={`/sign-in?email=${encodeURIComponent(inviteEmail)}&org=${encodeURIComponent(orgId)}`}
          className="app-link"
        >
          Sign in
        </Link>
      </p>
    </InviteShell>
  );
}

function InviteShell({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="app-page flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <FollantLogo className="h-16 w-16 rounded-xl mb-3" alt="" />
          <h1 className="text-2xl font-bold tracking-tight app-heading">Accept invitation</h1>
          {subtitle ? (
            <p className="text-sm app-muted mt-1 text-center">{subtitle}</p>
          ) : (
            <p className="text-sm app-muted mt-1 text-center">Access is by invitation only</p>
          )}
        </div>
        <div className="app-card rounded-2xl p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
