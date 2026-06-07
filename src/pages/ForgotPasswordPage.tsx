import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../contexts/AuthContext";
import { forgotPasswordSchema } from "../types";
import { Building2, Loader2, Mail } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { FormField } from "@/src/components/forms/FormField";
import type { z } from "zod";

type ForgotPasswordInputs = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInputs>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordInputs) => {
    setGlobalError(null);
    try {
      await requestPasswordReset(data.email);
      setSubmitted(true);
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : "Could not send reset email.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{submitted ? "Check your email" : "Forgot password"}</CardTitle>
            <CardDescription>
              {submitted
                ? "If an account exists, a reset link is on its way."
                : "We'll email you a secure link to set a new password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Check your inbox for the reset link. It may take a few minutes to arrive.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/sign-in">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <>
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
                      placeholder="you@example.co.uk"
                      aria-invalid={!!errors.email}
                      {...register("email")}
                    />
                  </FormField>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send reset link"
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
          {!submitted && (
            <CardFooter className="justify-center text-xs text-muted-foreground">
              Remember your password?{" "}
              <Link to="/sign-in" className="ml-1 font-medium text-primary hover:underline">
                Sign in
              </Link>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
