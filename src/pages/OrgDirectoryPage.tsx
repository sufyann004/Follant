import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOrganizations } from "../hooks/useOrganizations";
import { 
  Plus, 
  Search, 
  School, 
  Briefcase, 
  HeartHandshake, 
  ArrowRight,
  FolderOpen,
  Calendar,
  Users
} from "lucide-react";
import { type OrgType } from "../types";

// Dynamic map of styles per Org type badge
const TYPE_BADGES: Record<OrgType, { label: string; bg: string; text: string; icon: any }> = {
  school: { 
    label: "School", 
    bg: "bg-blue-50 border-blue-200/60", 
    text: "text-blue-700", 
    icon: School 
  },
  nonprofit: { 
    label: "Nonprofit", 
    bg: "bg-emerald-50 border-emerald-200/60", 
    text: "text-emerald-700", 
    icon: HeartHandshake 
  },
  business: { 
    label: "Business", 
    bg: "bg-amber-50 border-amber-200/60", 
    text: "text-amber-700", 
    icon: Briefcase 
  },
};

export default function OrgDirectoryPage() {
  const navigate = useNavigate();
  const { data: orgs, isLoading, isError, error } = useOrganizations();
  
  // States for search and type filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredOrgs = orgs?.filter((org) => {
    const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || org.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organizations Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse, inspect, and invite members across schools, businesses, and charity programs under your purview.
          </p>
        </div>
        <Link
          id="create-org-btn"
          to="/orgs/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Create Organization
        </Link>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="h-10 w-full bg-slate-200/50 animate-pulse rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-44 rounded-xl border border-slate-200/80 bg-white p-5 space-y-4 shadow-sm animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-5 w-32 bg-slate-200 rounded" />
                  <div className="h-6 w-20 bg-slate-200 rounded-full" />
                </div>
                <div className="space-y-2 pt-2">
                  <div className="h-3 w-3/4 bg-slate-200 rounded" />
                  <div className="h-3 w-1/2 bg-slate-200 rounded" />
                </div>
                <div className="flex justify-between pt-4 border-t border-slate-100">
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                  <div className="h-4 w-24 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Frame */}
      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-center text-rose-800">
          <p className="font-semibold">Failed to load organizations</p>
          <p className="text-xs text-rose-600 mt-1">{error?.message || "Unknown retrieval error"}</p>
        </div>
      )}

      {/* Loaded App Logic */}
      {!isLoading && !isError && orgs && (
        <>
          {/* Filters Row */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search organizations by name..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>
            {/* Type Filter Select */}
            <div className="sm:w-48">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-600 cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="school">Schools</option>
                <option value="nonprofit">Nonprofits</option>
                <option value="business">Businesses</option>
              </select>
            </div>
          </div>

          {/* Empty State */}
          {filteredOrgs?.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl py-12 px-6 text-center shadow-sm flex flex-col items-center justify-center max-w-lg mx-auto mt-6">
              <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 mb-4">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">No Organizations Found</h3>
              <p className="text-xs text-slate-500 mt-1.5 max-w-xs">
                {searchQuery || typeFilter !== "all" 
                  ? "Adjust or clear your search criteria and filters to locate desired accounts."
                  : "Every administrative dashboard starts empty. Begin by creating your very first organization now."}
              </p>
              {!(searchQuery || typeFilter !== "all") && (
                <Link
                  to="/orgs/new"
                  className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Organization
                </Link>
              )}
            </div>
          ) : (
            /* Bento Grid organizations list */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOrgs?.map((org) => {
                const badge = TYPE_BADGES[org.type] || { label: org.type, bg: "bg-slate-50", text: "text-slate-700", icon: FolderOpen };
                const CategoryIcon = badge.icon;
                return (
                  <div
                    key={org.id}
                    id={`org-card-${org.id}`}
                    onClick={() => navigate(`/orgs/${org.id}`)}
                    className="group bg-white rounded-xl border border-slate-200/80 hover:border-indigo-500/30 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div className="space-y-2.5">
                      {/* Top Row Badging */}
                      <div className="flex items-start justify-between gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-[11px] font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                          <CategoryIcon className="h-3 w-3 shrink-0" />
                          {badge.label}
                        </span>
                        
                        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {new Date(org.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>

                      {/* Org Name */}
                      <h2 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors text-base line-clamp-1">
                        {org.name}
                      </h2>

                      {/* Type-Specific Meta */}
                      <p className="text-xs text-slate-500 font-mono italic">
                        {org.type === "school" && `District: ${org.schoolDistrict}`}
                        {org.type === "nonprofit" && `EIN: ${org.nonprofitEin}`}
                        {org.type === "business" && `Reg ID: ${org.businessRegNumber}`}
                      </p>
                    </div>

                    {/* Footer Metrics */}
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-slate-500">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-700">{org._count_members || 0}</span>
                        <span>{org._count_members === 1 ? "member" : "members"}</span>
                      </div>
                      <span className="text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        Manage <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
