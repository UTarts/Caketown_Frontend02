"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Activity, Search, Loader2, Clock, CalendarDays,
  ChevronLeft, ChevronRight, CheckCircle2, Coffee,
  LogOut, LogIn, ArrowRight, X, AlertCircle, Shield,
  Briefcase, Edit2, Check, ChevronDown, History, Users
} from "lucide-react";

// ─── HELPERS ───────────────────────────────────────────────────────────────
const getLocalDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h > 0 ? `${h}h ` : ''}${m}m`;
};

const isStrictlySameDate = (isoString, viewDate) => {
  if (!isoString || !viewDate) return false;
  return isoString.startsWith(viewDate);
};

const getTargetHours = (person) => {
  const value = Number(person?.target_hours ?? person?.standard_shift_hours ?? 10);
  return Number.isFinite(value) && value > 0 ? value : 10;
};

const getPersonnelMeta = (person) => {
  const designation = person?.designation?.trim?.() || "";
  const department = person?.department?.trim?.() || "";

  if (designation && department) return `${designation} • ${department}`;
  if (designation) return designation;
  if (department) return department;
  return person?.role || "Standard";
};

export default function LiveFloorPage() {
  const searchParams = useSearchParams();
  const branch_id = searchParams.get("branch_id");

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveData, setLiveData] = useState([]);
  const [viewDate, setViewDate] = useState(getLocalDate());
  const [now, setNow] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Slide-out Inspector State
  const [inspectedUser, setInspectedUser] = useState(null);
  const [inspectorDate, setInspectorDate] = useState(getLocalDate());
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // Override State
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideForm, setOverrideForm] = useState({ status: "F", reason: "" });
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Global Clock Tick
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) return;
    try { setSession(JSON.parse(raw)); } catch {}
  }, []);

  const fetchLiveFloor = useCallback(async () => {
    if (!branch_id) return;
    setLoading(true);
    const res = await callApi("get_live_attendance", { branch_id, date: viewDate });
    if (res.status === "success") {
      setLiveData(res.data.all_people || []);
    }
    setLoading(false);
  }, [branch_id, viewDate]);

  useEffect(() => { fetchLiveFloor(); }, [fetchLiveFloor]);

  // Fetch specific user data when Inspector opens or its date changes
  useEffect(() => {
    if (!inspectedUser) return;
    const fetchInspectorData = async () => {
      setInspectorLoading(true);
      const res = await callApi("get_live_attendance", { branch_id, date: inspectorDate });
      if (res.status === "success") {
        const person = res.data.all_people?.find(p => String(p.id) === String(inspectedUser.id));
        setInspectorData(person || { ...inspectedUser, status: 'off_duty', punches: [], first_punch: null, last_punch: null });
      }
      setInspectorLoading(false);
    };
    fetchInspectorData();
  }, [inspectedUser?.id, inspectorDate, branch_id]);

  const handlePrevDay = () => {
    const d = new Date(viewDate); d.setDate(d.getDate() - 1);
    setViewDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    if (viewDate === getLocalDate()) return;
    const d = new Date(viewDate); d.setDate(d.getDate() + 1);
    setViewDate(d.toISOString().split('T')[0]);
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

    if (res.status === "success") {
      setOverrideTarget(null);
      fetchLiveFloor();
    } else {
      alert(res.message);
    }
  };

  // ─── DATA PROCESSING ───
  const processedRoster = useMemo(() => {
    return liveData.map(person => {
      const isToday = viewDate === getLocalDate();
      const isWorking = person.status === 'working';
      const isOnBreak = person.status === 'on_break';
      const isOffDuty = !isWorking && !isOnBreak;

      let workMins = 0;
      let breakMins = 0;
      let validPunches = [];

      if (person.punches && person.punches.length > 0) {
        validPunches = person.punches.filter(p => isStrictlySameDate(p, viewDate));
        if (validPunches.length > 0) {
          const renderPunches = [...validPunches].map(p => new Date(p).getTime());
          if (isWorking && isToday) renderPunches.push(now);

          for (let i = 0; i < renderPunches.length - 1; i++) {
            const duration = Math.floor((renderPunches[i + 1] - renderPunches[i]) / 60000);
            if (i % 2 === 0) workMins += duration;
            else breakMins += duration;
          }
        }
      }

      const strictFirst = validPunches.length > 0 ? validPunches[0] : null;
      const strictLast = validPunches.length > 0 ? validPunches[validPunches.length - 1] : null;

      const targetMins = getTargetHours(person) * 60;
      const progress = Math.min((workMins / targetMins) * 100, 100);

      return {
        ...person, strictFirst, strictLast, workMins, breakMins,
        targetMins, progress, validPunches, isToday, isWorking, isOnBreak, isOffDuty
      };
    }).filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.department?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'working' && !p.isWorking) return false;
      if (statusFilter === 'on_break' && !p.isOnBreak) return false;
      if (statusFilter === 'off_duty' && !p.isOffDuty) return false;
      return true;
    });
  }, [liveData, viewDate, now, searchQuery, statusFilter]);

  // Roster Stats
  const statFloor = liveData.filter(p => p.status === 'working').length;
  const statBreak = liveData.filter(p => p.status === 'on_break').length;
  const statTotal = liveData.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 text-gray-900 dark:text-neutral-200">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
            <Activity size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Branch Operations</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            Live Floor Command
            {viewDate === getLocalDate() && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>}
          </h1>
        </div>

        {/* Date Switcher */}
        <div className="flex items-center bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-1.5 shadow-sm">
          <button onClick={handlePrevDay} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-gray-500"><ChevronLeft size={18} /></button>
          <div className="flex items-center gap-2 px-4 py-1">
            <CalendarDays size={16} className="text-emerald-500" />
            <input type="date" value={viewDate} max={getLocalDate()} onChange={(e) => setViewDate(e.target.value)} className="bg-transparent text-sm font-black text-gray-900 dark:text-white outline-none cursor-pointer w-32 text-center" />
          </div>
          <button onClick={handleNextDay} disabled={viewDate === getLocalDate()} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-gray-500 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* ── FILTER BAR & STATS ────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-1.5 shadow-sm w-fit overflow-x-auto custom-scrollbar">
          {[
            { id: "all", label: "All Personnel", count: statTotal, color: "text-gray-600 dark:text-neutral-300" },
            { id: "working", label: "On Floor", count: statFloor, color: "text-emerald-600 dark:text-emerald-400" },
            { id: "on_break", label: "On Break", count: statBreak, color: "text-yellow-600 dark:text-yellow-400" },
            { id: "off_duty", label: "Off Duty / Absent", count: statTotal - statFloor - statBreak, color: "text-gray-500 dark:text-neutral-500" },
          ].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${statusFilter === f.id ? 'bg-gray-100 dark:bg-neutral-900 shadow-inner' : 'hover:bg-gray-50 dark:hover:bg-neutral-900/50 opacity-60 hover:opacity-100'}`}>
              <span className={f.color}>{f.label}</span>
              <span className={`px-2 py-0.5 rounded-md bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 ${f.color}`}>{f.count}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full xl:max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or department..."
            className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* ── TACTICAL ROSTER TABLE ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden min-h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
        ) : processedRoster.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center opacity-50">
            <Users size={40} className="mb-3 text-gray-400" />
            <p className="text-base font-black text-gray-900 dark:text-white">No personnel match criteria.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto custom-scrollbar pb-32">
            <table className="w-full text-left min-w-[1100px]">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-black border-b border-gray-100 dark:border-neutral-900 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="p-4 md:sticky md:left-0 z-10 bg-gray-50/95 dark:bg-black/95 backdrop-blur-sm shadow-[2px_0_8px_rgba(0,0,0,0.05)] border-r border-gray-100 dark:border-neutral-900">Personnel</th>
                  <th className="p-4 text-center">Target Hrs</th>
                  <th className="p-4 text-center">First In</th>
                  <th className="p-4 text-center">Last Out</th>
                  <th className="p-4 text-right">Work Time</th>
                  <th className="p-4 text-right">Break Time</th>
                  <th className="p-4 text-center border-l border-gray-100 dark:border-neutral-900">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                {processedRoster.map(person => (
                  <tr
                    key={person.id}
                    onClick={() => { setInspectedUser(person); setInspectorDate(viewDate); }}
                    className="hover:bg-gray-50/80 dark:hover:bg-neutral-900/50 group transition-colors cursor-pointer"
                  >
                    <td className="p-4 md:sticky md:left-0 z-10 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/80 dark:group-hover:bg-[#111] border-r border-gray-100 dark:border-neutral-900 shadow-[2px_0_8px_rgba(0,0,0,0.02)] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-500 flex items-center justify-center text-xs font-black shrink-0">
                          {person.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-sm text-gray-900 dark:text-white mb-0.5">{person.name}</p>
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                            <Briefcase size={10} /> {getPersonnelMeta(person)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono font-black text-xs text-gray-600 dark:text-neutral-400">{getTargetHours(person)}h</td>
                    <td className="p-4 text-center font-mono text-xs text-gray-700 dark:text-neutral-300">
                      {person.strictFirst ? <span className="flex items-center justify-center gap-1.5"><LogIn size={12} className="text-gray-400" /> {formatTime(person.strictFirst)}</span> : "—"}
                    </td>
                    <td className="p-4 text-center font-mono text-xs text-gray-700 dark:text-neutral-300">
                      {(person.isWorking && person.isToday) ? <span className="text-emerald-500 font-black text-[10px] uppercase tracking-widest animate-pulse">Active</span> : formatTime(person.strictLast)}
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">{formatDuration(person.workMins)}</p>
                      <div className="w-16 h-1 bg-gray-100 dark:bg-neutral-800 rounded-full mt-1.5 ml-auto overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${person.progress}%` }}></div>
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono font-black text-sm text-red-500 dark:text-red-400">{formatDuration(person.breakMins)}</td>

                    <td className="p-4 text-center border-l border-gray-100 dark:border-neutral-900">
                      {person.isToday ? (
                        person.isWorking ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> IN
                          </span>
                        ) : person.isOnBreak ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-[10px] font-black uppercase tracking-widest border border-yellow-200 dark:border-yellow-800/50 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> BREAK
                          </span>
                        ) : person.validPunches.length > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] font-black uppercase tracking-widest border border-gray-200 dark:border-neutral-800 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> OUT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-transparent text-gray-400 dark:text-neutral-600 text-[10px] font-black uppercase tracking-widest">
                            N/A
                          </span>
                        )
                      ) : (
                        person.validPunches.length > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] font-black uppercase tracking-widest border border-gray-200 dark:border-neutral-800 shadow-sm">
                            LOGGED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-transparent text-gray-400 dark:text-neutral-600 text-[10px] font-black uppercase tracking-widest">
                            ABSENT
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SLIDE-OUT INSPECTOR (RIGHT PANEL)
      ══════════════════════════════════════════════════════════════════ */}
      {inspectedUser && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity" onClick={() => setInspectedUser(null)}></div>

          <div className="fixed top-0 right-0 bottom-0 w-full md:w-[450px] bg-white dark:bg-[#050505] shadow-[-10px_0_40px_rgba(0,0,0,0.1)] z-50 flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-200 dark:border-neutral-800">

            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#0a0a0a] shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                    {inspectedUser.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight">{inspectedUser.name}</h2>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{getPersonnelMeta(inspectedUser)}</p>
                  </div>
                </div>
                <button onClick={() => setInspectedUser(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors"><X size={16} className="text-gray-600 dark:text-neutral-300" /></button>
              </div>

              <div className="flex items-center justify-between bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shadow-sm">
                <button onClick={() => {
                  const d = new Date(inspectorDate); d.setDate(d.getDate() - 1);
                  setInspectorDate(d.toISOString().split('T')[0]);
                }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-gray-500"><ChevronLeft size={16} /></button>

                <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500 flex items-center gap-1.5">
                  <CalendarDays size={14} /> {new Date(inspectorDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </span>

                <button onClick={() => {
                  if (inspectorDate === getLocalDate()) return;
                  const d = new Date(inspectorDate); d.setDate(d.getDate() + 1);
                  setInspectorDate(d.toISOString().split('T')[0]);
                }} disabled={inspectorDate === getLocalDate()} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-gray-500 disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white dark:bg-[#050505]">
              {inspectorLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
              ) : (
                (() => {
                  const isToday = inspectorDate === getLocalDate();
                  const isWorking = isToday && inspectorData?.status === 'working';
                  const isPastDate = inspectorDate < getLocalDate();

                  let workMins = 0;
                  let breakMins = 0;
                  const validPunches = (inspectorData?.punches || []).filter(p => isStrictlySameDate(p, inspectorDate));
                  const timelineEvents = [];

                  if (validPunches.length > 0) {
                    const renderPunches = [...validPunches].map(p => new Date(p).getTime());
                    if (isWorking) renderPunches.push(now);

                    for (let i = 0; i < renderPunches.length; i++) {
                      const isPunchIn = i % 2 === 0;
                      const timeStr = formatTime(renderPunches[i]);
                      const isLivePlaceholder = isWorking && i === renderPunches.length - 1;

                      timelineEvents.push({ time: timeStr, type: isPunchIn ? 'IN' : 'OUT', isLive: isLivePlaceholder });

                      if (i < renderPunches.length - 1) {
                        const duration = Math.floor((renderPunches[i + 1] - renderPunches[i]) / 60000);
                        if (isPunchIn) workMins += duration;
                        else breakMins += duration;
                      }
                    }
                  }

                  const targetMins = getTargetHours(inspectorData) * 60;
                  const remainingMins = Math.max(targetMins - workMins, 0);
                  const progress = Math.min((workMins / targetMins) * 100, 100);

                  // System Calculated Status Logic
                  let calculatedStatus = "Absent (A)";
                  let statusMarker = "A";
                  if (validPunches.length > 0) {
                    if (workMins >= targetMins - 30) {
                      calculatedStatus = "Full Day (F)";
                      statusMarker = "F";
                    } else if (workMins >= targetMins / 2) {
                      calculatedStatus = "Half Day (H)";
                      statusMarker = "H";
                    } else {
                      calculatedStatus = "Absent (A)";
                      statusMarker = "A";
                    }
                  }

                  return (
                    <div className="space-y-8 pb-safe">

                      {isPastDate && (
                        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">System Ledger Status</p>
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                              statusMarker === 'F' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' :
                              statusMarker === 'H' ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50' :
                              'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-800/50'
                            }`}>
                              {calculatedStatus}
                            </span>
                          </div>
                          <button onClick={() => {
                            setOverrideTarget({ user: inspectedUser, date: inspectorDate });
                            setOverrideForm({ status: statusMarker === 'F' ? 'F' : statusMarker, reason: "" });
                          }} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors">
                            <Edit2 size={12} /> Override
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 relative overflow-hidden">
                          {isWorking && <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>}
                          <p className="text-[10px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest mb-1">Work Time</p>
                          <p className="font-mono font-black text-2xl text-emerald-700 dark:text-emerald-400">{formatDuration(workMins)}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-4">
                          <p className="text-[10px] font-black text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Break Time</p>
                          <p className="font-mono font-black text-2xl text-red-700 dark:text-red-400">{formatDuration(breakMins)}</p>
                        </div>
                        <div className="col-span-2 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest mb-1">Shift Completion</p>
                            <p className="text-xs font-bold text-gray-900 dark:text-white"><span className="font-mono font-black">{formatDuration(remainingMins)}</span> remaining</p>
                          </div>
                          <div className="w-12 h-12 rounded-full border-4 border-gray-100 dark:border-neutral-800 flex items-center justify-center relative">
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500 transition-all duration-1000" style={{ clipPath: `polygon(0 0, 100% 0, 100% ${progress}%, 0 ${progress}%)` }}></div>
                            <span className="text-[10px] font-black relative z-10 text-gray-900 dark:text-white">{Math.round(progress)}%</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-900 pb-2"><History size={14} /> Chronological Log</h3>

                        {timelineEvents.length === 0 ? (
                          <div className="text-center py-10 opacity-50">
                            <Clock size={32} className="mx-auto text-gray-400 mb-3" />
                            <p className="text-sm font-bold text-gray-500">No punches recorded on this date.</p>
                          </div>
                        ) : (
                          <div className="relative pl-6 border-l-2 border-gray-100 dark:border-neutral-800 ml-3 space-y-8">
                            {timelineEvents.map((evt, idx) => {
                              const isPIn = evt.type === 'IN';
                              return (
                                <div key={idx} className="relative">
                                  <div className={`absolute -left-[33px] top-1 w-4 h-4 rounded-full ring-4 ring-white dark:ring-[#050505] shadow-sm flex items-center justify-center ${isPIn ? 'bg-emerald-500' : 'bg-red-500'} ${evt.isLive ? 'animate-pulse' : ''}`} />
                                  <div className="bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 rounded-xl p-3 shadow-sm inline-block min-w-[200px]">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className={`text-[10px] font-black uppercase tracking-widest ${isPIn ? 'text-emerald-600' : 'text-red-600'}`}>{evt.isLive ? 'Currently Active' : `Punched ${evt.type}`}</span>
                                      {evt.isLive && <Activity size={12} className="text-emerald-500 animate-pulse" />}
                                    </div>
                                    <p className="font-mono font-black text-lg text-gray-900 dark:text-white">{evt.isLive ? "In Progress" : evt.time}</p>
                                  </div>

                                  {idx < timelineEvents.length - 1 && (
                                    <div className="py-4 pl-2">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white dark:bg-[#050505] px-2 py-1 rounded-md border border-gray-100 dark:border-neutral-800">
                                        {isPIn ? "Working: " : "On Break: "}
                                        <span className={isPIn ? "text-emerald-500" : "text-red-500"}>
                                          {formatDuration(Math.floor((new Date(isStrictlySameDate(validPunches[idx + 1], inspectorDate) ? validPunches[idx + 1] : now).getTime() - new Date(validPunches[idx]).getTime()) / 60000))}
                                        </span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: OVERRIDE STATUS (PAST DATES ONLY)
      ══════════════════════════════════════════════════════════════════ */}
      {overrideTarget && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl shrink-0">
              <h2 className="text-base font-black flex items-center gap-2 text-gray-900 dark:text-white"><Edit2 size={18} className="text-emerald-500" /> Override Ledger Status</h2>
              <button onClick={() => setOverrideTarget(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><X size={16} /></button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="p-5 md:p-6 space-y-5 pb-safe">
              <div className="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-neutral-800">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Employee</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{overrideTarget.user.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ledger Date</p>
                  <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">{new Date(overrideTarget.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">New Ledger Status</label>
                <div className="relative">
                  <select value={overrideForm.status} onChange={e => setOverrideForm({ ...overrideForm, status: e.target.value })} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer">
                    <option value="F">Full Day (F)</option>
                    <option value="H">Half Day (H)</option>
                    <option value="L">On Leave (L)</option>
                    <option value="A">Absent (A)</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Reason (Required for Audit)</label>
                <textarea required value={overrideForm.reason} onChange={e => setOverrideForm({ ...overrideForm, reason: e.target.value })} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none h-20 custom-scrollbar" placeholder="e.g. System glitch, approved late entry..." />
              </div>

              <button type="submit" disabled={overrideSubmitting} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50">
                {overrideSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={2.5} />}
                Confirm Override
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}