"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { callApi } from "@/lib/apiClient";
import {
  Building2, Users, Banknote, Activity, Clock, ArrowRight, RefreshCw, 
  UserCheck, MapPin, Sparkles, Plus, Wallet, Shield, Calendar, Search,
  Filter, UserPlus, ChevronDown, CheckCircle2, AlertTriangle, FileText,
  ChevronLeft, ChevronRight, X, Loader2, History
} from "lucide-react";
import Link from "next/link";

// ─── LOGGING METADATA ──────────────────────────────────────────────────────
const LOG_MAP = {
  login:            { color: "text-blue-500",    bg: "bg-blue-500/10",    dot: "bg-blue-500",    label: "Auth" },
  AUTH_LOGIN:       { color: "text-blue-500",    bg: "bg-blue-500/10",    dot: "bg-blue-500",    label: "Auth" },
  create_user:      { color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Admin" },
  USER_CREATED:     { color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Admin" },
  delete_user:      { color: "text-red-500",     bg: "bg-red-500/10",     dot: "bg-red-500",     label: "Admin" },
  USER_DELETED:     { color: "text-red-500",     bg: "bg-red-500/10",     dot: "bg-red-500",     label: "Admin" },
  attendance_punch: { color: "text-purple-500",  bg: "bg-purple-500/10",  dot: "bg-purple-500",  label: "Punch" },
  PUNCH_LOGGED:     { color: "text-purple-500",  bg: "bg-purple-500/10",  dot: "bg-purple-500",  label: "Punch" },
  ATTENDANCE_IN:    { color: "text-purple-500",  bg: "bg-purple-500/10",  dot: "bg-purple-500",  label: "Punch In" },
  ATTENDANCE_OUT:   { color: "text-purple-500",  bg: "bg-purple-500/10",  dot: "bg-purple-500",  label: "Punch Out" },
  SALARY_PAID:      { color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Payroll" },
  advance_log:      { color: "text-orange-500",  bg: "bg-orange-500/10",  dot: "bg-orange-500",  label: "Finance" },
  ADVANCE_LOGGED:   { color: "text-orange-500",  bg: "bg-orange-500/10",  dot: "bg-orange-500",  label: "Finance" },
  FACE_REGISTERED:  { color: "text-indigo-500",  bg: "bg-indigo-500/10",  dot: "bg-indigo-500",  label: "Biometric" },
  default:          { color: "text-slate-500",   bg: "bg-slate-500/10",   dot: "bg-slate-400",   label: "System" },
};

// ─── HELPERS ───────────────────────────────────────────────────────────────
function formatLogGroupDate(isoString) {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function groupLogsByDate(logs) {
  const grouped = {};
  logs.forEach(log => {
    const groupKey = formatLogGroupDate(log.created_at);
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(log);
  });
  return grouped;
}

// ─── CUSTOM SVG PROGRESS RING ──────────────────────────────────────────────
const CircularProgress = ({ value, max, colorClass, size = 64, strokeWidth = 6 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeValue = Math.min(Math.max(value || 0, 0), max || 1);
  const percent = max > 0 ? safeValue / max : 0;
  const offset = circumference - percent * circumference;
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 absolute inset-0">
        <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-gray-200 dark:text-neutral-800" />
        <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} className={`${colorClass} transition-all duration-1000 ease-out`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-black text-gray-900 dark:text-white">{Math.round(percent * 100)}%</span>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // Smart Feed State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  // Tick clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const res = await callApi("get_admin_dashboard");
    if (res.status === "success") {
      setStats(res.data);
    }
    setLoading(false);
  }, []);

  const fetchFeed = useCallback(async () => {
    setLogsLoading(true);
    const res = await callApi("get_system_logs", { per_page: 300, branch_id: filterBranch === "all" ? "" : filterBranch });
    if (res.status === "success") {
      setLogs(res.data || []);
    }
    setLogsLoading(false);
  }, [filterBranch]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Smart Date Navigation Handlers
  const handlePrevDay = () => {
    const d = filterDate ? new Date(filterDate) : new Date();
    d.setDate(d.getDate() - 1);
    setFilterDate(d.toISOString().split('T')[0]);
  };
  
  const handleNextDay = () => {
    if (!filterDate) return;
    const d = new Date(filterDate);
    d.setDate(d.getDate() + 1);
    setFilterDate(d.toISOString().split('T')[0]);
  };

  const clearDate = () => setFilterDate("");

  // Smart Aggregation (Failsafe for Missing Root Variables)
  const totalEmployees = useMemo(() => {
    if (stats?.total_employees > 0) return stats.total_employees;
    return stats?.branch_grid?.reduce((acc, b) => acc + (Number(b.staff_count) || 0), 0) || 0;
  }, [stats]);

  const presentToday = useMemo(() => {
    if (stats?.present_today > 0) return stats.present_today;
    return stats?.branch_grid?.reduce((acc, b) => acc + (Number(b.present_today) || 0), 0) || 0;
  }, [stats]);

  const salaryVal = useMemo(() => {
    if (stats?.salary_expenditure > 0) return Number(stats.salary_expenditure);
    // If exact salary isn't provided, we can estimate it based on fixed salaries or just return 0 if unavailable
    return stats?.branch_grid?.reduce((acc, b) => acc + (Number(b.est_salary) || 0), 0) || 0;
  }, [stats]);

  // Smart Filtering & Branch ID Scrubbing
  const groupedFilteredLogs = useMemo(() => {
    const filtered = logs.filter(log => {
      if (filterType === "attendance") {
        if (!log.action_type.includes("ATTENDANCE") && !log.action_type.includes("PUNCH")) return false;
      }
      if (filterType === "finance") {
        if (!log.action_type.includes("ADVANCE") && !log.action_type.includes("SALARY") && !log.action_type.includes("BILL") && !log.action_type.includes("PAYROLL")) return false;
      }
      if (filterDate) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate !== filterDate) return false;
      }
      return true;
    });

    // Scrub branch IDs and replace with Branch Names
    const scrubbedLogs = filtered.map(log => {
      let cleanDesc = log.description;
      if (stats?.branch_grid) {
        stats.branch_grid.forEach(b => {
          // Replace "branch ID X" or "branch X" with actual name
          cleanDesc = cleanDesc.replace(new RegExp(`branch ID ${b.id}\\b`, 'gi'), b.branch_name);
          cleanDesc = cleanDesc.replace(new RegExp(`branch ${b.id}\\b`, 'gi'), b.branch_name);
        });
      }
      return { ...log, description: cleanDesc };
    });

    return groupLogsByDate(scrubbedLogs);
  }, [logs, filterType, filterDate, stats]);

  const thisMonth = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 md:space-y-8 font-sans pb-24 animate-in fade-in duration-500 overflow-x-hidden">

      {/* ── HERO COMMAND HEADER ─────────────────────────────────── */}
      <div className="relative bg-white/60 dark:bg-[#0a0a0a]/60 backdrop-blur-2xl border border-gray-200/60 dark:border-neutral-800/60 rounded-[2rem] p-6 md:p-8 shadow-sm overflow-hidden flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500">Global System Online</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
            Admin Dashboard.
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 font-bold flex items-center gap-2">
            <Clock size={15} className="text-emerald-500" />
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} • {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </p>
        </div>

        <button onClick={() => { fetchDashboard(); fetchFeed(); }} disabled={loading || logsLoading} className="relative z-10 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-black font-black text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-xl shadow-gray-900/20 dark:shadow-white/10 active:scale-95 disabled:opacity-50 w-full md:w-auto">
          <RefreshCw size={16} strokeWidth={3} className={loading || logsLoading ? "animate-spin" : ""} />
          {loading || logsLoading ? "Synchronizing..." : "Sync Network"}
        </button>
      </div>

      {/* ── SHORTCUT COMMAND CENTER ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Link href="/admin/employees" className="group flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all active:scale-95">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform"><UserPlus size={20} strokeWidth={2.5} /></div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-neutral-400 group-hover:text-blue-500">Hire Staff</span>
        </Link>
        <Link href="/admin/payroll" className="group flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 transition-all active:scale-95">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform"><Banknote size={20} strokeWidth={2.5} /></div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-neutral-400 group-hover:text-emerald-500">Run Payroll</span>
        </Link>
        <Link href="/admin/branches" className="group flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10 transition-all active:scale-95">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform"><Building2 size={20} strokeWidth={2.5} /></div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-neutral-400 group-hover:text-purple-500">Branches</span>
        </Link>
        <Link href="/admin/settings" className="group flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/10 transition-all active:scale-95">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform"><Shield size={20} strokeWidth={2.5} /></div>
          <span className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-neutral-400 group-hover:text-orange-500">Logic Config</span>
        </Link>
      </div>

      {/* ── GLOBAL TELEMETRY (GRADIENT STAT CARDS) ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 shadow-lg shadow-blue-500/20 flex flex-col justify-between text-white group">
          <div className="absolute -right-6 -top-6 opacity-20 transform group-hover:scale-110 transition-transform duration-500"><Users size={140} /></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Total Workforce</p>
            </div>
            <p className="text-4xl md:text-5xl font-black tabular-nums tracking-tight">{loading ? "—" : totalEmployees}</p>
            <p className="text-xs font-bold text-blue-100 mt-2 opacity-90">Across {stats?.branch_grid?.length || 0} active branches</p>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-600 rounded-3xl p-6 shadow-lg shadow-emerald-500/20 flex flex-col justify-between text-white group">
          <div className="absolute -right-6 -top-6 opacity-20 transform group-hover:scale-110 transition-transform duration-500"><UserCheck size={140} /></div>
          <div className="relative z-10 flex justify-between items-end h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Live Attendance</p>
              </div>
              <p className="text-4xl md:text-5xl font-black tabular-nums tracking-tight">{loading ? "—" : presentToday}</p>
              <p className="text-xs font-bold text-emerald-100 mt-2 opacity-90">Present on floor today</p>
            </div>
            {!loading && <CircularProgress value={presentToday} max={totalEmployees || 1} colorClass="text-white" size={60} strokeWidth={5} />}
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-orange-400 to-rose-600 rounded-3xl p-6 shadow-lg shadow-orange-500/20 flex flex-col justify-between text-white group">
          <div className="absolute -right-6 -top-6 opacity-20 transform group-hover:scale-110 transition-transform duration-500"><Banknote size={140} /></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-100">Gross Run Rate</p>
            </div>
            <p className="text-4xl md:text-5xl font-black tabular-nums tracking-tight">{loading ? "—" : `₹${(salaryVal/1000).toFixed(1)}k`}</p>
            <p className="text-xs font-bold text-orange-100 mt-2 opacity-90">Est. expenditure for {thisMonth}</p>
          </div>
        </div>

      </div>

      {/* ── BRANCH SURVEILLANCE GRID (DOMINANT VIEW) ───────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
            <Building2 size={16} className="text-blue-500" /> Branch Telemetry
          </h2>
          <Link href="/admin/branches" className="text-xs font-bold text-emerald-600 dark:text-emerald-500 hover:underline">
            Manage Branches →
          </Link>
        </div>

        {loading ? (
           <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
        ) : stats?.branch_grid?.length === 0 ? (
           <div className="bg-white dark:bg-[#0a0a0a] border border-dashed border-gray-200 dark:border-neutral-800 rounded-3xl p-10 text-center text-gray-400 font-bold text-sm">No branches configured.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {stats?.branch_grid?.map(branch => {
              const total = parseInt(branch.staff_count) || 0;
              const present = parseInt(branch.present_today) || 0;
              return (
                <Link
                  key={branch.id}
                  href={`/admin/branch?id=${branch.id}`}
                  className="relative group bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-[2rem] p-6 hover:border-emerald-300 dark:hover:border-emerald-900/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all overflow-hidden flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-gray-100 dark:bg-neutral-900 text-gray-500 uppercase tracking-widest">{branch.branch_code || "Active"}</span>
                      </div>
                      <h3 className="font-black text-xl md:text-2xl text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{branch.branch_name}</h3>
                      <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1 flex items-center gap-1.5 truncate"><MapPin size={12}/> {branch.address || "Location unassigned"}</p>
                    </div>
                    <CircularProgress value={present} max={total} colorClass="text-emerald-500" size={54} strokeWidth={5} />
                  </div>
                  
                  <div className="flex items-center gap-6 pt-4 border-t border-gray-100 dark:border-neutral-900">
                    <div>
                      <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none">{total}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Staff</p>
                    </div>
                    <div className="w-px h-8 bg-gray-100 dark:bg-neutral-900"></div>
                    <div>
                      <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">{present}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Present Today</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SMART SYSTEM FEED (LOCKED HEIGHT) ────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
            <History size={16} className="text-purple-500" /> System Audit Timeline
          </h2>
        </div>

        {/* Locked h-[600px] frame prevents page stretching */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col h-[600px] overflow-hidden">
          
          {/* Smart Filter Header */}
          <div className="p-3 md:p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-neutral-900/20 flex flex-wrap items-center gap-2 md:gap-3 shrink-0">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-600 dark:text-neutral-400 rounded-xl px-3 py-2.5 outline-none cursor-pointer">
              <option value="all">All Events</option>
              <option value="attendance">Attendance</option>
              <option value="finance">Finance</option>
            </select>
            
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-600 dark:text-neutral-400 rounded-xl px-3 py-2.5 outline-none truncate cursor-pointer max-w-[140px] md:max-w-none">
              <option value="all">All Branches</option>
              {stats?.branch_grid?.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>

            {/* Smart Date Nav */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shrink-0 ml-auto md:ml-0">
              <button onClick={handlePrevDay} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-gray-500"><ChevronLeft size={16}/></button>
              
              <div className="relative">
                <input 
                  type="date" 
                  value={filterDate} 
                  onChange={e => setFilterDate(e.target.value)} 
                  className="bg-transparent text-[10px] md:text-xs font-black text-gray-700 dark:text-neutral-300 outline-none cursor-pointer w-24 text-center leading-none"
                />
              </div>

              <button onClick={handleNextDay} disabled={!filterDate} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-gray-500 disabled:opacity-30"><ChevronRight size={16}/></button>
              {filterDate && <button onClick={clearDate} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-colors ml-1"><X size={14}/></button>}
            </div>
          </div>

          {/* Scrolling Feed Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8">
            {logsLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-500" size={28} /></div>
            ) : Object.keys(groupedFilteredLogs).length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24 opacity-50">
                <FileText size={40} className="mb-4 text-gray-400" />
                <p className="text-base font-black text-gray-900 dark:text-white">No logs found</p>
                <p className="text-sm font-bold text-gray-500 mt-1">No system activity matches your current filters.</p>
                <button onClick={() => {setFilterType('all'); setFilterBranch('all'); setFilterDate('');}} className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-xs font-black text-gray-600 dark:text-neutral-300 mt-4 hover:bg-gray-200 transition-colors">Clear Filters</button>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedFilteredLogs).map(([dateLabel, logs]) => (
                  <div key={dateLabel}>
                    <div className="flex items-center gap-4 mb-5 sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm rounded-lg z-10 py-1 -mt-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 dark:bg-neutral-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-800">{dateLabel}</span>
                      <div className="h-px bg-gray-100 dark:bg-neutral-800 flex-1"></div>
                    </div>
                    
                    <div className="relative pl-4 md:pl-6 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6">
                      {logs.map((log) => {
                        const style = LOG_MAP[log.action_type] || LOG_MAP.default;
                        return (
                          <div key={log.id} className="relative group">
                            {/* Explicit Dot Color */}
                            <div className={`absolute -left-[21px] md:-left-[29px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white dark:ring-[#0a0a0a] ${style.dot} shadow-sm`} />
                            
                            <div className="pl-2 md:pl-3">
                              <p className="text-sm font-bold text-gray-900 dark:text-neutral-100 leading-snug mb-2">{log.description}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${style.bg} ${style.color}`}>
                                  {style.label}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                                  {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                                {log.actor_name && (
                                  <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5 border-l border-gray-200 dark:border-neutral-800 pl-2">
                                    By <span className="text-gray-700 dark:text-neutral-300">{log.actor_name}</span>
                                  </span>
                                )}
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
  );
}