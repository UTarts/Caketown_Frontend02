"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Activity, Banknote, Clock3, FileText, Loader2, Plus, 
  ScanFace, Users, Wallet, CheckCircle2, Coffee, RefreshCw,
  UserX, History, AlertCircle, X, Save, DollarSign, Edit2, ChevronDown,
  ChevronLeft, ChevronRight, CalendarDays
} from "lucide-react";

// ─── HELPERS ───────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hasPermission(permissions, key, mode = "read") {
  if (!key) return true;
  const p = permissions?.[key];
  return !!p?.[mode];
}

// Format date for history groups (Today, Yesterday, or exact date)
function formatLogGroupDate(isoString) {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// Helper to group logs by date
function groupLogsByDate(logs) {
  const grouped = {};
  logs.forEach(log => {
    const groupKey = formatLogGroupDate(log.created_at);
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(log);
  });
  return grouped;
}

// ─── SMART TIMELINE COMPONENT ─────────────────────────────────────────────
function PunchTimeline({ punches, isActive }) {
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 60000); 
    return () => clearInterval(interval);
  }, [isActive]);

  if (!punches || punches.length === 0) {
    return <div className="text-gray-400 font-bold text-sm flex items-center h-full">No punches recorded</div>;
  }

  const renderPunches = [...punches].map(p => new Date(p).getTime());
  if (isActive) renderPunches.push(now);

  const startTime = renderPunches[0];
  const endTime = renderPunches[renderPunches.length - 1];
  const totalDurationMs = Math.max(endTime - startTime, 60000);

  const segments = [];
  for (let i = 0; i < renderPunches.length - 1; i++) {
    segments.push({
      start: renderPunches[i],
      end: renderPunches[i+1],
      duration: renderPunches[i+1] - renderPunches[i],
      isWork: i % 2 === 0,
      isLive: isActive && i === renderPunches.length - 2
    });
  }

  const formatHm = (ms) => {
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="w-full flex flex-col gap-3 my-3 md:my-0">
      <div>
        <div className="flex w-full h-2.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          {segments.map((seg, idx) => (
            <div 
              key={idx} 
              style={{ width: `${(seg.duration / totalDurationMs) * 100}%` }} 
              className={`h-full ${seg.isWork ? 'bg-emerald-500' : 'bg-red-400'}`} 
            />
          ))}
        </div>
        <div className="flex justify-between items-center mt-1.5 px-0.5">
          <span className="text-[10px] font-bold text-gray-500">{formatTime(startTime)}</span>
          <span className="text-[10px] font-bold text-gray-500">{isActive ? "Now" : formatTime(endTime)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {segments.map((seg, idx) => (
          <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border ${
            seg.isWork 
              ? 'bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' 
              : 'bg-red-50/50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${seg.isWork ? 'bg-emerald-500' : 'bg-red-500'} ${seg.isLive ? 'animate-pulse' : ''}`} />
            <span>{formatTime(seg.start)} - {seg.isLive ? 'Now' : formatTime(seg.end)}</span>
            <span className="opacity-60 ml-0.5">({formatHm(seg.duration)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveTotalTime({ initialMinutes, lastPunch, isActive }) {
  const [mins, setMins] = useState(initialMinutes || 0);

  useEffect(() => {
    if (!isActive || !lastPunch) {
      setMins(initialMinutes || 0);
      return;
    }
    const start = new Date(lastPunch).getTime();
    const update = () => {
      const elapsedMins = Math.floor((Date.now() - start) / 60000);
      setMins((initialMinutes || 0) + elapsedMins);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [initialMinutes, lastPunch, isActive]);

  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  
  return (
    <span className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight">
      {h}h, {m}m
    </span>
  );
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────
export default function ManagerDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const [session, setSession] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [branchLogs, setBranchLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState(initialTab);
  
  // Date State for Live Floor Switcher
  const [viewDate, setViewDate] = useState(getLocalDate());

  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [advanceForm, setAdvanceForm] = useState({ type: "pre_advance", amount: "", remarks: "" });
  const [submittingAdvance, setSubmittingAdvance] = useState(false);

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Initial Auth Check
  useEffect(() => {
    try {
      const raw = localStorage.getItem("caketown_session");
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || parsed.role !== "manager") {
        router.push("/");
        return;
      }
      setSession(parsed);
    } catch {
      router.push("/");
    }
  }, [router]);

  const permissions = useMemo(() => session?.feature_permissions || {}, [session]);

  // Tri-Fetch Engine (Now uses viewDate)
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!session?.branch_id) return;
    if (!isSilent) setLoading(true);
    else setSyncing(true);

    try {
      const [masterRes, liveRes, logsRes] = await Promise.all([
        callApi("get_branch_master", { branch_id: session.branch_id }),
        callApi("get_live_attendance", { branch_id: session.branch_id, date: viewDate }),
        callApi("get_system_logs", { branch_id: session.branch_id, per_page: 100 }) // Fetched 100 to populate history groups properly
      ]);

      if (masterRes.status === "success") setMasterData(masterRes.data);
      if (liveRes.status === "success") setLiveData(liveRes.data);
      if (logsRes.status === "success") setBranchLogs(logsRes.data || []);
      
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [session, viewDate]);

  useEffect(() => {
    if (session) {
      fetchDashboardData();
      // Only auto-sync every 30s if viewing Today's live floor
      if (viewDate === getLocalDate()) {
        const interval = setInterval(() => fetchDashboardData(true), 30000);
        return () => clearInterval(interval);
      }
    }
  }, [session, viewDate, fetchDashboardData]);

  // Date Nav Handlers
  const isToday = viewDate === getLocalDate();
  const handlePrevDay = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() - 1);
    setViewDate(d.toISOString().split('T')[0]);
  };
  const handleNextDay = () => {
    if (isToday) return;
    const d = new Date(viewDate);
    d.setDate(d.getDate() + 1);
    setViewDate(d.toISOString().split('T')[0]);
  };

  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    if (!advanceTarget) return;
    setSubmittingAdvance(true);

    const res = await callApi("log_advance", {
      user_id: advanceTarget.id,
      branch_id: session.branch_id,
      type: advanceForm.type,
      amount: advanceForm.amount,
      remarks: advanceForm.remarks,
      logged_by: session.id,
    });

    if (res.status === "success") {
      setAdvanceTarget(null);
      setAdvanceForm({ type: "pre_advance", amount: "", remarks: "" });
      fetchDashboardData(true); 
    } else {
      alert(res.message || "Unable to log transaction.");
    }
    setSubmittingAdvance(false);
  };

  const openEdit = (user) => {
    setEditTarget(user);
    setEditForm({
      name: user.name, 
      mobile_number: user.mobile_number,
      role: user.role, 
      salary: user.monthly_fixed_salary,
      paid_leaves: user.paid_leaves, 
      max_paid_leaves: user.max_paid_leaves_cap || 4,
      shift_hours: user.standard_shift_hours,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    const res = await callApi("update_user", { 
      user_id: editTarget.id, 
      ...editForm, 
      manager_id: session.id 
    });
    if (res.status === "success") { 
      setEditTarget(null); 
      fetchDashboardData(true); 
    } else {
      alert(res.message);
    }
    setEditSubmitting(false);
  };

  if (!session || loading && !masterData) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Establishing Connection...</p>
      </div>
    );
  }

  const staffList = masterData?.staff || [];
  const allPeople = liveData?.all_people || [];
  
  const onFloorCount = allPeople.filter(p => p.status === 'working').length;
  const onBreakCount = allPeople.filter(p => p.status === 'on_break').length;

  // Generate Recent Punches from currently selected date
  const recentPunches = [];
  allPeople.forEach((person) => {
    if (Array.isArray(person.punches)) {
      person.punches.forEach((time, index) => {
        recentPunches.push({
          id: `${person.id}-${time}-${index}`,
          name: person.name,
          role: person.role || person.department || "Staff",
          type: index % 2 === 0 ? "IN" : "OUT",
          rawTime: time,
          time: new Date(time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        });
      });
    }
  });
  recentPunches.sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime));
  const topPunches = recentPunches.slice(0, 15);

  // Grouped History Logs
  const groupedBranchLogs = groupLogsByDate(branchLogs);
  const financeLogs = branchLogs.filter(log => log.action_type.includes("ADVANCE") || log.action_type.includes("SALARY") || log.action_type.includes("BILL"));
  const groupedFinanceLogs = groupLogsByDate(financeLogs);

  // Advance Calculation Logic
  const salary = parseFloat(advanceTarget?.monthly_fixed_salary || 0);
  const maxAdvAllowed = salary * 0.30;
  const totalTaken = parseFloat(advanceTarget?.pre_advance_balance || 0) + parseFloat(advanceTarget?.final_advance_balance || 0);
  const remainingAdv = Math.max(0, maxAdvAllowed - totalTaken);
  
  const isAdvanceType = ["pre_advance", "final_advance", "shop_advance"].includes(advanceForm.type);
  const amountNum = parseFloat(advanceForm.amount || 0);
  const exceedsLimit = isAdvanceType && (amountNum > remainingAdv);

  const tabs = [
    { id: "overview", label: "Live Floor", show: true },
    { id: "finance", label: "Finance", show: hasPermission(permissions, "view_payroll") || hasPermission(permissions, "log_advance", "write") },
    { id: "staff", label: "Staff", show: hasPermission(permissions, "view_staff_list") },
  ].filter((t) => t.show);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 w-full overflow-x-hidden">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mx-3 md:mx-0 mt-3 md:mt-0">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500 mb-1">
            Manager Command Center
          </p>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            {session.branch_name || "Branch Overview"}
          </h1>
        </div>

        <div className="flex items-center gap-3 mt-2 md:mt-0">
          <button onClick={() => fetchDashboardData(false)} className="p-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 hover:border-emerald-500/50 rounded-xl text-gray-600 dark:text-neutral-400 hover:text-emerald-500 transition-all shadow-sm">
            <RefreshCw size={18} className={syncing ? "animate-spin text-emerald-500" : ""} />
          </button>
          
          {hasPermission(permissions, "manage_terminal", "write") && (
            <button
              onClick={() => router.push("/manager/terminal")}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <ScanFace size={18} strokeWidth={2.5} /> Terminal
            </button>
          )}
        </div>
      </div>

      {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 px-3 md:px-0">
        {[
          { label: "Branch Staff", value: staffList.length, icon: Users, color: "text-gray-900 dark:text-white" },
          { label: "On Floor Now", value: onFloorCount, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "On Break", value: onBreakCount, icon: Coffee, color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Off Duty", value: staffList.length - onFloorCount - onBreakCount, icon: Clock3, color: "text-gray-500 dark:text-neutral-500" },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">{card.label}</p>
              <card.icon size={16} className="text-gray-400 opacity-50" />
            </div>
            <p className={`text-3xl md:text-4xl font-black tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── TABS ───────────────────────────────────────────────────────── */}
      <div className="sticky top-14 md:top-0 z-30 bg-[#F8FAFC]/90 dark:bg-[#050505]/90 backdrop-blur-xl pt-2 pb-4 px-3 md:px-0">
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 snap-x">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                router.push(`/manager/dashboard?tab=${item.id}`);
              }}
              className={`snap-start shrink-0 px-6 py-3 rounded-2xl text-sm font-black whitespace-nowrap transition-all duration-300 ${
                tab === item.id
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-400/50"
                  : "bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: LIVE FLOOR
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 px-3 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="xl:col-span-2 space-y-6">
            {!hasPermission(permissions, "view_live_attendance") ? (
              <div className="rounded-3xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-500/10 p-6 md:p-8 text-sm text-yellow-700 dark:text-yellow-400 font-bold text-center">
                You do not currently have permission to view live floor attendance.
              </div>
            ) : (
              <>
                {/* ── DATE SWITCHER ── */}
                <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-3 md:p-4 shadow-sm w-full gap-3">
                  <div className="flex items-center w-full sm:w-auto justify-between sm:justify-start gap-2">
                    <button onClick={handlePrevDay} className="p-3 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors shrink-0">
                      <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2.5 px-4 bg-gray-50 dark:bg-neutral-900 rounded-xl py-3 flex-1 sm:flex-none justify-center">
                      <CalendarDays size={18} className="text-emerald-500" />
                      <input 
                        type="date" 
                        value={viewDate}
                        max={getLocalDate()}
                        onChange={(e) => setViewDate(e.target.value)}
                        className="bg-transparent text-sm font-black text-gray-900 dark:text-white outline-none cursor-pointer w-32"
                      />
                    </div>
                    <button onClick={handleNextDay} disabled={isToday} className="p-3 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors shrink-0 disabled:opacity-30">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                    {isToday ? (
                      <><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span> Live Floor Activity</>
                    ) : (
                      <><Clock3 size={16} className="text-gray-400" /> Past Floor Record</>
                    )}
                  </h3>
                </div>

                {/* ── LIVE PUNCH TIMELINES ── */}
                {allPeople.length === 0 ? (
                  <div className="rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-12 text-center text-gray-400">
                    No staff members found on this date.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allPeople.map((person) => {
                      // Only trigger the active/pulsing state if we are viewing TODAY and they are currently working
                      const isWorkingRightNow = isToday && person.status === 'working';

                      return (
                        <div key={person.id} className="flex flex-col md:flex-row md:items-center bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-[2rem] md:rounded-[3rem] p-5 md:py-4 md:px-8 shadow-sm gap-2 md:gap-8 hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-colors group">
                          
                          <div className="w-full md:w-56 shrink-0 flex justify-between md:block items-center border-b border-gray-100 dark:border-neutral-900 md:border-none pb-3 md:pb-0 mb-2 md:mb-0">
                            <div>
                              <h3 className="font-black text-lg md:text-xl text-gray-900 dark:text-white truncate">{person.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{person.role}</p>
                                {isWorkingRightNow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                                {(isToday && person.status === 'on_break') && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>}
                              </div>
                            </div>
                            <div className="md:hidden text-right">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total</p>
                              <LiveTotalTime initialMinutes={person.total_working_minutes} lastPunch={person.last_punch} isActive={isWorkingRightNow} />
                            </div>
                          </div>

                          <div className="flex-1 w-full md:w-auto px-1 md:px-0 overflow-hidden">
                            <PunchTimeline punches={person.punches} isActive={isWorkingRightNow} />
                          </div>

                          <div className="hidden md:block w-36 shrink-0 text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Time</p>
                            <LiveTotalTime initialMinutes={person.total_working_minutes} lastPunch={person.last_punch} isActive={isWorkingRightNow} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── BRANCH HISTORY FEED (Grouped by Date) ───────────────────── */}
          <div className="xl:col-span-1 space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
              <History size={16} className="text-blue-500" /> Branch Feed
            </h3>
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden h-[700px]">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {Object.keys(groupedBranchLogs).length === 0 ? (
                  <div className="text-center text-gray-400 font-bold mt-20 text-sm">No activity recorded.</div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(groupedBranchLogs).map(([dateLabel, logs]) => (
                      <div key={dateLabel}>
                        {/* Group Header */}
                        <div className="flex items-center gap-4 mb-5 sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm z-10 py-1 -mt-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 dark:bg-neutral-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-800">{dateLabel}</span>
                          <div className="h-px bg-gray-100 dark:bg-neutral-800 flex-1"></div>
                        </div>
                        
                        {/* Logs in Group */}
                        <div className="relative pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6">
                          {logs.map((log) => {
                            let colorClass = "bg-gray-100 dark:bg-neutral-800 ring-white dark:ring-[#0a0a0a]";
                            if (log.action_type.includes("LOGIN")) colorClass = "bg-blue-500 ring-white dark:ring-[#0a0a0a]";
                            if (log.action_type.includes("ATTENDANCE") || log.action_type.includes("PUNCH")) colorClass = "bg-purple-500 ring-white dark:ring-[#0a0a0a]";
                            if (log.action_type.includes("ADVANCE") || log.action_type.includes("SALARY")) colorClass = "bg-orange-500 ring-white dark:ring-[#0a0a0a]";

                            return (
                              <div key={log.id} className="relative group">
                                <div className={`absolute -left-[19px] md:-left-[23px] top-1 w-3 h-3 rounded-full ring-4 ${colorClass}`} />
                                <div className="pl-2">
                                  <p className="text-xs font-medium text-gray-800 dark:text-neutral-200 leading-snug">{log.description}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 tabular-nums">
                                      {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {log.actor_name && <span className="text-[10px] font-bold text-blue-500 truncate max-w-[120px]">· {log.actor_name}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: FINANCE
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "finance" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 px-3 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          {!hasPermission(permissions, "view_payroll") && !hasPermission(permissions, "log_advance", "write") ? (
            <div className="xl:col-span-3 rounded-3xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-500/10 p-6 text-sm text-yellow-700 dark:text-yellow-400 font-bold text-center">
              You do not have administrative finance access.
            </div>
          ) : (
            <>
              <div className="xl:col-span-2 space-y-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
                  <Banknote size={16} className="text-emerald-500" /> Log Transaction
                </h3>
                
                {hasPermission(permissions, "log_advance", "write") ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {staffList.map((employee) => (
                      <button
                        key={employee.id}
                        onClick={() => setAdvanceTarget(employee)}
                        className="text-left rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] hover:border-emerald-500/50 dark:hover:border-emerald-500/50 p-6 shadow-sm transition-all group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-black text-lg text-gray-900 dark:text-white mb-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{employee.name}</p>
                            <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">
                              {employee.role}
                            </p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-neutral-900 flex items-center justify-center group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10 transition-colors">
                            <Plus size={16} className="text-gray-400 group-hover:text-emerald-500" strokeWidth={3} />
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-900 flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-500">Fixed Salary</span>
                          <span className="font-mono font-black text-gray-900 dark:text-white">₹{parseFloat(employee.monthly_fixed_salary || 0).toLocaleString("en-IN")}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-10 text-center text-gray-400 font-bold text-sm">
                    You only have permission to view data, not log new transactions.
                  </div>
                )}
              </div>

              {/* Smart Finance History (Grouped by Date) */}
              <div className="xl:col-span-1 space-y-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
                  <History size={16} className="text-orange-500" /> Smart Finance History
                </h3>
                <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden h-[700px] flex flex-col">
                  <div className="overflow-y-auto custom-scrollbar pr-2 pb-8">
                    {Object.keys(groupedFinanceLogs).length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center mt-20">
                        <Wallet size={32} className="text-gray-300 dark:text-neutral-700 mb-3" />
                        <p className="font-bold text-sm text-gray-400">No financial transactions logged.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(groupedFinanceLogs).map(([dateLabel, logs]) => (
                          <div key={dateLabel}>
                            {/* Group Header */}
                            <div className="flex items-center gap-4 mb-4 sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm z-10 py-1 -mt-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-900/30">{dateLabel}</span>
                              <div className="h-px bg-gray-100 dark:bg-neutral-800 flex-1"></div>
                            </div>
                            
                            <div className="space-y-3">
                              {logs.map((log) => (
                                <div key={log.id} className="bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 rounded-2xl p-4 hover:border-orange-200 dark:hover:border-orange-900/50 transition-colors">
                                  <p className="font-bold text-sm text-gray-900 dark:text-white leading-snug">{log.description}</p>
                                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-neutral-800">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                      {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-500">
                                      By <span className="text-blue-500">{log.actor_name || "System"}</span>
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: STAFF LIST
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "staff" && (
        <div className="space-y-4 px-3 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          {!hasPermission(permissions, "view_staff_list") ? (
            <div className="rounded-3xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-500/10 p-6 text-sm text-yellow-700 dark:text-yellow-400 font-bold text-center">
              You do not currently have permission to view the branch staff directory.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
              {staffList.map((employee) => (
                <div key={employee.id} className="rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-black text-base text-gray-900 dark:text-white mb-1">{employee.name}</p>
                      <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">
                        {employee.role}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase bg-gray-100 dark:bg-neutral-900 text-gray-500">
                      ID #{String(employee.id).padStart(4, "0")}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-900/50 p-3.5 rounded-2xl mb-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Mobile</span>
                      <span className="font-mono font-black text-gray-900 dark:text-white">{employee.mobile_number || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Fixed Salary</span>
                      <span className="font-mono font-black text-gray-900 dark:text-white">
                        ₹{parseFloat(employee.monthly_fixed_salary || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Target Shift</span>
                      <span className="font-mono font-black text-gray-900 dark:text-white">
                        {employee.standard_shift_hours || 0}h
                      </span>
                    </div>
                  </div>

                  {hasPermission(permissions, "edit_staff", "write") && (
                    <button 
                      onClick={() => openEdit(employee)}
                      className="w-full py-2.5 bg-gray-100 dark:bg-neutral-900 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit2 size={14} strokeWidth={2.5} /> Edit Details
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: EDIT EMPLOYEE
      ══════════════════════════════════════════════════════════════════ */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-3xl max-h-[90dvh] overflow-y-auto custom-scrollbar rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300">
            <div className="sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center z-20">
              <h2 className="text-lg font-black flex items-center gap-2"><Edit2 size={16} className="text-blue-500" /> Edit Details</h2>
              <button onClick={() => setEditTarget(null)} className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-full"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-5 md:p-8 space-y-6 pb-safe">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Full Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Mobile No.</label>
                  <input type="tel" value={editForm.mobile_number} onChange={e => setEditForm({...editForm, mobile_number: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold font-mono text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">System Role</label>
                  <div className="relative">
                    <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none cursor-pointer">
                      <option value="staff">Staff / Floor Worker</option>
                      <option value="manager">Branch Manager</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Salary (₹)</label>
                  <input type="number" value={editForm.salary} onChange={e => setEditForm({...editForm, salary: e.target.value})} className="w-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-2xl px-4 py-3.5 text-sm font-black font-mono text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Leave Cap</label>
                  <div className="relative">
                    <select value={editForm.max_paid_leaves} onChange={e => setEditForm({...editForm, max_paid_leaves: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none cursor-pointer">
                      <option value={4}>4 (Tier-A)</option>
                      <option value={2}>2 (Tier-B)</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="pt-2 sticky bottom-0 bg-white dark:bg-[#0a0a0a] pb-safe z-10">
                <button type="submit" disabled={editSubmitting} className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-[0.98]">
                  {editSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} strokeWidth={2.5} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: LOG ADVANCE (With 30% Logic)
      ══════════════════════════════════════════════════════════════════ */}
      {advanceTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center sm:p-4">
          <div className="w-full md:max-w-md rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl">
              <h2 className="text-base font-black flex items-center gap-2"><DollarSign size={18} className="text-orange-500" /> Log Transaction</h2>
              <button onClick={() => {setAdvanceTarget(null); setAdvanceForm({ type: "pre_advance", amount: "", remarks: "" });}} className="p-2 bg-gray-100 dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400 rounded-full transition-colors"><X size={16} /></button>
            </div>
            
            <form onSubmit={handleAdvanceSubmit} className="p-5 md:p-6 space-y-5 pb-safe">
              
              <div className="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-neutral-800">
                 <div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Employee</p>
                   <p className="text-sm font-black text-gray-900 dark:text-white">{advanceTarget.name}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fixed Salary</p>
                   <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">₹{salary.toLocaleString("en-IN")}</p>
                 </div>
              </div>

              {/* Smart 30% Logic Display */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-3 rounded-xl">
                  <p className="text-[9px] font-bold text-orange-600/70 dark:text-orange-400/70 uppercase tracking-widest mb-1">Max Limit (30%)</p>
                  <p className="font-mono font-black text-orange-700 dark:text-orange-400 text-sm">₹{maxAdvAllowed.toLocaleString("en-IN")}</p>
                </div>
                <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3 rounded-xl">
                  <p className="text-[9px] font-bold text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Currently Taken</p>
                  <p className="font-mono font-black text-red-700 dark:text-red-400 text-sm">₹{totalTaken.toLocaleString("en-IN")}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Transaction Type</label>
                <div className="relative">
                  <select value={advanceForm.type} onChange={e => setAdvanceForm({...advanceForm, type: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all appearance-none cursor-pointer">
                    <option value="pre_advance">Pre Advance</option>
                    <option value="final_advance">Final Advance</option>
                    <option value="shop_advance">Shop Advance</option>
                    <option value="shop_bill">Shop Bill</option>
                    <option value="deduction">Deduction / Fine</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-end pl-1 pr-1">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest">Amount (₹)</label>
                  {isAdvanceType && (
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-500">Available: ₹{remainingAdv.toLocaleString("en-IN")}</span>
                  )}
                </div>
                <input type="number" min="1" value={advanceForm.amount} onChange={e => setAdvanceForm({...advanceForm, amount: e.target.value})} className={`w-full rounded-2xl px-4 py-3.5 text-base font-black font-mono outline-none focus:ring-2 transition-all placeholder:text-gray-300 dark:placeholder:text-neutral-700 ${exceedsLimit ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800 text-red-600 focus:ring-red-500/50 focus:border-red-500' : 'bg-white dark:bg-[#111] border-gray-200 dark:border-neutral-800 text-gray-900 dark:text-white focus:ring-emerald-500/50 focus:border-emerald-500'}`} required placeholder="0.00" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Remarks</label>
                <textarea value={advanceForm.remarks} onChange={e => setAdvanceForm({...advanceForm, remarks: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none h-20 custom-scrollbar" placeholder="Optional note for records..." />
              </div>

              {exceedsLimit ? (
                <div className="p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-red-700 dark:text-red-400 leading-relaxed">Amount exceeds your 30% limit. Admin approval required for this transaction.</p>
                </div>
              ) : (
                <button type="submit" disabled={submittingAdvance} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-[0.98]">
                  {submittingAdvance ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} strokeWidth={2.5} /> Log Transaction</>}
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}