import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../contexts/AuthContext";
import { resetPasswordSchema } from "../types";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { isSupabaseConfigured } from "../lib/env";
import { getSupabaseClient } from "../lib/supabase";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { FormField } from "@/src/components/forms/FormField";
import type { z } from "zod";

type ResetPasswordInputs = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { completePasswordReset } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(!isSupabaseConfigured());
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
        return;
      }
      const hash = window.location.hash.replace(/^#/, "");
      if (hash.includes("type=recovery") || hash.includes("access_token")) {
        setReady(true);
      } else {
        setGlobalError("This reset link is invalid or has expired. Request a new one.");
      }
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInputs>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordInputs) => {
    setGlobalError(null);
    try {
      await completePasswordReset(data.password, token ?? undefined);
      navigate("/sign-in", { state: { message: "Password updated. Sign in with your new password." } });
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : "Could not reset password.");
    }
  };

  const canSubmit = ready && (isSupabaseConfigured() || !!token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Must be at least 8 characters with mixed case and a number.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Update password</CardTitle>
            <CardDescription>Enter and confirm your new password below.</CardDescription>
          </CardHeader>
          <CardContent>
            {globalError && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{globalError}</AlertDescription>
              </Alert>
            )}

            {canSubmit ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <FormField label="New password" htmlFor="password" error={errors.password?.message} required>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      className="pr-10"
                      aria-invalid={!!errors.password}
                      {...register("password")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormField>

                <FormField
                  label="Confirm password"
                  htmlFor="confirmPassword"
                  error={errors.confirmPassword?.message}
                  required
                >
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    aria-invalid={!!errors.confirmPassword}
                    {...register("confirmPassword")}
                  />
                </FormField>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>
            ) : (
              !globalError && (
                <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying reset link...
                </p>
              )
            )}
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Request a new link
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
