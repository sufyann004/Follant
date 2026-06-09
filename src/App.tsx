import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeSync } from "./components/ThemeSync";
import { ConfirmProvider } from "./components/ConfirmProvider";
import ProtectedLayout from "./components/ProtectedLayout";
import SignInPage from "./pages/SignInPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import OrgDirectoryPage from "./pages/OrgDirectoryPage";
import CreateOrgPage from "./pages/CreateOrgPage";
import OrgDetailPage from "./pages/OrgDetailPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import StatisticsPage from "./pages/StatisticsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function SignUpRedirect() {
  const location = useLocation();
  return <Navigate to={`/accept-invite${location.search}`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfirmProvider>
          <ThemeSync />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/sign-up" element={<SignUpRedirect />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected Authorized Admin Shell */}
            <Route path="/" element={<ProtectedLayout />}>
              {/* Redirect root domain straight to directory list */}
              <Route index element={<Navigate to="/orgs" replace />} />
              <Route path="orgs" element={<OrgDirectoryPage />} />
              <Route path="orgs/new" element={<CreateOrgPage />} />
              <Route path="orgs/:id" element={<OrgDetailPage />} />
              <Route path="account" element={<AccountSettingsPage />} />
              <Route path="activity" element={<ActivityLogPage />} />
              <Route path="statistics" element={<StatisticsPage />} />
            </Route>

            {/* Wildcard Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </BrowserRouter>
          </ConfirmProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
