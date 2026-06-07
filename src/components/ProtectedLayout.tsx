import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AppShell from "./AppShell";
import { Loader2 } from "lucide-react";

export default function ProtectedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-500 animate-pulse">Loading administrative console...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
