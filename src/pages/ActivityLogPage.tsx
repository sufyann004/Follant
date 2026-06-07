import { useState } from "react";
import { useActivityLogs, useActivityActions } from "../hooks/useActivityLogs";
import { useAuth } from "../contexts/AuthContext";
import { ACTIVITY_ACTION_CATALOG, ACTIVITY_SEVERITY_LABELS, type ActivityLog, type ActivitySeverity } from "../types";
import { QueryState, EmptyState } from "../components/QueryState";
import { Activity, Shield } from "lucide-react";

const SEVERITY_CLASS: Record<ActivitySeverity, string> = {
  info: "app-severity-info",
  notice: "app-severity-notice",
  warning: "app-severity-warning",
  critical: "app-severity-critical",
};

function logMeta(log: ActivityLog) {
  const catalog = ACTIVITY_ACTION_CATALOG[log.action];
  const label = log.actionLabel ?? catalog?.label ?? log.action;
  const severity = (log.severity ?? catalog?.severity ?? "info") as ActivitySeverity;
  return { catalog, label, severity };
}

function ActivityLogMobileCard({ log }: { log: ActivityLog }) {
  const { catalog, label, severity } = logMeta(log);
  return (
    <div
      className="p-4 space-y-2 border-b last:border-b-0"
      style={{ borderColor: "var(--app-border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-app-heading text-sm min-w-0">{label}</div>
        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded font-medium ${SEVERITY_CLASS[severity]}`}>
          {ACTIVITY_SEVERITY_LABELS[severity]}
        </span>
      </div>
      <p className="text-xs app-muted">{new Date(log.createdAt).toLocaleString()}</p>
      <p className="text-xs break-words" style={{ color: "var(--app-fg)" }}>{log.description}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] app-muted pt-1">
        <span>{log.category ?? catalog?.category ?? "—"}</span>
        {log.actorName && <span>· {log.actorName}</span>}
        {log.organizationName && <span>· {log.organizationName}</span>}
      </div>
    </div>
  );
}

export default function ActivityLogPage() {
  const { user } = useAuth();
  const [actionFilter, setActionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const { data: actions } = useActivityActions();
  const { data: logs, isLoading, isError, error, refetch } = useActivityLogs({
    action: actionFilter || undefined,
    limit: 500,
  });

  const categories = Array.from(
    new Set(Object.values(ACTIVITY_ACTION_CATALOG).map((c) => c.category))
  ).sort();

  return (
    <div className="space-y-5 sm:space-y-6 min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-app-heading flex items-center gap-2 flex-wrap">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--app-brand-muted)] text-[var(--app-brand)]">
              <Activity className="h-5 w-5" aria-hidden />
            </span>
            Activity log
          </h1>
          <p className="text-xs sm:text-sm app-muted mt-1">
            {user?.isAdmin
              ? "Everything that has happened across all organisations — sign-ins, changes, invites, and uploads."
              : "Your account and organisation activity in plain language."}
          </p>
          {user?.isAdmin && (
            <p className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded mt-2 font-medium app-severity-notice">
              <Shield className="h-3 w-3" />
              Full access — you can see activity for every organisation
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 w-full lg:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="app-input w-full sm:min-w-[160px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="app-input w-full sm:min-w-[200px]"
          >
            <option value="">All actions</option>
            {actions?.map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_ACTION_CATALOG[a as keyof typeof ACTIVITY_ACTION_CATALOG]?.label ?? a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="app-card overflow-hidden min-w-0">
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          data={logs}
          loadingVariant="inline"
          loadingMessage="Loading activity logs…"
          errorTitle="Failed to load activity logs"
          onRetry={() => refetch()}
        >
          {(allLogs) => {
            const filtered = allLogs.filter((log) => {
              if (!categoryFilter) return true;
              const cat = log.category ?? ACTIVITY_ACTION_CATALOG[log.action]?.category;
              return cat === categoryFilter;
            });

            if (filtered.length === 0) {
              return (
                <EmptyState
                  icon={<Activity className="h-6 w-6" />}
                  title={allLogs.length === 0 ? "No activity recorded yet" : "No matching activity"}
                  description={
                    allLogs.length === 0
                      ? "Actions like sign-ins, invites, and updates will appear here."
                      : "Try clearing the category or action filters."
                  }
                />
              );
            }

            return (
              <>
                <div className="md:hidden">
                  {filtered.map((log) => (
                    <div key={log.id}>
                      <ActivityLogMobileCard log={log} />
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[720px]">
                    <thead className="app-table-head text-[10px] uppercase font-bold">
                      <tr>
                        <th className="px-4 py-3">When</th>
                        <th className="px-4 py-3">What happened</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Who</th>
                        <th className="px-4 py-3">Organisation</th>
                        <th className="px-4 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--app-border)" }}>
                      {filtered.map((log) => {
                        const { catalog, label, severity } = logMeta(log);
                        return (
                          <tr key={log.id} className="app-row-hover align-top">
                            <td className="px-4 py-3 app-muted whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-app-heading">{label}</div>
                              <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-medium ${SEVERITY_CLASS[severity]}`}>
                                {ACTIVITY_SEVERITY_LABELS[severity]}
                              </span>
                            </td>
                            <td className="px-4 py-3 app-muted">{log.category ?? catalog?.category ?? "—"}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium" style={{ color: "var(--app-fg)" }}>{log.actorName ?? "—"}</div>
                              {log.actorEmail && <div className="app-muted text-[10px]">{log.actorEmail}</div>}
                            </td>
                            <td className="px-4 py-3 app-muted">{log.organizationName ?? "—"}</td>
                            <td className="px-4 py-3 max-w-xs break-words" style={{ color: "var(--app-fg)" }}>{log.description}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          }}
        </QueryState>
      </div>
    </div>
  );
}
