"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import { canRead, canWrite } from "@/lib/permissions";
import {
  Activity, Users, Banknote, Clock3, Loader2, ScanFace,
  CheckCircle2, Coffee, RefreshCw, History, Shield,
  ArrowRight, MonitorPlay, Wallet, MapPin
} from "lucide-react";

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [masterData, setMasterData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);

  // ─── GATEKEEPER & SESSION ───
  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) { router.push("/"); return; }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.role !== "manager") {
        router.push("/");
        return;
      }
      setSession(parsed);
    } catch {
      router.push("/");
    }
  }, [router]);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!session?.branch_id) return;
    if (!isSilent) setLoading(true);
    else setSyncing(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const [masterRes, liveRes, logsRes] = await Promise.all([
        callApi("get_branch_master", { branch_id: session.branch_id }),
        callApi("get_live_attendance", { branch_id: session.branch_id, date: today }),
        callApi("get_system_logs", { branch_id: session.branch_id, per_page: 50 })
      ]);

      if (masterRes.status === "success") setMasterData(masterRes.data);
      if (liveRes.status === "success") setLiveData(liveRes.data);
      if (logsRes.status === "success") setSystemLogs(logsRes.data || []);

    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchDashboardData();
      const interval = setInterval(() => fetchDashboardData(true), 45000);
      return () => clearInterval(interval);
    }
  }, [session, fetchDashboardData]);

  if (!session || (loading && !masterData)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Establishing Secure Uplink...</p>
      </div>
    );
  }

  // ─── DATA PROCESSING ───
  const permissions =
    session.feature_permissions ||
    session.featurepermissions ||
    session.permissions ||
    {};

  const totalStaff = masterData?.staff?.length || 0;
  const allPeople = liveData?.all_people || [];

  const onFloorCount = allPeople.filter(p => p.status === 'working').length;
  const onBreakCount = allPeople.filter(p => p.status === 'on_break').length;
  const absentCount = totalStaff - onFloorCount - onBreakCount;

  // Filter logs to ONLY show financial actions
  const financialLogs = systemLogs.filter(log =>
    log.action_type.includes("ADVANCE") ||
    log.action_type.includes("SALARY") ||
    log.action_type.includes("BILL") ||
    log.action_type.includes("FINE") ||
    log.action_type.includes("DEDUCTION")
  ).slice(0, 15);

  const QUICK_LINKS = [
    { title: "Live Floor Monitoring",  path: "/manager/live-floor", icon: Activity,    color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-900/50", perm: "view_live_attendance" },
    { title: "Biometric Terminal Ops", path: "/manager/terminal",   icon: MonitorPlay, color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-500/10",       border: "border-blue-200 dark:border-blue-900/50",    perm: "manage_terminal" },
    { title: "Staff Roster & Faces",   path: "/manager/staff",      icon: Users,       color: "text-purple-500",  bg: "bg-purple-50 dark:bg-purple-500/10",   border: "border-purple-200 dark:border-purple-900/50",perm: "view_staff_list" },
    { title: "Finance Ledger",         path: "/manager/finance",    icon: Wallet,      color: "text-orange-500",  bg: "bg-orange-50 dark:bg-orange-500/10",   border: "border-orange-200 dark:border-orange-900/50",perm: "view_finance_ledger" },
    { title: "Process Payroll",        path: "/manager/payroll",    icon: Banknote,    color: "text-rose-500",    bg: "bg-rose-50 dark:bg-rose-500/10",       border: "border-rose-200 dark:border-rose-900/50",    perm: "view_payroll" },
  ];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 w-full overflow-x-hidden">

      {/* ── COMMAND CENTER HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mx-3 md:mx-0 mt-3 md:mt-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 mb-1">
            <Shield size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Branch Command Center</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            {session.branch_name || "Assigned Branch"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 font-medium flex items-center gap-1.5">
            <MapPin size={14} /> Local operational overview and real-time metrics.
          </p>
        </div>

        <div className="flex items-center gap-3 mt-2 md:mt-0 relative z-10">
          <button onClick={() => fetchDashboardData(false)} className="p-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 hover:border-blue-500/50 rounded-xl text-gray-600 dark:text-neutral-400 hover:text-blue-500 transition-all shadow-sm group">
            <RefreshCw size={18} className={`${syncing ? "animate-spin text-blue-500" : ""} group-hover:rotate-180 transition-transform duration-500`} />
          </button>

          {canWrite(permissions, "manage_terminal") && (
            <button
              onClick={() => router.push("/manager/terminal")}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-wider"
            >
              <ScanFace size={18} strokeWidth={2.5} /> Launch Terminal
            </button>
          )}
        </div>
      </div>

      {/* ── LIVE BRANCH METRICS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 px-3 md:px-0">
        {[
          { label: "Total Branch Staff", value: totalStaff,    icon: Users,         color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10",    border: "border-blue-100 dark:border-blue-900/30"    },
          { label: "On Floor Now",       value: onFloorCount,  icon: CheckCircle2,  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-100 dark:border-emerald-900/30" },
          { label: "On Break",           value: onBreakCount,  icon: Coffee,        color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/10",border: "border-yellow-100 dark:border-yellow-900/30" },
          { label: "Off Duty / Absent",  value: absentCount,   icon: Clock3,        color: "text-red-600 dark:text-red-400",      bg: "bg-red-50 dark:bg-red-500/10",      border: "border-red-100 dark:border-red-900/30"      },
        ].map((card) => (
          <div key={card.label} className={`rounded-3xl p-5 md:p-6 shadow-sm border ${card.border} ${card.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-[10px] uppercase tracking-widest font-black ${card.color} opacity-80`}>{card.label}</p>
              <card.icon size={16} className={`${card.color} opacity-60`} />
            </div>
            <p className={`text-3xl md:text-4xl font-black tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 px-3 md:px-0">

        {/* ── QUICK COMMAND HUB ── */}
        <div className={`space-y-4 ${canRead(permissions, "view_system_logs") ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
            <Activity size={16} className="text-blue-500" /> Authorized Modules
          </h3>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-4 shadow-sm flex flex-col gap-3">
            {QUICK_LINKS.map((link) => {
              if (!canRead(permissions, link.perm)) return null;

              return (
                <button
                  key={link.title}
                  onClick={() => router.push(link.path)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 hover:shadow-md group ${link.bg} ${link.border}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm flex items-center justify-center ${link.color}`}>
                      <link.icon size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-black text-sm text-gray-900 dark:text-white">{link.title}</span>
                  </div>
                  <ArrowRight size={18} className={`${link.color} opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
                </button>
              );
            })}

            {QUICK_LINKS.filter(link => canRead(permissions, link.perm)).length === 0 && (
              <div className="p-8 text-center text-gray-400 font-bold text-sm">
                No active modules assigned to your profile.
              </div>
            )}
          </div>
        </div>

        {/* ── RECENT FINANCIAL ACTIVITY FEED (Gated) ── */}
        {canRead(permissions, "view_system_logs") && (
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
              <History size={16} className="text-orange-500" /> Recent Financial Activity
            </h3>

            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden h-[500px]">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {financialLogs.length === 0 ? (
                  <div className="text-center text-gray-400 font-bold mt-32 text-sm flex flex-col items-center">
                    <Banknote size={32} className="mb-3 opacity-20" />
                    No financial activity recorded recently.
                  </div>
                ) : (
                  <div className="relative pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6">
                    {financialLogs.map((log) => (
                      <div key={log.id} className="relative group">
                        <div className="absolute -left-[19px] md:-left-[23px] top-1 w-3 h-3 rounded-full ring-4 bg-orange-500 ring-white dark:ring-[#0a0a0a]" />
                        <div className="pl-2">
                          <p className="text-sm font-bold text-gray-800 dark:text-neutral-200 leading-snug">{log.description}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md">
                              {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {log.actor_name && (
                              <span className="text-[10px] font-bold text-blue-500 truncate max-w-[200px]">
                                Action by: {log.actor_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}