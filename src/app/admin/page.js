"use client";
import { useState, useEffect, useCallback } from "react";
import { callApi } from "@/lib/apiClient";
import StatCard from "@/components/ui/StatCard";
import { SkeletonStatRow, SkeletonCard } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import {
  Building2, Users, Banknote, Activity,
  Clock, ArrowRight, RefreshCw, UserCheck
} from "lucide-react";
import Link from "next/link";

const LOG_ICON_MAP = {
  login:           { color: "text-emerald-500",  dot: "bg-emerald-500"  },
  create_user:     { color: "text-blue-500",     dot: "bg-blue-500"     },
  delete_user:     { color: "text-red-500",      dot: "bg-red-500"      },
  attendance_punch:{ color: "text-purple-500",   dot: "bg-purple-500"   },
  payroll_lock:    { color: "text-yellow-500",   dot: "bg-yellow-500"   },
  advance_log:     { color: "text-orange-500",   dot: "bg-orange-500"   },
  default:         { color: "text-gray-400",     dot: "bg-gray-400"     },
};

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [logPage, setLogPage] = useState(1);
  const [logs,    setLogs]    = useState([]);
  const [logsEnd, setLogsEnd] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [now,     setNow]     = useState(new Date());

  // Tick clock every minute
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const res = await callApi("get_admin_dashboard");
    if (res.status === "success") {
      setStats(res.data);
      setLogs(res.data.recent_logs || []);
      setLogsEnd((res.data.recent_logs || []).length < 15);
    }
    setLoading(false);
  }, []);

  const loadMoreLogs = async () => {
    if (logsLoading || logsEnd) return;
    setLogsLoading(true);
    const nextPage = logPage + 1;
    const res = await callApi("get_system_logs", { page: nextPage, per_page: 15 });
    if (res.status === "success") {
      const newLogs = res.data || [];
      setLogs(prev => [...prev, ...newLogs]);
      setLogsEnd(newLogs.length < 15);
      setLogPage(nextPage);
    }
    setLogsLoading(false);
  };

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const formatLogTime = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const thisMonth = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-8 font-sans pb-12">

      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white">System Overview</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            &ensp;&middot;&ensp;
            {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-black text-gray-500 hover:text-emerald-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Stat cards */}
      {loading ? (
        <SkeletonStatRow count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2}  label="Active Branches"     value={stats?.total_branches}                         color="emerald" />
          <StatCard icon={Users}      label="Total Personnel"     value={stats?.total_employees}                        color="blue"   />
          <StatCard icon={UserCheck}  label="Present Today"       value={stats?.present_today}                          color="purple" />
          <StatCard icon={Banknote}   label={`Salary — ${thisMonth}`} value={stats?.salary_expenditure ? `₹${Number(stats.salary_expenditure).toLocaleString("en-IN")}` : "₹0"} color="gold" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Branch grid */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest">Branch Environments</h2>
            <Link href="/admin/branches" className="text-xs font-bold text-emerald-600 dark:text-emerald-500 flex items-center gap-1 hover:gap-2 transition-all">
              Manage <ArrowRight size={13} />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1,2].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : stats?.branch_grid?.length === 0 ? (
            <EmptyState icon={Building2} title="No branches yet" message="Create your first branch in Settings." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats?.branch_grid?.map(branch => (
                <Link
                  key={branch.id}
                  href={`/admin/branch?id=${branch.id}`}
                  className="block bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-black text-gray-900 dark:text-white text-base leading-tight">{branch.branch_name}</h3>
                      {branch.address && <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{branch.address}</p>}
                    </div>
                    <Badge label={branch.status || "active"} variant="emerald" dot />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-neutral-900">
                    <div className="text-center">
                      <p className="text-lg font-black text-gray-900 dark:text-white tabular">{branch.staff_count}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Staff</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular">{branch.present_today ?? "—"}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Present</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-gray-900 dark:text-white tabular">{branch.managers_count ?? 0}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Managers</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Environment <ArrowRight size={13} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* System history feed */}
        <div className="xl:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-2">
              <Clock size={13} /> System History
            </h2>
            <span className="text-[10px] text-gray-400">All branches</span>
          </div>

          <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-neutral-900 max-h-[540px] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[...Array(6)].map((_,i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-neutral-800 animate-pulse mt-1 shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3.5 bg-gray-100 dark:bg-neutral-800 rounded animate-pulse w-full" />
                        <div className="h-3 bg-gray-100 dark:bg-neutral-800 rounded animate-pulse w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Activity} title="No activity yet" />
                </div>
              ) : (
                <>
                  {logs.map((log, idx) => {
                    const style = LOG_ICON_MAP[log.action_type] || LOG_ICON_MAP.default;
                    return (
                      <div key={idx} className="flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors">
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-neutral-200 leading-snug">{log.description}</p>
                          <div className="flex flex-wrap gap-x-2 mt-0.5">
                            <span className="text-[11px] text-gray-400 dark:text-neutral-500 tabular">{formatLogTime(log.created_at)}</span>
                            {log.user_name  && <span className="text-[11px] text-gray-400">· {log.user_name}</span>}
                            {log.branch_name && <span className="text-[11px] text-gray-400">· {log.branch_name}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!logsEnd && (
                    <div className="p-3 text-center">
                      <button
                        onClick={loadMoreLogs}
                        disabled={logsLoading}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-500 hover:underline disabled:opacity-50"
                      >
                        {logsLoading ? "Loading..." : "Load more"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
