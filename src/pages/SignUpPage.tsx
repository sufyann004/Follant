import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../contexts/AuthContext";
import { signUpSchema } from "../types";
import { FormField } from "../components/forms/FormField";
import { EmailInput } from "../components/forms/EmailInput";
import { PhoneInput } from "../components/forms/PhoneInput";
import { PasswordStrength } from "../components/forms/PasswordStrength";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import type { z } from "zod";

type SignUpFormInputs = z.input<typeof signUpSchema>;

export default function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const methods = useForm<SignUpFormInputs>({
    resolver: zodResolver(signUpSchema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      phoneDial: "+44",
      phoneNational: "",
      phone: "",
      jobTitle: "",
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

  const onSubmit = async (data: SignUpFormInputs) => {
    setGlobalError(null);
    try {
      await signUp(data.email, data.password, data.fullName, {
        phone: data.phone || undefined,
        jobTitle: data.jobTitle || undefined,
        timezone: data.timezone || undefined,
      });
      navigate("/orgs");
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : "An unexpected registration error occurred.");
    }
  };

  return (
    <div className="app-page flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 app-icon-brand mb-3">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight app-heading">Follant</h1>
          <p className="text-sm app-muted mt-1">Create an account to get started</p>
        </div>

        <div className="app-card rounded-2xl p-6 sm:p-8">
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
                <EmailInput name="email" id="email" />
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

              <button id="submit-signup" type="submit" disabled={isSubmitting} className="w-full app-btn-primary py-2.5">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </form>
          </FormProvider>

          <div className="mt-6 text-center text-xs app-muted">
            Already registered?{" "}
            <Link to="/sign-in" className="app-link">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
