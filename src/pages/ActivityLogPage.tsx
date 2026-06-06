import { useState } from "react";
import { useActivityLogs, useActivityActions } from "../hooks/useActivityLogs";
import { useAuth } from "../contexts/AuthContext";
import { ACTIVITY_ACTION_CATALOG, type ActivitySeverity } from "../types";
import { Loader2, Activity, Shield } from "lucide-react";

const SEVERITY_STYLES: Record<ActivitySeverity, string> = {
  info: "bg-slate-100 text-slate-700",
  notice: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-800",
  critical: "bg-rose-50 text-rose-700",
};

export default function ActivityLogPage() {
  const { user } = useAuth();
  const [actionFilter, setActionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const { data: actions } = useActivityActions();
  const { data: logs, isLoading, isError } = useActivityLogs({
    action: actionFilter || undefined,
    limit: 500,
  });

  const categories = Array.from(
    new Set(Object.values(ACTIVITY_ACTION_CATALOG).map((c) => c.category))
  ).sort();

  const filtered = logs?.filter((log) => {
    if (!categoryFilter) return true;
    const cat = log.category ?? ACTIVITY_ACTION_CATALOG[log.action]?.category;
    return cat === categoryFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600" />
            Activity Log
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {user?.isAdmin
              ? "Platform view — every sign-in, change, invite, and upload across all organizations."
              : "Your account and organization activity in plain language."}
          </p>
          {user?.isAdmin && (
            <p className="text-xs text-indigo-700 bg-indigo-50 inline-flex items-center gap-1 px-2 py-1 rounded mt-2 font-medium">
              <Shield className="h-3 w-3" />
              Platform administrator — viewing all audit events
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white min-w-[160px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white min-w-[200px]"
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

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading && (
          <div className="py-16 flex justify-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {isError && <p className="p-6 text-sm text-rose-600">Failed to load activity logs.</p>}
        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">What happened</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">No activity recorded yet.</td>
                  </tr>
                )}
                {filtered?.map((log) => {
                  const catalog = ACTIVITY_ACTION_CATALOG[log.action];
                  const label = log.actionLabel ?? catalog?.label ?? log.action;
                  const severity = (log.severity ?? catalog?.severity ?? "info") as ActivitySeverity;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 align-top">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{label}</div>
                        <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-medium ${SEVERITY_STYLES[severity]}`}>
                          {severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.category ?? catalog?.category ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{log.actorName ?? "—"}</div>
                        {log.actorEmail && <div className="text-slate-400 text-[10px]">{log.actorEmail}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.organizationName ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs">{log.description}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
