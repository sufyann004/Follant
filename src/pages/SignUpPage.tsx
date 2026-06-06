import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../contexts/AuthContext";
import { signUpSchema } from "../types";
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";

type SignUpFormInputs = typeof signUpSchema._input;

export default function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormInputs>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignUpFormInputs) => {
    setGlobalError(null);
    try {
      await signUp(data.email, data.password, data.fullName);
      navigate("/orgs");
    } catch (err: any) {
      setGlobalError(err.message || "An unexpected registration error occurred.");
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
          <p className="text-sm text-slate-500 mt-1">Create an admin account to start provisioning</p>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/85 p-6 sm:p-8">
          {globalError && (
            <div className="mb-5 bg-rose-50 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-700 font-medium">
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Full Name Field */}
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="Sarah Jenkins"
                className={`w-full px-3.5 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                  errors.fullName 
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" 
                    : "border-slate-300 focus:border-indigo-600"
                }`}
                {...register("fullName")}
              />
              {errors.fullName && (
                <p className="text-rose-500 text-[11px] font-medium mt-1">{errors.fullName.message}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="sarah@example.com"
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
              id="submit-signup"
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-sm transition-all cursor-pointer shadow-sm disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Admin Account"
              )}
            </button>
          </form>

          {/* Prompt Sign-In Link */}
          <div className="mt-6 text-center text-xs text-slate-500">
            Already registered?{" "}
            <Link to="/sign-in" className="text-indigo-600 hover:text-indigo-700 font-semibold underline">
              Sign in to admin console
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
