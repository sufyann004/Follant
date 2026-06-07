import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedLayout from "./components/ProtectedLayout";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import OrgDirectoryPage from "./pages/OrgDirectoryPage";
import CreateOrgPage from "./pages/CreateOrgPage";
import OrgDetailPage from "./pages/OrgDetailPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import ActivityLogPage from "./pages/ActivityLogPage";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />

            {/* Protected Authorized Admin Shell */}
            <Route path="/" element={<ProtectedLayout />}>
              {/* Redirect root domain straight to directory list */}
              <Route index element={<Navigate to="/orgs" replace />} />
              <Route path="orgs" element={<OrgDirectoryPage />} />
              <Route path="orgs/new" element={<CreateOrgPage />} />
              <Route path="orgs/:id" element={<OrgDetailPage />} />
              <Route path="account" element={<AccountSettingsPage />} />
              <Route path="activity" element={<ActivityLogPage />} />
            </Route>

            {/* Wildcard Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
