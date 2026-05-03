"use client";
import { useState, useEffect, useCallback } from "react";
import { callApi } from "@/lib/apiClient";
import StatCard from "@/components/ui/StatCard";
import { SkeletonStatRow, SkeletonCard } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import {
  Building2, Users, Banknote, Activity,
  Clock, ArrowRight, RefreshCw, UserCheck, MapPin
} from "lucide-react";
import Link from "next/link";

// Enhanced LOG_ICON_MAP to match both your old keys and the actual DB action_types
const LOG_ICON_MAP = {
  login:            { color: "text-emerald-500", dot: "bg-emerald-500", bg: "bg-emerald-500/10" },
  AUTH_LOGIN:       { color: "text-emerald-500", dot: "bg-emerald-500", bg: "bg-emerald-500/10" },
  create_user:      { color: "text-blue-500",    dot: "bg-blue-500",    bg: "bg-blue-500/10" },
  USER_CREATED:     { color: "text-blue-500",    dot: "bg-blue-500",    bg: "bg-blue-500/10" },
  delete_user:      { color: "text-red-500",     dot: "bg-red-500",     bg: "bg-red-500/10" },
  USER_DELETED:     { color: "text-red-500",     dot: "bg-red-500",     bg: "bg-red-500/10" },
  attendance_punch: { color: "text-purple-500",  dot: "bg-purple-500",  bg: "bg-purple-500/10" },
  PUNCH_LOGGED:     { color: "text-purple-500",  dot: "bg-purple-500",  bg: "bg-purple-500/10" },
  ATTENDANCE_IN:    { color: "text-purple-500",  dot: "bg-purple-500",  bg: "bg-purple-500/10" },
  ATTENDANCE_OUT:   { color: "text-purple-500",  dot: "bg-purple-500",  bg: "bg-purple-500/10" },
  payroll_lock:     { color: "text-yellow-500",  dot: "bg-yellow-500",  bg: "bg-yellow-500/10" },
  SALARY_PAID:      { color: "text-yellow-500",  dot: "bg-yellow-500",  bg: "bg-yellow-500/10" },
  advance_log:      { color: "text-orange-500",  dot: "bg-orange-500",  bg: "bg-orange-500/10" },
  ADVANCE_LOGGED:   { color: "text-orange-500",  dot: "bg-orange-500",  bg: "bg-orange-500/10" },
  FACE_REGISTERED:  { color: "text-indigo-500",  dot: "bg-indigo-500",  bg: "bg-indigo-500/10" },
  default:          { color: "text-gray-400",    dot: "bg-gray-400",    bg: "bg-gray-400/10" },
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
      // Failsafe to catch either key from your backend
      const historyData = res.data.system_history || res.data.recent_logs || [];
      setLogs(historyData);
      setLogsEnd(historyData.length < 15);
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

      {/* ── Page Heading ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-white/40 dark:bg-neutral-900/20 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">System Overview</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 font-medium flex items-center gap-2">
            <Clock size={15} className="text-emerald-500" />
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            <span className="opacity-50">•</span>
            {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#0A0A0A] text-gray-600 dark:text-neutral-300 font-semibold text-sm hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-900/50 hover:shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin text-emerald-500" : ""} />
          {loading ? "Syncing..." : "Refresh"}
        </button>
      </div>

      {/* ── Stat Cards ───────────────────────────────────── */}
      {loading ? (
        <SkeletonStatRow count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <StatCard icon={Building2}  label="Active Branches"     value={stats?.total_branches}                        color="emerald" />
          <StatCard icon={Users}      label="Total Personnel"     value={stats?.total_employees}                       color="blue"   />
          <StatCard icon={UserCheck}  label="Present Today"       value={stats?.present_today || 0}                    color="purple" />
          <StatCard icon={Banknote}   label={`Salary — ${thisMonth}`} value={stats?.salary_expenditure ? `₹${Number(stats.salary_expenditure).toLocaleString("en-IN")}` : "₹0"} color="gold" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">

        {/* ── Branch Grid ─────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <MapPin size={16} className="text-emerald-500" /> Branch Environments
            </h2>
            <Link href="/admin/branches" className="text-xs font-bold text-emerald-600 dark:text-emerald-500 flex items-center gap-1 hover:gap-2 transition-all">
              Manage <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
              {[1,2].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : stats?.branch_grid?.length === 0 ? (
            <EmptyState icon={Building2} title="No branches yet" message="Create your first branch in Settings." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
              {stats?.branch_grid?.map(branch => (
                <Link
                  key={branch.id}
                  href={`/admin/branch?id=${branch.id}`}
                  className="relative group block bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 hover:shadow-[0_8px_30px_rgb(16,185,129,0.06)] transition-all overflow-hidden"
                >
                  {/* Subtle Gradient Flare */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-emerald-500/10 dark:group-hover:bg-emerald-500/20 transition-colors duration-500"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-black text-gray-900 dark:text-white text-lg leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{branch.branch_name}</h3>
                        {branch.address && <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 line-clamp-1">{branch.address}</p>}
                      </div>
                      <Badge label={branch.status || "active"} variant="emerald" dot />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-gray-100 dark:border-neutral-900">
                      <div>
                        <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">{branch.staff_count}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Total Staff</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{branch.present_today ?? "0"}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Present Today</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── System History Feed ─────────────────────────── */}
        <div className="xl:col-span-1 space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Activity size={16} className="text-emerald-500" /> System Feed
            </h2>
          </div>

          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              
              {loading ? (
                <div className="space-y-6">
                  {[...Array(5)].map((_,i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-neutral-800 animate-pulse mt-1 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded animate-pulse w-full" />
                        <div className="h-3 bg-gray-100 dark:bg-neutral-800 rounded animate-pulse w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <EmptyState icon={Activity} title="No activity yet" />
              ) : (
                <div className="relative pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6 md:space-y-8">
                  {logs.map((log, idx) => {
                    const style = LOG_ICON_MAP[log.action_type] || LOG_ICON_MAP.default;
                    return (
                      <div key={idx} className="relative group">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[21px] md:-left-[25px] top-1 w-3 h-3 rounded-full ring-4 ring-white dark:ring-[#0A0A0A] ${style.dot}`} />
                        
                        <div className="pl-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 leading-snug">
                            {log.description}
                          </p>
                          <div className="flex items-center flex-wrap gap-2 mt-1.5">
                            <span className="text-[11px] font-bold text-gray-400 dark:text-neutral-500 tabular-nums uppercase">
                              {formatLogTime(log.created_at)}
                            </span>
                            {log.actor_name && (
                              <>
                                <span className="text-gray-300 dark:text-neutral-700">•</span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${style.bg} ${style.color}`}>
                                  {log.actor_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {!logsEnd && (
                    <div className="pt-4 pb-2 relative">
                      <div className="absolute -left-[21px] md:-left-[25px] top-6 w-3 h-3 rounded-full border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-[#0A0A0A]" />
                      <button
                        onClick={loadMoreLogs}
                        disabled={logsLoading}
                        className="ml-2 px-4 py-2 rounded-xl text-xs font-bold bg-gray-50 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50"
                      >
                        {logsLoading ? "Loading..." : "Load older activity"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}