import { useStatistics } from "../hooks/useStatistics";
import { QueryState } from "../components/QueryState";
import { ORG_TYPES, ORG_TYPE_LABELS, type OrgType } from "../types";
import { BarChart3, Building2, Users, Mail, Activity, CalendarDays } from "lucide-react";

const ORG_TYPE_STAT_LABELS: Record<OrgType, string> = {
  school: `${ORG_TYPE_LABELS.school}s`,
  nonprofit: "Charities",
  business: `${ORG_TYPE_LABELS.business}es`,
};

const ORG_TYPE_TONE: Record<OrgType, string> = {
  school: "app-type-school",
  nonprofit: "app-type-nonprofit",
  business: "app-type-business",
};

const ORG_TYPE_BAR: Record<OrgType, string> = {
  school: "#3b82f6",
  nonprofit: "#ec4899",
  business: "#f97316",
};

type StatTone = "violet" | "sky" | "emerald" | "amber" | "rose" | "indigo";

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
  hint?: string;
  tone: StatTone;
}) {
  return (
    <div className={`app-stat-card app-stat-${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide app-muted truncate">
            {label}
          </p>
          <p className="app-stat-value text-2xl sm:text-3xl font-bold tabular-nums mt-1">
            {value.toLocaleString()}
          </p>
        </div>
        <div className="app-stat-icon">
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
        </div>
      </div>
      {hint && <p className="text-[11px] sm:text-xs app-muted leading-snug">{hint}</p>}
    </div>
  );
}

export default function StatisticsPage() {
  const { data: stats, isLoading, isError, error, refetch } = useStatistics();

  return (
    <div className="space-y-5 sm:space-y-6 min-w-0">
      <div className="flex flex-col gap-1 sm:gap-1.5">
        <h1 className="text-xl sm:text-2xl font-bold text-app-heading flex items-center gap-2 flex-wrap">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--app-brand-muted)] text-[var(--app-brand)]">
            <BarChart3 className="h-5 w-5" aria-hidden />
          </span>
          Statistics
        </h1>
        <p className="text-xs sm:text-sm app-muted max-w-2xl">
          A quick snapshot of your organisations, members, and recent activity.
        </p>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        data={stats}
        loadingVariant="skeleton"
        loadingMessage="Loading statistics…"
        onRetry={() => refetch()}
      >
        {(data) => (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <StatCard label="Organisations" value={data.totalOrganizations} icon={Building2} tone="violet" />
              <StatCard label="Total members" value={data.totalMembers} icon={Users} tone="sky" />
              <StatCard
                label="Active members"
                value={data.activeMembers}
                icon={Users}
                hint="Accepted invitations"
                tone="emerald"
              />
              <StatCard label="Pending invites" value={data.pendingInvites} icon={Mail} tone="amber" />
              <StatCard
                label="Activity (7 days)"
                value={data.activityLast7Days}
                icon={Activity}
                hint="Your activity this week"
                tone="rose"
              />
              <StatCard
                label="New orgs this month"
                value={data.organizationsCreatedThisMonth}
                icon={CalendarDays}
                tone="indigo"
              />
            </div>

            <div className="app-card p-4 sm:p-5 min-w-0">
              <h2 className="text-sm font-semibold text-app-heading mb-3 sm:mb-4">
                Organisations by type
              </h2>
              <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-3 gap-3">
                {ORG_TYPES.map((type) => {
                  const count = data.organizationsByType[type] ?? 0;
                  const total = data.totalOrganizations || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div
                      key={type}
                      className="rounded-xl border p-4 min-w-0"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card-muted)",
                      }}
                    >
                      <span className={`app-type-badge ${ORG_TYPE_TONE[type]}`}>
                        {ORG_TYPE_STAT_LABELS[type]}
                      </span>
                      <p className="text-2xl sm:text-3xl font-bold text-app-heading mt-3 tabular-nums">
                        {count}
                      </p>
                      <div className="app-type-bar mt-3">
                        <div
                          className="app-type-bar-fill"
                          style={{
                            width: `${data.totalOrganizations ? pct : 0}%`,
                            backgroundColor: ORG_TYPE_BAR[type],
                          }}
                        />
                      </div>
                      <p className="text-[11px] app-muted mt-2">
                        {data.totalOrganizations ? `${pct}% of total` : "No organisations yet"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
