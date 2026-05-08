"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { callApi } from "@/lib/apiClient";
import {
  Building2, Users, Banknote, Clock, RefreshCw, UserCheck, MapPin, 
  Wallet, Shield, FileText, X, History, ChevronLeft, ChevronRight, Activity, 
  Coffee, LogIn, LogOut, Loader2
} from "lucide-react";

// ─── LOGGING METADATA ────────────
const LOG_MAP = {
  create_user:      { color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Admin" },
  USER_CREATED:     { color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Admin" },
  delete_user:      { color: "text-red-500",     bg: "bg-red-500/10",     dot: "bg-red-500",     label: "Admin" },
  USER_DELETED:     { color: "text-red-500",     bg: "bg-red-500/10",     dot: "bg-red-500",     label: "Admin" },
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

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h > 0 ? `${h}h ` : ''}${m}m`;
}

function isStrictlyToday(isoString) {
  if (!isoString) return false;
  return new Date(isoString).toLocaleDateString("en-IN") === new Date().toLocaleDateString("en-IN");
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
  const [liveData, setLiveData] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const fetchDashboardAndLive = useCallback(async () => {
    setLoading(true);
    const res = await callApi("get_admin_dashboard");
    if (res.status === "success") {
      setStats(res.data);
      
      const todayIso = new Date().toISOString().split('T')[0];
      const liveDataMap = {};
      
      if (res.data.branch_grid && res.data.branch_grid.length > 0) {
        await Promise.all(res.data.branch_grid.map(async (branch) => {
          const liveRes = await callApi("get_live_attendance", { branch_id: branch.id, date: todayIso });
          if (liveRes.status === "success") {
            liveDataMap[branch.id] = liveRes.data.all_people || [];
          }
        }));
      }
      setLiveData(liveDataMap);
    }
    setLoading(false);
  }, []);

  const fetchFeed = useCallback(async () => {
    setLogsLoading(true);
    const res = await callApi("get_system_logs", { per_page: 300 });
    if (res.status === "success") {
      const highLevelLogs = (res.data || []).filter(log => {
        const type = log.action_type.toUpperCase();
        return !type.includes("PUNCH") && !type.includes("ATTENDANCE") && !type.includes("LOGIN");
      });
      setLogs(highLevelLogs);
    }
    setLogsLoading(false);
  }, []);

  useEffect(() => { fetchDashboardAndLive(); }, [fetchDashboardAndLive]);
  useEffect(() => { fetchFeed(); }, [fetchFeed]);

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
    return stats?.branch_grid?.reduce((acc, b) => acc + (Number(b.est_salary) || 0), 0) || 0;
  }, [stats]);

  const groupedFilteredLogs = useMemo(() => {
    const filtered = logs.filter(log => {
      if (filterDate) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate !== filterDate) return false;
      }
      return true;
    });

    const scrubbedLogs = filtered.map(log => {
      let cleanDesc = log.description;
      if (stats?.branch_grid) {
        stats.branch_grid.forEach(b => {
          cleanDesc = cleanDesc.replace(new RegExp(`branch ID ${b.id}\\b`, 'gi'), b.branch_name);
          cleanDesc = cleanDesc.replace(new RegExp(`branch ${b.id}\\b`, 'gi'), b.branch_name);
        });
      }
      return { ...log, description: cleanDesc };
    });

    return groupLogsByDate(scrubbedLogs);
  }, [logs, filterDate, stats]);

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
            System Overview.
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-2 font-bold flex items-center gap-2">
            <Clock size={15} className="text-emerald-500" />
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} • {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </p>
        </div>

        <button onClick={() => { fetchDashboardAndLive(); fetchFeed(); }} disabled={loading || logsLoading} className="relative z-10 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-black font-black text-sm hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-xl shadow-gray-900/20 dark:shadow-white/10 active:scale-95 disabled:opacity-50 w-full md:w-auto">
          <RefreshCw size={16} strokeWidth={3} className={loading || logsLoading ? "animate-spin" : ""} />
          {loading || logsLoading ? "Synchronizing..." : "Sync Network"}
        </button>
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
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Live Attendance</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-black tabular-nums tracking-tight">{loading ? "—" : presentToday}</p>
              <p className="text-xs font-bold text-emerald-100 mt-2 opacity-90">Present on floor today</p>
            </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6 md:gap-8">
        
        {/* ── BRANCH SURVEILLANCE DATA WIDGETS ─────────────────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Building2 size={16} className="text-blue-500" /> Operational Branches
            </h2>
          </div>

          {loading ? (
             <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
          ) : stats?.branch_grid?.length === 0 ? (
             <div className="bg-white dark:bg-[#0a0a0a] border border-dashed border-gray-200 dark:border-neutral-800 rounded-3xl p-10 text-center text-gray-400 font-bold text-sm">No branches configured.</div>
          ) : (
            <div className="space-y-6">
              {stats?.branch_grid?.map(branch => {
                const total = parseInt(branch.staff_count) || 0;
                const present = parseInt(branch.present_today) || 0;
                const activePeople = liveData[branch.id]?.filter(p => p.status === 'working' || p.status === 'on_break') || [];
                
                return (
                  <div key={branch.id} className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
                    
                    <div className="p-6 md:p-8 flex items-start justify-between border-b border-gray-100 dark:border-neutral-900 bg-gray-50/30 dark:bg-[#111]/30">
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-gray-200 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 uppercase tracking-widest">{branch.branch_code || "Active"}</span>
                        </div>
                        <h3 className="font-black text-2xl text-gray-900 dark:text-white truncate">{branch.branch_name}</h3>
                        <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1 flex items-center gap-1.5 truncate"><MapPin size={12}/> {branch.address || "Location unassigned"}</p>
                      </div>
                      
                      <div className="flex items-center gap-6 shrink-0">
                         <div className="text-right hidden sm:block">
                           <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none">{total}</p>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">Total Staff</p>
                         </div>
                         <div className="text-right hidden sm:block">
                           <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">{present}</p>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5">Present</p>
                         </div>
                      </div>
                    </div>

                    <div className="w-full overflow-x-auto custom-scrollbar">
                      {activePeople.length === 0 ? (
                        <div className="p-10 flex flex-col items-center justify-center text-center opacity-50">
                           <Users size={32} className="text-gray-400 mb-3" />
                           <p className="text-sm font-bold text-gray-500">No personnel currently on the floor.</p>
                        </div>
                      ) : (
                        <table className="w-full text-left min-w-[600px]">
                          <thead>
                            <tr className="bg-gray-50/50 dark:bg-[#050505] border-b border-gray-100 dark:border-neutral-900 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              <th className="p-4">Personnel</th>
                              <th className="p-4 text-center">First In</th>
                              <th className="p-4 text-center">Last Out</th>
                              <th className="p-4 text-right">Work Time</th>
                              <th className="p-4 text-right">Break Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                            {activePeople.map(person => {
                              const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
                              
                              // STRICT FRONTEND PLUCKING: Guarantees accurate first punch from raw array
                              const todaysPunches = person.punches ? person.punches.filter(p => isStrictlyToday(p)) : [];
                              const strictFirstPunch = todaysPunches.length > 0 ? todaysPunches[0] : null;
                              const strictLastPunch = todaysPunches.length > 0 ? todaysPunches[todaysPunches.length - 1] : null;
                              
                              let breakMins = 0;
                              let workMins = 0;

                              if (todaysPunches.length > 0) {
                                const renderPunches = [...todaysPunches].map(p => new Date(p).getTime());
                                if (person.status === 'working') renderPunches.push(now.getTime());
                                
                                for (let i = 0; i < renderPunches.length - 1; i++) {
                                  const duration = Math.floor((renderPunches[i+1] - renderPunches[i]) / 60000);
                                  if (i % 2 === 0) workMins += duration;
                                  else breakMins += duration;
                                }
                              }

                              const isWorking = person.status === 'working';

                              return (
                                <tr key={person.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors">
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full ${isWorking ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'} shrink-0`}></span>
                                      <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{person.name}</p>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{person.role}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-center font-mono text-xs text-gray-600 dark:text-neutral-400 flex items-center justify-center gap-1.5"><LogIn size={12} className="text-gray-400"/> {formatTime(strictFirstPunch)}</td>
                                  <td className="p-4 text-center font-mono text-xs text-gray-600 dark:text-neutral-400">{isWorking ? <span className="text-emerald-500 font-black text-[10px] uppercase tracking-widest animate-pulse">Active</span> : formatTime(strictLastPunch)}</td>
                                  <td className="p-4 text-right font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">{formatDuration(workMins)}</td>
                                  <td className="p-4 text-right font-mono font-black text-sm text-red-500 dark:text-red-400">{formatDuration(breakMins)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SMART SYSTEM FEED (FINANCE & ADMIN LOGS ONLY) ────────────────────────── */}
        <div className="space-y-4 flex flex-col h-[700px] xl:h-[auto]">
          <div className="flex items-center justify-between px-1 shrink-0">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <History size={16} className="text-purple-500" /> Admin Audit Log
            </h2>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col flex-1 overflow-hidden">
            
            <div className="p-3 md:p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-neutral-900/20 flex flex-wrap items-center justify-between gap-2 md:gap-3 shrink-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400 pl-2">High-Level Events</p>
              
              <div className="flex items-center gap-1 bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shrink-0">
                <button onClick={handlePrevDay} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-gray-500"><ChevronLeft size={16}/></button>
                <div className="relative">
                  <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="bg-transparent text-[10px] md:text-xs font-black text-gray-700 dark:text-neutral-300 outline-none cursor-pointer w-24 text-center leading-none" />
                </div>
                <button onClick={handleNextDay} disabled={!filterDate} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-gray-500 disabled:opacity-30"><ChevronRight size={16}/></button>
                {filterDate && <button onClick={clearDate} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-lg transition-colors ml-1"><X size={14}/></button>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8">
              {logsLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-500" size={28} /></div>
              ) : Object.keys(groupedFilteredLogs).length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-24 opacity-50">
                  <FileText size={40} className="mb-4 text-gray-400" />
                  <p className="text-base font-black text-gray-900 dark:text-white">No logs found</p>
                  <p className="text-sm font-bold text-gray-500 mt-1">No administrative activity matches your current filters.</p>
                  <button onClick={clearDate} className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 rounded-lg text-xs font-black text-gray-600 dark:text-neutral-300 mt-4 hover:bg-gray-200 transition-colors">Clear Filters</button>
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(groupedFilteredLogs).map(([dateLabel, logs]) => (
                    <div key={dateLabel}>
                      <div className="flex items-center gap-4 mb-5 sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm z-10 py-1 -mt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 dark:bg-neutral-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-800">{dateLabel}</span>
                        <div className="h-px bg-gray-100 dark:bg-neutral-800 flex-1"></div>
                      </div>
                      
                      <div className="relative pl-4 md:pl-6 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6">
                        {logs.map((log) => {
                          const style = LOG_MAP[log.action_type] || LOG_MAP.default;
                          return (
                            <div key={log.id} className="relative group">
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

    </div>
  );
}