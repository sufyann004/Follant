import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../contexts/AuthContext";
import { signInSchema } from "../types";
import { FollantLogo } from "@/src/components/FollantLogo";
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { FormField } from "@/src/components/forms/FormField";
import type { z } from "zod";

type SignInFormInputs = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inviteOrgId = searchParams.get("org") ?? searchParams.get("orgId") ?? "";
  const prefilledEmail = searchParams.get("email") ?? "";

  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(
    (location.state as { message?: string } | null)?.message ?? null,
  );

  useEffect(() => {
    const msg = (location.state as { message?: string } | null)?.message;
    if (msg) setGlobalError(msg);
  }, [location.state]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormInputs>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: prefilledEmail, password: "" },
  });

  const onSubmit = async (data: SignInFormInputs) => {
    setGlobalError(null);
    try {
      await signIn(data.email, data.password);
      navigate(inviteOrgId ? `/orgs/${inviteOrgId}` : "/orgs");
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : "An unexpected sign-in error occurred.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <FollantLogo className="mb-3 h-16 w-16 rounded-xl shadow-sm" />
          <h1 className="text-2xl font-bold tracking-tight">Follant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {inviteOrgId ? "Sign in to accept your invitation" : "Sign in to your organisation workspace"}
          </p>
        </div>

        <Alert className="border-dashed">
          <KeyRound className="h-4 w-4" />
          <AlertTitle className="text-xs">Invitation-only access</AlertTitle>
          <AlertDescription className="text-xs">
            New accounts are created only through an organisation invitation email. If you were invited, use the link
            in that email to set up your account.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use the email address your invitation was sent to.</CardDescription>
          </CardHeader>
          <CardContent>
            {globalError && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{globalError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <FormField label="Email address" htmlFor="email" error={errors.email?.message} required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </FormField>

              <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
                <div className="space-y-2">
                  <div className="flex items-center justify-end">
                    <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
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
                </div>
              </FormField>

              <Button id="submit-signin" type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center text-center text-xs text-muted-foreground">
            Waiting for an invite? Ask your organisation admin to send one to your work email.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
