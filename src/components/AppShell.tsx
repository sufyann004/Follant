import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Plus,
  LogOut,
  FolderIcon,
  Menu,
  X,
  Activity,
  Settings,
  BarChart3,
} from "lucide-react";
import { FollantBrand } from "./FollantLogo";
import { ThemeToggle } from "./ThemeToggle";
import { useConfirm } from "./ConfirmProvider";

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/orgs") {
    return pathname === "/orgs" || (pathname.startsWith("/orgs/") && !pathname.startsWith("/orgs/new"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const confirm = useConfirm();

  const navigation = [
    { name: "Organisations", href: "/orgs", icon: FolderIcon },
    { name: "Statistics", href: "/statistics", icon: BarChart3 },
    { name: "Create organisation", href: "/orgs/new", icon: Plus },
    { name: "Activity Log", href: "/activity", icon: Activity },
    { name: "Account", href: "/account", icon: Settings },
  ];

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    const ok = await confirm({
      title: "Sign out?",
      description: "You will need to sign in again to access your organisations and account settings.",
      confirmLabel: "Sign out",
      cancelLabel: "Stay signed in",
      variant: "default",
    });
    if (!ok) return;
    signOut();
    navigate("/sign-in");
  };

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
      active
        ? "app-nav-tab-active shadow-sm"
        : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
    }`;

  return (
    <div className="min-h-screen app-shell-main flex flex-col md:flex-row overflow-x-hidden">
      <header className="md:hidden sticky top-0 z-30 bg-neutral-950 text-white px-4 py-3 flex items-center justify-between border-b border-neutral-800">
        <FollantBrand logoClassName="h-8 w-8" wordmarkClassName="font-bold text-base sm:text-lg tracking-tight" />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -mr-1 hover:bg-neutral-800 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute top-0 left-0 right-0 max-h-[85dvh] overflow-y-auto bg-neutral-950 text-white border-b border-neutral-800 shadow-xl">
            <div className="px-4 py-3 flex flex-col gap-1">
              <div className="py-2 border-b border-neutral-800 flex items-center gap-2 px-1 mb-1">
                <div className="h-9 w-9 app-avatar text-sm shrink-0">
                  {user?.fullName?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-neutral-200 truncate">{user?.fullName}</p>
                  <p className="text-[10px] text-neutral-500 truncate">{user?.email}</p>
                </div>
                <ThemeToggle compact />
              </div>
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(location.pathname, item.href);
                return (
                  <Link key={item.name} to={item.href} className={navLinkClass(active)}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 mt-2 text-left rounded-lg text-sm font-medium text-red-400 hover:bg-neutral-800 transition-all border-t border-neutral-800 pt-3"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-neutral-950 text-white min-h-screen border-r border-neutral-800">
        <div className="px-6 py-6 border-b border-neutral-800">
          <FollantBrand wordmarkClassName="font-bold text-lg tracking-tight text-white" />
        </div>

        <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(location.pathname, item.href);
            return (
              <Link key={item.name} to={item.href} className={navLinkClass(active)}>
                <Icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800 flex flex-col gap-3">
          <ThemeToggle compact />
          <div className="flex items-center gap-3 px-2 py-0.5 min-w-0">
            <div className="h-9 w-9 app-avatar text-sm shrink-0">
              {user?.fullName?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-neutral-100 truncate">{user?.fullName}</p>
              <p className="text-[10px] text-neutral-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-xs font-semibold text-red-400 hover:bg-neutral-800 transition-all cursor-pointer border border-neutral-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 max-w-7xl md:mx-auto">
        {children}
      </main>
    </div>
  );
}
