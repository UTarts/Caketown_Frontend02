"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  CalendarDays, Loader2, Edit2, X, Check, Search, 
  ChevronDown, Building2, Calendar, CheckCircle2, XCircle, Clock, Activity, Coffee, History, XCircle2
} from "lucide-react";

// ─── HELPERS ───────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

const getLocalDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function calcPaidHolidays(daysPresent, cap) {
  if (cap >= 4) {
    if (daysPresent >= 24) return 4;
    if (daysPresent >= 20) return 3;
    if (daysPresent >= 14) return 2;
    if (daysPresent >= 10) return 1;
    return 0;
  }
  if (daysPresent >= 24) return 2;
  if (daysPresent >= 14) return 1;
  return 0;
}

// ─── UPGRADED MARKER WITH PARTIAL-WORK DOT & OVERRIDE DOT ──────────────────
function AttendanceMarker({ status, dayData }) {
  const map = {
    F:  { label: "F",  bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400" },
    P:  { label: "F",  bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400" },
    H:  { label: "H",  bg: "bg-yellow-100 dark:bg-yellow-500/20",   text: "text-yellow-700 dark:text-yellow-400" },
    A:  { label: "A",  bg: "bg-red-100 dark:bg-red-500/20",         text: "text-red-700 dark:text-red-400" },
    L:  { label: "L",  bg: "bg-blue-100 dark:bg-blue-500/20",       text: "text-blue-700 dark:text-blue-400" },
    PH: { label: "★",  bg: "bg-purple-100 dark:bg-purple-500/20",   text: "text-purple-700 dark:text-purple-400" },
    "-":{ label: "–",  bg: "bg-transparent",                        text: "text-gray-300 dark:text-neutral-700" },
  };
  const m = map[status] || map["-"];
  
  const hasPartialWork = status === 'A' && dayData?.punches?.length > 0 && !dayData?.override;
  const isOverride = dayData?.override;

  return (
    <span className={`relative inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-[10px] font-black transition-colors ${m.bg} ${m.text}`}>
      {m.label}
      {hasPartialWork && (
        <span title="Incomplete Hours" className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500 border border-white dark:border-[#0a0a0a] shadow-sm animate-in zoom-in"></span>
      )}
      {isOverride && (
        <span title="Admin Override Active" className="absolute -bottom-1 -left-1 w-1.5 h-2 rounded-full bg-blue-500 border border-white dark:border-[#0a0a0a] shadow-sm animate-in zoom-in"></span>
      )}
    </span>
  );
}

// ─── DAILY PUNCH SUMMARY COMPONENT ─────────────────────────────────────────
function DailyPunchSummary({ dayData, date }) {
  if (!dayData || !dayData.punches || dayData.punches.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-[#111] border border-dashed border-gray-200 dark:border-neutral-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
        <Clock size={28} className="mb-3 text-gray-400" />
        <p className="text-sm font-bold text-gray-500">No punches recorded for {new Date(date).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', year: 'numeric' })}</p>
      </div>
    );
  }

  const punches = dayData.punches;
  let workMins = 0;
  let breakMins = 0;
  const workSessions = [];
  const breakSessions = [];
  
  const renderPunches = [...punches].map(p => new Date(p).getTime());

  for (let i = 0; i < renderPunches.length - 1; i++) {
    const duration = Math.floor((renderPunches[i+1] - renderPunches[i]) / 60000);
    const session = { start: renderPunches[i], end: renderPunches[i+1], duration };
    
    if (i % 2 === 0) { workSessions.push(session); workMins += duration; }
    else { breakSessions.push(session); breakMins += duration; }
  }

  const startTime = renderPunches[0];
  const endTime = renderPunches[renderPunches.length - 1];
  const totalDurationMins = Math.floor((endTime - startTime) / 60000);

  const formatHm = (mins) => {
    const h = Math.floor(mins / 60); const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true }) : "—";
  const formatTimeFromTs = (ts) => new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
         <div className="bg-gray-50 dark:bg-[#111] p-3 rounded-xl border border-gray-200 dark:border-neutral-800">
           <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 pl-0.5">First In</p>
           <p className="font-mono font-black text-sm text-gray-900 dark:text-white">{formatTime(dayData.first_in)}</p>
         </div>
         <div className="bg-gray-50 dark:bg-[#111] p-3 rounded-xl border border-gray-200 dark:border-neutral-800">
           <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 pl-0.5">Last Out</p>
           <p className="font-mono font-black text-sm text-gray-900 dark:text-white">{formatTime(dayData.last_out)}</p>
         </div>
         <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
           <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1 pl-0.5">Work Time</p>
           <p className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">{formatHm(workMins)}</p>
         </div>
         <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
           <p className="text-[9px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest mb-1 pl-0.5">Break Time</p>
           <p className="font-mono font-black text-sm text-red-700 dark:text-red-400">{formatHm(breakMins)}</p>
         </div>
      </div>
      
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><History size={12}/> Chronological Log</h4>
        
        <div className="mb-6">
          <div className="flex w-full h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            {renderPunches.slice(0, -1).map((_, idx) => {
              const isWork = idx % 2 === 0;
              const duration = Math.floor((renderPunches[idx+1] - renderPunches[idx]) / 60000);
              const percent = totalDurationMins > 0 ? (duration / totalDurationMins) * 100 : 0;
              return (
                <div key={idx} style={{ width: `${percent}%` }} className={`h-full ${isWork ? 'bg-emerald-500' : 'bg-red-400'}`} />
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-1.5 px-0.5">
            <span className="text-[10px] font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest">{formatTimeFromTs(startTime)}</span>
            <span className="text-[10px] font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest">{formatTimeFromTs(endTime)}</span>
          </div>
        </div>

        <div className="relative pl-5 border-l-2 border-gray-100 dark:border-neutral-800 ml-2 space-y-4">
           {punches.map((punch, idx) => {
              const isPIn = idx % 2 === 0;
              return (
                <div key={idx} className="relative">
                  <div className={`absolute -left-[27px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white dark:ring-[#0a0a0a] shadow-sm flex items-center justify-center ${isPIn ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div className="bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 rounded-lg p-2.5 inline-block min-w-[150px]">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isPIn ? 'text-emerald-600' : 'text-red-600'}`}>Punched {isPIn ? 'IN' : 'OUT'}</span>
                    </div>
                    <p className="font-mono font-black text-sm text-gray-900 dark:text-white">{formatTime(punch)}</p>
                  </div>
                </div>
              )
           })}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────
function AttendanceLedgerContent() {
  const searchParams = useSearchParams();
  const urlBranchId = searchParams.get("branch_id") || "all";

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState(urlBranchId);
  const [activeTab, setActiveTab] = useState("ledger"); 

  const now = new Date();
  const [finMonth, setFinMonth] = useState(now.getMonth() + 1);
  const [finYear, setFinYear] = useState(now.getFullYear());
  const daysInMonth = new Date(finYear, finMonth, 0).getDate();
  const [attendanceGrid, setAttendanceGrid] = useState([]);
  
  const [overrideTarget, setOverrideTarget] = useState(null); 
  const [overrideForm, setOverrideForm] = useState({ status: "F", reason: "" }); 
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  
  // NEW: Override History States
  const [overrideHistory, setOverrideHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const [leaveActionModal, setLeaveActionModal] = useState(null);
  const [leaveRemark, setLeaveRemark] = useState("");
  const [leaveActionSubmitting, setLeaveActionSubmitting] = useState(false);

  // Sync branch changes from global sidebar
  useEffect(() => {
    if (urlBranchId !== branchId) {
      setBranchId(urlBranchId);
    }
  }, [urlBranchId]);

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) return;
    try { setSession(JSON.parse(raw)); } catch {}
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!branchId || branchId === 'all') return;
    setLoading(true);
    const res = await callApi("get_monthly_attendance", { branch_id: branchId, month: finMonth, year: finYear });
    if (res.status === "success") setAttendanceGrid(res.data);
    setLoading(false);
  }, [branchId, finMonth, finYear]);

  const loadLeaveRequests = useCallback(async () => {
    if (!branchId || branchId === 'all') return;
    setLeaveLoading(true);
    const res = await callApi("get_leave_applications", { branch_id: branchId, status: 'all' });
    if (res.status === "success") setLeaveRequests(res.data || []);
    setLeaveLoading(false);
  }, [branchId]);

  useEffect(() => { 
    if (activeTab === "ledger") loadAttendance(); 
    else loadLeaveRequests();
  }, [activeTab, loadAttendance, loadLeaveRequests]);

  // Fetch the robust Audit History for the specific cell
  const fetchOverrideHistory = async (userId, dateStr) => {
    setHistoryLoading(true);
    setOverrideHistory([]);
    const res = await callApi("get_system_logs", { target_user_id: userId, per_page: 100 });
    if (res.status === "success") {
      const logs = (res.data || []).filter(l => 
        l.action_type === 'ATTENDANCE_OVERRIDE' && l.description.includes(dateStr)
      );
      setOverrideHistory(logs);
    }
    setHistoryLoading(false);
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    setOverrideSubmitting(true);
    const res = await callApi("set_attendance_override", {
      user_id: overrideTarget.user.id, 
      date: overrideTarget.date, 
      status: overrideForm.status, 
      reason: overrideForm.reason, 
      admin_id: session?.id
    });
    setOverrideSubmitting(false);
    
    if (res?.status === "success") { 
      setOverrideTarget(null); 
      loadAttendance();
    } else {
      alert(res?.message || "A critical server error occurred. Please check database logs.");
    }
  };

  const handleLeaveActionSubmit = async (e) => {
    e.preventDefault();
    setLeaveActionSubmitting(true);
    
    const res = await callApi("update_leave_status", {
      leave_id: leaveActionModal.req.id, 
      status: leaveActionModal.action, 
      admin_id: session?.id, 
      admin_remarks: leaveRemark
    });
    
    setLeaveActionSubmitting(false);

    if (res.status === "success") {
      setLeaveActionModal(null);
      setLeaveRemark("");
      loadLeaveRequests();
      loadAttendance(); 
    } else {
      alert(res.message || "Failed to update leave status.");
    }
  };

  if (branchId === "all") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4 animate-in fade-in">
        <Building2 size={64} className="text-gray-300 dark:text-neutral-700 mb-4" strokeWidth={1.5} />
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Select a Branch</h2>
        <p className="text-gray-500 font-medium">Please select a specific branch from the global sidebar to view its attendance ledger.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in duration-500 pb-24 text-gray-900 dark:text-neutral-200 w-full min-w-0 max-w-full">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm w-full min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 mb-1">
            <CalendarDays size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Time & Tracking</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            Attendance Ledger
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 font-medium truncate">
            Manage monthly duty grids, manual overrides, and staff leave applications.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-1.5 shadow-sm shrink-0 overflow-x-auto">
          <button onClick={() => setActiveTab("ledger")} className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'ledger' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
            Duty Ledger
          </button>
          <button onClick={() => setActiveTab("requests")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all whitespace-nowrap ${activeTab === 'requests' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
            Leave Requests 
            {leaveRequests.filter(l => l.status === 'pending').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: ATTENDANCE LEDGER GRID
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "ledger" && (
        <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4 w-full min-w-0 max-w-full">
          <div className="flex flex-wrap gap-2.5 items-center bg-white dark:bg-[#0a0a0a] p-2.5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm w-fit mx-1">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2">
              <Calendar size={14} className="text-blue-500" />
              <select value={finMonth} onChange={e => setFinMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
              </select>
            </div>
            <select value={finYear} onChange={e => setFinYear(parseInt(e.target.value))} className="bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2 text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={loadAttendance} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-black rounded-xl hover:bg-gray-800 active:scale-95 transition-all">Load Period</button>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col w-full min-w-0 overflow-hidden min-h-[500px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#050505]/50 shrink-0 gap-4">
              <div className="flex flex-wrap gap-4">
                {[
                  { marker: "F", label: "Full Day", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
                  { marker: "H", label: "Half Day", bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400" },
                  { marker: "L", label: "On Leave", bg: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
                  { marker: "A", label: "Absent",   bg: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
                  { marker: "PH", label: "Holiday", bg: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
                ].map(l => (
                  <div key={l.marker} className="flex items-center gap-2">
                    <span className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-black ${l.bg}`}>{l.marker === 'PH' ? '★' : l.marker}</span>
                    <span className="text-xs font-bold text-gray-600 dark:text-neutral-400">{l.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex flex-wrap items-center gap-3 md:gap-4 md:text-right">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> Incomplete Punches</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Admin Override</span>
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center items-center flex-1 min-h-[400px]"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
            ) : attendanceGrid.length === 0 ? (
              <div className="flex items-center justify-center text-center text-gray-400 font-bold text-sm flex-1 min-h-[400px]">No attendance records found.</div>
            ) : (
              <div className="relative flex-1 w-full h-full min-h-[400px]">
                <div className="absolute inset-0 w-full overflow-auto custom-scrollbar pb-1">
                  <table className="w-full text-left border-collapse" style={{ minWidth: `${140 + daysInMonth * 40}px` }}>
                    <thead>
                      <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-300 dark:border-neutral-700">
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-sm z-20 border-r border-gray-300 dark:border-neutral-700 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">Personnel</th>
                        {[...Array(daysInMonth)].map((_, i) => {
                          const d = new Date(finYear, finMonth - 1, i + 1);
                          return (
                            <th key={i} className="p-1.5 text-center min-w-[40px] border-r border-gray-300 dark:border-neutral-700">
                              <div className="text-[8px] font-black uppercase mb-0.5 text-gray-400">{d.toLocaleDateString("en-IN", { weekday: "short" }).charAt(0)}</div>
                              <div className="text-xs font-black text-gray-900 dark:text-white">{i + 1}</div>
                            </th>
                          );
                        })}
                        {["F", "H", "A", "L"].map(h => <th key={h} className="p-2 text-center text-[9px] font-black text-gray-400 uppercase min-w-[30px] border-r border-gray-300 dark:border-neutral-700">{h}</th>)}
                        <th className="p-2 text-center text-[9px] font-black text-emerald-600 uppercase min-w-[50px] bg-emerald-50/30 dark:bg-emerald-900/10 border-l border-emerald-300 dark:border-emerald-700/50">Earned<br/>Leaves</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300 dark:divide-neutral-700">
                      {attendanceGrid.map((row, idx) => {
                        let totF = 0, totH = 0, totA = 0, totL = 0;
                        const todayStr = getLocalDate();
                        
                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 group">
                            <td className="p-3 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/50 dark:group-hover:bg-[#111] z-10 border-r border-gray-300 dark:border-neutral-700 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">
                              <p className="font-black text-xs text-gray-900 dark:text-white whitespace-nowrap">{row.name}</p>
                            </td>
                            {[...Array(daysInMonth)].map((_, i) => {
                              const dateStr = `${finYear}-${pad(finMonth)}-${pad(i + 1)}`;
                              let status = row.days?.[dateStr]?.status || row.days?.[dateStr] || "-";
                              
                              if (status !== "-" && dateStr > todayStr && !row.days?.[dateStr]?.override) {
                                 status = "-"; 
                              }
                              
                              if (status === "P" || status === "F" || status === "PH") { totF++; if(status !== "PH") status = "F"; }
                              else if (status === "H") { totH++; }
                              else if (status === "A") { totA++; }
                              else if (status === "L") { totL++; }

                              return (
                                <td 
                                  key={i} 
                                  onClick={() => {
                                    const dayData = row.days?.[dateStr] || null;
                                    setOverrideTarget({ user: row, date: dateStr, dayData });
                                    setOverrideForm({ status: status === "F" || status === "P" ? "F" : (status === "-" ? "L" : status), reason: "" }); 
                                    fetchOverrideHistory(row.id, dateStr); // Fetch robust history on click
                                  }}
                                  className="p-1 text-center border-r border-gray-300 dark:border-neutral-700 transition-colors cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <AttendanceMarker status={status} dayData={row.days?.[dateStr]} />
                                </td>
                              );
                            })}
                            <td className="p-2 text-center font-mono font-black text-xs text-emerald-600 border-r border-gray-300 dark:border-neutral-700">{totF}</td>
                            <td className="p-2 text-center font-mono font-black text-xs text-yellow-600 border-r border-gray-300 dark:border-neutral-700">{totH}</td>
                            <td className="p-2 text-center font-mono font-black text-xs text-red-500 border-r border-gray-300 dark:border-neutral-700">{totA}</td>
                            <td className="p-2 text-center font-mono font-black text-xs text-blue-500 border-r border-gray-300 dark:border-neutral-700">{totL}</td>
                            <td className="p-2 text-center font-mono font-black text-xs text-emerald-600 bg-emerald-50/30 dark:bg-emerald-900/10 border-l border-emerald-300 dark:border-emerald-700/50">
                              {calcPaidHolidays(totF + (totH * 0.5), row.max_paid_leaves_cap ?? row.max_paid_leaves ?? 4)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: LEAVE REQUESTS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "requests" && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 w-full min-w-0">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden min-h-[500px]">
             {leaveLoading ? (
               <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
             ) : leaveRequests.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-24 opacity-50">
                 <CalendarDays size={48} className="text-gray-400 mb-4" />
                 <p className="text-lg font-black text-gray-900 dark:text-white">No Leave Applications</p>
                 <p className="text-sm font-bold text-gray-500">There are no pending leave requests from the staff.</p>
               </div>
             ) : (
               <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {leaveRequests.map(req => (
                   <div key={req.id} className={`border rounded-2xl p-5 relative overflow-hidden ${
                     req.status === 'pending' ? 'bg-yellow-50/30 dark:bg-yellow-900/5 border-yellow-200 dark:border-yellow-900/50' : 
                     req.status === 'approved' ? 'bg-emerald-50/30 dark:bg-emerald-900/5 border-emerald-200 dark:border-emerald-900/50' :
                     'bg-red-50/30 dark:bg-red-900/5 border-red-200 dark:border-red-900/50'
                   }`}>
                     {req.status === 'pending' && <div className="absolute top-0 right-0 px-3 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 text-[10px] font-black uppercase rounded-bl-xl">Pending Review</div>}
                     {req.status === 'approved' && <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-black uppercase rounded-bl-xl">Approved</div>}
                     {req.status === 'rejected' && <div className="absolute top-0 right-0 px-3 py-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-[10px] font-black uppercase rounded-bl-xl">Rejected</div>}
                     
                     <div className="flex items-center gap-3 mb-4 mt-2">
                       <div className="w-10 h-10 rounded-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 flex items-center justify-center font-black text-sm text-gray-700 dark:text-neutral-300">
                         {req.name.charAt(0)}
                       </div>
                       <div>
                         <h3 className="font-black text-gray-900 dark:text-white leading-tight">{req.name}</h3>
                         <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{req.department} • {req.role}</p>
                       </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4 mb-4">
                       <div className="bg-white dark:bg-black border border-gray-100 dark:border-neutral-800 p-3 rounded-xl">
                         <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">From Date</p>
                         <p className="text-sm font-mono font-black text-blue-600 dark:text-blue-400">{new Date(req.start_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                       </div>
                       <div className="bg-white dark:bg-black border border-gray-100 dark:border-neutral-800 p-3 rounded-xl">
                         <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">To Date</p>
                         <p className="text-sm font-mono font-black text-blue-600 dark:text-blue-400">{new Date(req.end_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                       </div>
                     </div>

                     <div className="mb-4">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Employee Reason</p>
                       <div className="bg-white dark:bg-black border border-gray-100 dark:border-neutral-800 p-3.5 rounded-xl text-sm font-medium text-gray-700 dark:text-neutral-300">
                         {req.reason}
                       </div>
                     </div>

                     {req.status === 'pending' && (
                       <div className="flex gap-3 pt-2">
                         <button onClick={() => { setLeaveActionModal({ req, action: 'rejected' }); setLeaveRemark(''); }} className="flex-1 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-black rounded-xl transition-colors border border-red-200 dark:border-red-900/50 flex items-center justify-center gap-2">
                           <XCircle size={16}/> Reject
                         </button>
                         <button onClick={() => { setLeaveActionModal({ req, action: 'approved' }); setLeaveRemark(''); }} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                           <CheckCircle2 size={16}/> Approve Leave
                         </button>
                       </div>
                     )}

                     {req.admin_remarks && (
                       <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-neutral-800/50">
                         <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 pl-1">Admin Remarks</p>
                         <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 pl-1">{req.admin_remarks}</p>
                       </div>
                     )}

                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: OVERRIDE STATUS WITH FULL AUDIT HISTORY
      ══════════════════════════════════════════════════════════════════ */}
      {overrideTarget && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-72 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-xl max-h-[90vh] rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
            
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] shrink-0">
              <h2 className="text-base font-black flex items-center gap-2 text-gray-900 dark:text-white"><Edit2 size={18} className="text-blue-500" /> Override Ledger Status</h2>
              <button onClick={() => setOverrideTarget(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><X size={16} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 pb-safe">
              <div className="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-neutral-800 mb-6">
                 <div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Employee</p>
                   <p className="text-sm font-black text-gray-900 dark:text-white">{overrideTarget.user.name}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ledger Date</p>
                   <p className="font-mono font-black text-blue-600 dark:text-blue-400">{new Date(overrideTarget.date).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</p>
                 </div>
              </div>

              <div className="mb-6">
                 <h3 className="text-[10px] font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Clock size={14} /> Recorded Punches for this date</h3>
                 <DailyPunchSummary dayData={overrideTarget.dayData} date={overrideTarget.date} />
              </div>

              {/* ── CURRENT OVERRIDE STATUS & HISTORY ── */}
              {(overrideTarget.dayData?.override || overrideHistory.length > 0) && (
                <div className="mb-6 pt-6 border-t border-gray-100 dark:border-neutral-900">
                   <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><History size={14} /> Override Audit Trail</h3>
                   
                   {/* Current Active Override Details */}
                   {overrideTarget.dayData?.override && (
                     <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 p-4 rounded-2xl mb-4">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Active Status: {overrideTarget.dayData.status}</span>
                          <span className="text-[10px] font-bold text-gray-500">By {overrideTarget.dayData.overridden_by || 'Admin'}</span>
                       </div>
                       <p className="text-sm font-bold text-gray-800 dark:text-neutral-200">{overrideTarget.dayData.override_reason || 'No reason provided.'}</p>
                     </div>
                   )}

                   {/* History Logs */}
                   {historyLoading ? (
                      <div className="flex items-center gap-2 text-gray-500 text-xs font-bold"><Loader2 className="animate-spin" size={14}/> Fetching history...</div>
                   ) : overrideHistory.length > 0 ? (
                      <div className="space-y-3 mt-2">
                        {overrideHistory.map(log => (
                           <div key={log.id} className="relative pl-4 border-l-2 border-gray-100 dark:border-neutral-800/80 ml-2 py-1">
                             <div className="absolute -left-[5px] top-[14px] w-2 h-2 rounded-full bg-blue-400 shadow-sm" />
                             <p className="text-xs font-bold text-gray-700 dark:text-neutral-300 leading-relaxed">{log.description}</p>
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">
                               {new Date(log.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} • By {log.actor_name || 'System'}
                             </p>
                           </div>
                        ))}
                      </div>
                   ) : null}
                </div>
              )}

              {/* OVERRIDE FORM */}
              <form onSubmit={handleOverrideSubmit} className="space-y-5 pt-6 border-t border-gray-100 dark:border-neutral-900">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">New Ledger Status</label>
                  <div className="relative">
                    <select value={overrideForm.status} onChange={e => setOverrideForm({...overrideForm, status: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer">
                      <option value="F">Full Day (F)</option>
                      <option value="H">Half Day (H)</option>
                      <option value="L">On Leave (L)</option>
                      <option value="PH">Paid Holiday (★)</option>
                      <option value="A">Absent (A)</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Reason (Required for Audit Log)</label>
                  <textarea required value={overrideForm.reason} onChange={e => setOverrideForm({...overrideForm, reason: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none h-20 custom-scrollbar" placeholder="e.g. System glitch, approved late entry..." />
                </div>

                <button type="submit" disabled={overrideSubmitting} className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50">
                  {overrideSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={2.5} />} 
                  Confirm Override
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: LEAVE ACTION (Approve/Reject)
      ══════════════════════════════════════════════════════════════════ */}
      {leaveActionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className={`bg-white dark:bg-[#0a0a0a] w-full max-w-sm rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col border ${leaveActionModal.action === 'approved' ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-red-200 dark:border-red-900/50'}`}>
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] rounded-t-3xl shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2">
                {leaveActionModal.action === 'approved' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-red-500" />}
                {leaveActionModal.action === 'approved' ? 'Approve Leave' : 'Reject Leave'}
              </h2>
              <button onClick={() => setLeaveActionModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><X size={16} /></button>
            </div>
            
            <form onSubmit={handleLeaveActionSubmit} className="p-5 space-y-5 pb-safe">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Optional Remarks for {leaveActionModal.req.name}</label>
                <textarea 
                  value={leaveRemark} 
                  onChange={e => setLeaveRemark(e.target.value)} 
                  className={`w-full bg-gray-50 dark:bg-[#111] rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none transition-all resize-none h-20 custom-scrollbar border ${leaveActionModal.action === 'approved' ? 'border-gray-300 dark:border-neutral-700 focus:ring-2 focus:ring-emerald-500/50' : 'border-gray-300 dark:border-neutral-700 focus:ring-2 focus:ring-red-500/50'}`} 
                  placeholder={leaveActionModal.action === 'approved' ? "e.g. Approved, enjoy your time off..." : "e.g. Rejected due to staff shortage..."} 
                />
              </div>

              <button 
                type="submit" 
                disabled={leaveActionSubmitting} 
                className={`w-full py-4 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 ${leaveActionModal.action === 'approved' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'}`}
              >
                {leaveActionSubmitting ? <Loader2 size={18} className="animate-spin" /> : (leaveActionModal.action === 'approved' ? <Check size={18} strokeWidth={2.5} /> : <XCircle size={18} strokeWidth={2.5} />)} 
                Confirm {leaveActionModal.action === 'approved' ? 'Approval' : 'Rejection'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function AttendanceLedgerPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><span className="animate-pulse font-bold text-gray-500">Loading Ledger...</span></div>}>
      <AttendanceLedgerContent />
    </Suspense>
  );
}