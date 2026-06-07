import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AppShell from "./AppShell";
import { LoadingState } from "./QueryState";

export default function ProtectedLayout() {
  const { user, isLoading, signOut } = useAuth();
  const location = useLocation();

  const blockedReason =
    user?.accountStatus === "deactivated" || user?.accountStatus === "suspended"
      ? "Your account is not active. Contact an administrator."
      : user && !user.isAdmin
        ? "Admin access required."
        : null;

  useEffect(() => {
    if (blockedReason) signOut();
  }, [blockedReason, signOut]);

  if (isLoading) {
    return (
      <div className="app-page flex flex-col items-center justify-center p-6 min-h-screen">
        <LoadingState message="Loading…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  if (blockedReason) {
    return <Navigate to="/sign-in" replace state={{ message: blockedReason }} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
