import { useState } from "react";
import { Link } from "react-router-dom";
import { useOrganizations } from "../hooks/useOrganizations";
import { QueryState, EmptyState } from "../components/QueryState";
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
import { type OrgType, ORG_TYPE_LABELS } from "../types";

const TYPE_BADGES: Record<OrgType, { label: string; icon: typeof School; tone: string }> = {
  school: { label: "School", icon: School, tone: "app-type-school" },
  nonprofit: { label: ORG_TYPE_LABELS.nonprofit, icon: HeartHandshake, tone: "app-type-nonprofit" },
  business: { label: "Business", icon: Briefcase, tone: "app-type-business" },
};

export default function OrgDirectoryPage() {
  const { data: orgs, isLoading, isError, error, refetch } = useOrganizations();
  
  // States for search and type filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-app-heading">Organisations</h1>
          <p className="text-xs sm:text-sm app-muted mt-1">
            Schools, charities, and businesses you manage. Open any card to edit details or invite people.
          </p>
        </div>
        <Link
          id="create-org-btn"
          to="/orgs/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 app-btn-primary text-sm shrink-0 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Create organisation
        </Link>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        data={orgs}
        loadingVariant="skeleton"
        loadingMessage="Loading organisations…"
        errorTitle="Could not load organisations"
        onRetry={() => refetch()}
      >
        {(organizations) => {
          const filteredOrgs = organizations.filter((org) => {
            const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === "all" || org.type === typeFilter;
            return matchesSearch && matchesType;
          });

          return (
            <>
              <div className="app-card p-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 app-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name…"
                    className="app-input pl-10"
                  />
                </div>
                <div className="sm:w-48">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="app-input cursor-pointer"
                  >
                    <option value="all">All types</option>
                    <option value="school">Schools</option>
                    <option value="nonprofit">Charities</option>
                    <option value="business">Businesses</option>
                  </select>
                </div>
              </div>

              {filteredOrgs.length === 0 ? (
                <EmptyState
                  icon={<FolderOpen className="h-6 w-6" />}
                  title="No organisations found"
                  description={
                    searchQuery || typeFilter !== "all"
                      ? "Try a different search or clear your filters."
                      : "You haven't added any organisations yet. Create your first one to get started."
                  }
                  action={
                    !(searchQuery || typeFilter !== "all") ? (
                      <Link
                        to="/orgs/new"
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 app-btn-primary text-xs font-semibold transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add organisation
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredOrgs.map((org) => {
                    const badge = TYPE_BADGES[org.type] ?? {
                      label: org.type,
                      icon: FolderOpen,
                      tone: "app-badge",
                    };
                    const CategoryIcon = badge.icon;
                    return (
                      <Link
                        key={org.id}
                        id={`org-card-${org.id}`}
                        to={`/orgs/${org.id}`}
                        className="group app-card app-card-hover p-5 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer no-underline"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <span className={badge.tone.startsWith("app-type-") ? `app-type-badge ${badge.tone}` : "app-badge inline-flex items-center gap-1.5"}>
                              <CategoryIcon className="h-3 w-3 shrink-0" />
                              {badge.label}
                            </span>
                            <div className="flex items-center gap-1 font-mono text-[10px] app-muted">
                              <Calendar className="h-3 w-3" />
                              {new Date(org.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </div>
                          </div>
                          <h2 className="font-bold app-heading group-hover:opacity-80 transition-opacity text-base line-clamp-1">
                            {org.name}
                          </h2>
                          <p className="text-xs app-muted font-mono italic">
                            {org.type === "school" && org.schoolDistrict && `Trust: ${org.schoolDistrict}`}
                            {org.type === "nonprofit" && org.nonprofitEin && `Charity no.: ${org.nonprofitEin}`}
                            {org.type === "business" && org.businessRegNumber && `Co. no.: ${org.businessRegNumber}`}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-4 mt-4 app-divider app-muted">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Users className="h-3.5 w-3.5" />
                            <span className="font-semibold app-heading">{org._count_members || 0}</span>
                            <span>{org._count_members === 1 ? "member" : "members"}</span>
                          </div>
                          <span className="text-xs font-semibold app-link group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                            Manage <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
