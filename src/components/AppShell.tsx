import { useState, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { 
  Building2, 
  Plus, 
  LogOut, 
  FolderIcon, 
  Menu, 
  X, 
  Activity,
  Settings,
} from "lucide-react";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Organizations", href: "/orgs", icon: FolderIcon },
    { name: "Create Organization", href: "/orgs/new", icon: Plus },
    { name: "Activity Log", href: "/activity", icon: Activity },
    { name: "Account", href: "/account", icon: Settings },
  ];

  const handleSignOut = () => {
    signOut();
    navigate("/sign-in");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-400" />
          <span className="font-bold text-lg tracking-tight">Admin Dashboard</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 hover:bg-slate-800 rounded-md focus:outline-none"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 text-white border-t border-slate-800 px-4 py-3 flex flex-col gap-2 shadow-inner">
          <div className="py-2 border-b border-slate-800 flex items-center gap-2 px-2">
            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm text-white">
              {user?.fullName?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  active 
                    ? "bg-indigo-600 text-white font-medium" 
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 mt-4 text-left rounded-lg text-sm font-medium text-rose-400 hover:bg-slate-800 transition-all border-t border-slate-800/50 pt-3"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white min-h-screen shadow-lg">
        {/* Logo Section */}
        <div className="px-6 py-6 border-b border-slate-800 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-400" />
          <span className="font-bold text-lg tracking-tight">Admin Dashboard</span>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active 
                    ? "bg-indigo-600 text-white font-medium shadow-sm" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Sign Out footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/65 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2 py-0.5">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-inner">
              {user?.fullName?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-100 truncate">{user?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-xs font-semibold text-rose-400 bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer shadow-sm border border-slate-800/80"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
