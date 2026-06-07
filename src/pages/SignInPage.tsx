import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../contexts/AuthContext";
import { signInSchema } from "../types";
import { Building2, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";

type SignInFormInputs = typeof signInSchema._input;

export default function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormInputs>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInFormInputs) => {
    setGlobalError(null);
    try {
      await signIn(data.email, data.password);
      navigate("/orgs");
    } catch (err: any) {
      setGlobalError(err.message || "An unexpected sign-in error occurred.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md mb-3 text-white">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage and provision organizations</p>
        </div>

        {/* Credentials Sandbox Showcase Helper */}
        <div className="mb-6 bg-indigo-50 border border-indigo-100/80 rounded-xl p-4 shadow-sm flex gap-3 text-indigo-900">
          <KeyRound className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Seeded Test Admin Credentials:</p>
            <p><span className="font-semibold text-indigo-700">Email:</span> admin@example.com</p>
            <p><span className="font-semibold text-indigo-700">Password:</span> Password123!</p>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/85 p-6 sm:p-8">
          {globalError && (
            <div className="mb-5 bg-rose-50 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-700 font-medium">
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                className={`w-full px-3.5 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                  errors.email 
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" 
                    : "border-slate-300 focus:border-indigo-600"
                }`}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`w-full pl-3.5 pr-10 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                    errors.password 
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" 
                      : "border-slate-300 focus:border-indigo-600"
                  }`}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              id="submit-signin"
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-sm transition-all cursor-pointer shadow-sm disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying session...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Prompt Sign-Up Link */}
          <div className="mt-6 text-center text-xs text-slate-500">
            Account needed?{" "}
            <Link to="/sign-up" className="text-indigo-600 hover:text-indigo-700 font-semibold underline">
              Create an admin account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
