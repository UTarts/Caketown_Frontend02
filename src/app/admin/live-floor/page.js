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

const pad = (n) => String(n).padStart(2, "0");

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

// designation only (department hidden per request, but still searchable in logic)
const getPersonnelMeta = (person) => {
  return person?.designation?.trim?.() || "—";
};

// ─── STATUS COLOR MAP ───────────────────────────────────────────────────────
const STATUS_MAP = {
  F:  { label: "F",  dot: "bg-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-400" },
  P:  { label: "F",  dot: "bg-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-400" },
  H:  { label: "H",  dot: "bg-yellow-400",  bg: "bg-yellow-100 dark:bg-yellow-500/20",   text: "text-yellow-700 dark:text-yellow-400",  ring: "ring-yellow-400" },
  A:  { label: "A",  dot: "bg-red-500",     bg: "bg-red-100 dark:bg-red-500/20",          text: "text-red-700 dark:text-red-400",         ring: "ring-red-400" },
  L:  { label: "L",  dot: "bg-blue-500",    bg: "bg-blue-100 dark:bg-blue-500/20",        text: "text-blue-700 dark:text-blue-400",       ring: "ring-blue-400" },
  PH: { label: "★",  dot: "bg-purple-500",  bg: "bg-purple-100 dark:bg-purple-500/20",   text: "text-purple-700 dark:text-purple-400",  ring: "ring-purple-400" },
  "-":{ label: "·",  dot: "bg-gray-300",    bg: "bg-transparent",                         text: "text-gray-300 dark:text-neutral-700",   ring: "" },
};

// ─── MINI MONTHLY CALENDAR — Refined with Outer Legend & Ring Selection ─────────────
export function MiniMonthCalendar({ monthData, calYear, calMonth, selectedDate, onDayClick, onPrevMonth, onNextMonth }) {
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
  
  const todayStr = getLocalDate(); 
  const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const STATUS_COLORS = {
    F: "bg-emerald-500", P: "bg-emerald-500",
    H: "bg-amber-500",
    A: "bg-rose-600",
    L: "bg-sky-500",
    PH: "bg-purple-600",
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[300px] mx-auto">
      <div className="w-full bg-white dark:bg-[#080808] rounded-[24px] p-4 shadow-xl shadow-black/10 border border-black/5 dark:border-white/5 select-none">
        <div className="flex items-center justify-between mb-4 px-2">
          <button onClick={onPrevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          <span className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 tracking-wider uppercase">
            {new Date(calYear, calMonth - 1).toLocaleString("en-IN", { month: "short" })} {calYear}
          </span>
          <button onClick={onNextMonth} disabled={`${calYear}-${pad(calMonth)}` >= todayStr.slice(0, 7)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed">
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-2.5">
          {DAY_LABELS.map((d, i) => (
            <div key={`header-${i}`} className={`text-center text-[10px] font-bold pb-2 ${i === 0 ? "text-rose-500/90" : "text-neutral-400 dark:text-neutral-600"}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 place-items-center">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="w-8 h-8" />;
            const col = idx % 7;
            const isSunday = col === 0;
            const dateStr = `${calYear}-${pad(calMonth)}-${pad(day)}`;
            const isFuture = dateStr > todayStr;
            const isToday = dateStr === todayStr;
            const isSel = dateStr === selectedDate;
            let rawStatus = monthData?.[dateStr]?.status ?? monthData?.[dateStr] ?? null;
            if (isFuture && !monthData?.[dateStr]?.override) rawStatus = null;
            if (rawStatus === "P") rawStatus = "F";
            const statusColor = rawStatus ? STATUS_COLORS[rawStatus] : null;

            return (
              <button key={dateStr} onClick={() => !isFuture && onDayClick(dateStr)} disabled={isFuture} className={`
                  relative w-8 h-8 flex items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-200
                  ${isFuture ? "opacity-25 cursor-not-allowed" : "cursor-pointer active:scale-90 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"}
                  ${statusColor ? `${statusColor} text-white` : "text-neutral-800 dark:text-neutral-200"} 
                  ${isToday 
                    ? "ring-2 ring-emerald-500 animate-pulse z-10" 
                    : isSel 
                      ? "ring-2 ring-neutral-900 dark:ring-neutral-100 ring-offset-2 dark:ring-offset-[#080808] font-bold z-10" 
                      : isSunday && !statusColor 
                        ? "text-rose-600/95 dark:text-rose-500/95" 
                        : ""
                  }
                `}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-nowrap items-center justify-center gap-2.5 w-full px-1">
        {[
          { dot: "bg-emerald-500", label: "Full" }, { dot: "bg-amber-500",  label: "Half" },
          { dot: "bg-rose-600",   label: "Absent" }, { dot: "bg-sky-500",    label: "Leave" },
          { dot: "bg-purple-600", label: "Holiday" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${l.dot} shrink-0`} />
            <span className="text-[9px] font-bold text-neutral-500 dark:text-neutral-400 tracking-wide uppercase">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LiveFloorPage() {
  const searchParams = useSearchParams();
  const branch_id    = searchParams.get("branch_id");

  const [session,       setSession]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [liveData,      setLiveData]      = useState([]);
  const [viewDate,      setViewDate]      = useState(getLocalDate());
  const [now,           setNow]           = useState(Date.now());
  const [searchQuery,   setSearchQuery]   = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");

  // Track table scroll for sticky column contraction
  const [isTableScrolled, setIsTableScrolled] = useState(false);

  // Inspector state
  const [inspectedUser,   setInspectedUser]   = useState(null);
  const [inspectorDate,   setInspectorDate]   = useState(getLocalDate());
  const [inspectorData,   setInspectorData]   = useState(null);
  const [inspectorLoading,setInspectorLoading]= useState(false);

  // Monthly calendar state
  const [calYear,          setCalYear]         = useState(new Date().getFullYear());
  const [calMonth,         setCalMonth]        = useState(new Date().getMonth() + 1);
  const [monthData,        setMonthData]       = useState(null);
  const [monthDataLoading, setMonthDataLoading]= useState(false);

  // Override state
  const [overrideTarget,     setOverrideTarget]     = useState(null);
  const [overrideForm,       setOverrideForm]       = useState({ status: "F", reason: "" });
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Global clock tick
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
    if (res.status === "success") setLiveData(res.data.all_people || []);
    setLoading(false);
  }, [branch_id, viewDate]);

  useEffect(() => { fetchLiveFloor(); }, [fetchLiveFloor]);

  // Fetch single-day inspector data
  useEffect(() => {
    if (!inspectedUser) return;
    const fetch = async () => {
      setInspectorLoading(true);
      const res = await callApi("get_live_attendance", { branch_id, date: inspectorDate });
      if (res.status === "success") {
        const person = res.data.all_people?.find(p => String(p.id) === String(inspectedUser.id));
        setInspectorData(person || { ...inspectedUser, status: "off_duty", punches: [], first_punch: null, last_punch: null });
      }
      setInspectorLoading(false);
    };
    fetch();
  }, [inspectedUser?.id, inspectorDate, branch_id]);

  // Fetch monthly data for mini calendar
  useEffect(() => {
    if (!inspectedUser || !branch_id) return;
    const fetch = async () => {
      setMonthDataLoading(true);
      const res = await callApi("get_monthly_attendance", { branch_id, month: calMonth, year: calYear });
      if (res.status === "success") {
        const userRow = (res.data || []).find(r => String(r.id) === String(inspectedUser.id));
        setMonthData(userRow?.days || null);
      } else {
        setMonthData(null);
      }
      setMonthDataLoading(false);
    };
    fetch();
  }, [inspectedUser?.id, calYear, calMonth, branch_id]);

  // When inspector opens, sync calendar to viewDate's month
  useEffect(() => {
    if (inspectedUser) {
      const d = new Date(viewDate);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth() + 1);
      setInspectorDate(viewDate);
    }
  }, [inspectedUser?.id]);

  // Main page date controls
  const handlePrevDay = () => {
    const d = new Date(viewDate); d.setDate(d.getDate() - 1);
    setViewDate(d.toISOString().split("T")[0]);
  };
  const handleNextDay = () => {
    if (viewDate === getLocalDate()) return;
    const d = new Date(viewDate); d.setDate(d.getDate() + 1);
    setViewDate(d.toISOString().split("T")[0]);
  };

  // Calendar month controls
  const handleCalPrevMonth = () => {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  };
  const handleCalNextMonth = () => {
    const todayStr   = getLocalDate();
    const currentYM  = `${calYear}-${pad(calMonth)}`;
    if (currentYM >= todayStr.slice(0, 7)) return;
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    setOverrideSubmitting(true);
    const res = await callApi("set_attendance_override", {
      user_id:  overrideTarget.user.id,
      date:     overrideTarget.date,
      status:   overrideForm.status,
      reason:   overrideForm.reason,
      admin_id: session?.id
    });
    setOverrideSubmitting(false);
    if (res.status === "success") { setOverrideTarget(null); fetchLiveFloor(); }
    else alert(res.message);
  };

  const handleTableScroll = (e) => {
    setIsTableScrolled(e.target.scrollLeft > 10);
  };

  // ─── DATA PROCESSING ────────────────────────────────────────────────────
  const processedRoster = useMemo(() => {
    return liveData.map(person => {
      const isToday   = viewDate === getLocalDate();
      const isWorking = person.status === "working";
      const isOnBreak = person.status === "on_break";
      const isOffDuty = !isWorking && !isOnBreak;

      let workMins = 0, breakMins = 0;
      let validPunches = (person.punches || []).filter(p => isStrictlySameDate(p, viewDate));

      if (validPunches.length > 0) {
        const renderPunches = [...validPunches].map(p => new Date(p).getTime());
        if (isWorking && isToday) renderPunches.push(now);
        for (let i = 0; i < renderPunches.length - 1; i++) {
          const dur = Math.floor((renderPunches[i + 1] - renderPunches[i]) / 60000);
          if (i % 2 === 0) workMins  += dur;
          else             breakMins += dur;
        }
      }

      const strictFirst = validPunches.length > 0 ? validPunches[0] : null;
      const strictLast  = validPunches.length > 0 ? validPunches[validPunches.length - 1] : null;
      const targetMins  = getTargetHours(person) * 60;
      const progress    = Math.min((workMins / targetMins) * 100, 100);

      return { ...person, strictFirst, strictLast, workMins, breakMins, targetMins, progress, validPunches, isToday, isWorking, isOnBreak, isOffDuty };
    }).filter(p => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = p.name?.toLowerCase().includes(q) || p.department?.toLowerCase().includes(q) || p.designation?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (statusFilter === "working"  && !p.isWorking)  return false;
      if (statusFilter === "on_break" && !p.isOnBreak)  return false;
      if (statusFilter === "off_duty" && !p.isOffDuty)  return false;
      return true;
    });
  }, [liveData, viewDate, now, searchQuery, statusFilter]);

  const statFloor = liveData.filter(p => p.status === "working").length;
  const statBreak = liveData.filter(p => p.status === "on_break").length;
  const statTotal = liveData.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 text-gray-900 dark:text-neutral-200">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
            <Activity size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Branch Operations</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            Live Floor Command
            {viewDate === getLocalDate() && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </h1>
        </div>

        {/* Date Switcher */}
        <div className="flex items-center bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-1.5 shadow-sm">
          <button onClick={handlePrevDay} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-gray-500"><ChevronLeft size={18} /></button>
          <div className="flex items-center gap-2 px-4 py-1">
            <CalendarDays size={16} className="text-emerald-500" />
            <input
              type="date" value={viewDate} max={getLocalDate()}
              onChange={(e) => setViewDate(e.target.value)}
              className="bg-transparent text-sm font-black text-gray-900 dark:text-white outline-none cursor-pointer w-32 text-center"
            />
          </div>
          <button onClick={handleNextDay} disabled={viewDate === getLocalDate()} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors text-gray-500 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-1.5 shadow-sm w-fit overflow-x-auto custom-scrollbar">
          {[
            { id: "all",      label: "All Personnel",     count: statTotal,                         color: "text-gray-600 dark:text-neutral-300" },
            { id: "working",  label: "On Floor",          count: statFloor,                         color: "text-emerald-600 dark:text-emerald-400" },
            { id: "on_break", label: "On Break",          count: statBreak,                         color: "text-yellow-600 dark:text-yellow-400" },
            { id: "off_duty", label: "Off Duty / Absent", count: statTotal - statFloor - statBreak, color: "text-gray-500 dark:text-neutral-500" },
          ].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap
                ${statusFilter === f.id ? "bg-gray-100 dark:bg-neutral-900 shadow-inner" : "hover:bg-gray-50 dark:hover:bg-neutral-900/50 opacity-60 hover:opacity-100"}`}>
              <span className={f.color}>{f.label}</span>
              <span className={`px-2 py-0.5 rounded-md bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 ${f.color}`}>{f.count}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full xl:max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, department or designation..."
            className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* ── ROSTER TABLE ── */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl shadow-sm overflow-hidden min-h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
        ) : processedRoster.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center opacity-50">
            <Users size={40} className="mb-3 text-gray-400" />
            <p className="text-base font-black text-gray-900 dark:text-white">No personnel match criteria.</p>
          </div>
        ) : (
          <div className="w-full h-full max-h-[70vh] overflow-auto custom-scrollbar pb-16" onScroll={handleTableScroll}>
            <table className="w-full text-left min-w-[700px] border-collapse border border-gray-300 dark:border-neutral-700">
              <thead className="sticky top-0 z-30 shadow-md">
                <tr className="bg-gray-100 dark:bg-neutral-900 border-b-2 border-gray-300 dark:border-neutral-700 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  <th className={`px-3 py-2.5 sticky left-0 z-40 bg-gray-100 dark:bg-neutral-900 border-r-2 border-gray-300 dark:border-neutral-700 transition-all duration-300 ${isTableScrolled ? 'w-12 min-w-[3rem]' : 'w-48 min-w-[12rem]'}`}>
                    {isTableScrolled ? 'Name' : 'Personnel'}
                  </th>
                  <th className="px-3 py-2.5 text-center border-r border-gray-300 dark:border-neutral-700">Target Hrs</th>
                  <th className="px-3 py-2.5 text-center border-r border-gray-300 dark:border-neutral-700">First In</th>
                  <th className="px-3 py-2.5 text-center border-r border-gray-300 dark:border-neutral-700">Last Out</th>
                  <th className="px-3 py-2.5 text-right border-r border-gray-300 dark:border-neutral-700">Work Time</th>
                  <th className="px-3 py-2.5 text-right border-r border-gray-300 dark:border-neutral-700">Break Time</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 dark:divide-neutral-700 border-b border-gray-300 dark:border-neutral-700">
                {processedRoster.map(person => (
                  <tr key={person.id} onClick={() => { setInspectedUser(person); setInspectorDate(viewDate); }}
                    className="hover:bg-gray-50 dark:hover:bg-[#111] group transition-colors cursor-pointer">
                    <td className={`px-3 py-2 sticky left-0 z-20 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50 dark:group-hover:bg-[#111] border-r-2 border-gray-300 dark:border-neutral-700 shadow-[2px_0_8px_rgba(0,0,0,0.02)] transition-all duration-300 ${isTableScrolled ? 'w-12 min-w-[3rem]' : 'w-48 min-w-[12rem]'}`}>
                      {isTableScrolled ? (
                        <div className="text-[10px] font-black text-gray-900 dark:text-white truncate text-center w-full">
                          {person.name.split(' ')[0]}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-500 flex items-center justify-center text-[10px] font-black shrink-0">
                            {person.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-sm text-gray-900 dark:text-white truncate">{person.name}</p>
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1 mt-0.5 truncate">
                              <Briefcase size={9} className="shrink-0" />
                              {getPersonnelMeta(person)}
                            </p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-black text-xs text-gray-600 dark:text-neutral-400 border-r border-gray-300 dark:border-neutral-700">{getTargetHours(person)}h</td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-gray-700 dark:text-neutral-300 border-r border-gray-300 dark:border-neutral-700">
                      {person.strictFirst
                        ? <span className="flex items-center justify-center gap-1.5"><LogIn size={12} className="text-gray-400" /> {formatTime(person.strictFirst)}</span>
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-gray-700 dark:text-neutral-300 border-r border-gray-300 dark:border-neutral-700">
                      {(person.isWorking && person.isToday)
                        ? <span className="text-emerald-500 font-black text-[10px] uppercase tracking-widest animate-pulse">Active</span>
                        : formatTime(person.strictLast)}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-gray-300 dark:border-neutral-700">
                      <p className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">{formatDuration(person.workMins)}</p>
                      <div className="w-16 h-1 bg-gray-200 dark:bg-neutral-800 rounded-full mt-1.5 ml-auto overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${person.progress}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-black text-sm text-red-500 dark:text-red-400 border-r border-gray-300 dark:border-neutral-700">{formatDuration(person.breakMins)}</td>
                    <td className="px-3 py-2 text-center">
                      {person.isToday ? (
                        person.isWorking ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-300 dark:border-emerald-800/50 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> IN
                          </span>
                        ) : person.isOnBreak ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-[10px] font-black uppercase tracking-widest border border-yellow-300 dark:border-yellow-800/50 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> BREAK
                          </span>
                        ) : person.validPunches.length > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] font-black uppercase tracking-widest border border-gray-300 dark:border-neutral-700 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> OUT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-transparent text-gray-400 dark:text-neutral-600 text-[10px] font-black uppercase tracking-widest">N/A</span>
                        )
                      ) : (
                        person.validPunches.length > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-[10px] font-black uppercase tracking-widest border border-gray-300 dark:border-neutral-700 shadow-sm">LOGGED</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-transparent text-gray-400 dark:text-neutral-600 text-[10px] font-black uppercase tracking-widest">ABSENT</span>
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

      {/* ══════════════════════════════════════════════════════════════
          SLIDE-OUT INSPECTOR
      ══════════════════════════════════════════════════════════════ */}
      {inspectedUser && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[50] transition-opacity" onClick={() => setInspectedUser(null)} />

          {/* Modal Panel - Notice the top-16 md:top-0 added here */}
          <div className="fixed top-16 md:top-0 right-0 bottom-0 w-full md:w-[440px] bg-white dark:bg-[#050505] shadow-[-10px_0_40px_rgba(0,0,0,0.1)] z-[60] flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-200 dark:border-neutral-800">

            {/* ── Inspector Header ── */}
            <div className="p-4 md:p-5 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#0a0a0a] shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm shrink-0">
                    {inspectedUser.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base md:text-lg font-black text-gray-900 dark:text-white leading-tight truncate">{inspectedUser.name}</h2>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{getPersonnelMeta(inspectedUser)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setInspectedUser(null)}
                  className="flex-shrink-0 ml-2 p-2.5 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                >
                  <X size={16} className="text-gray-600 dark:text-neutral-300" />
                </button>
              </div>
            </div>

            {/* ── Inspector Body ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-[#050505]">
              <div className="p-4 md:p-5 space-y-4 pb-32 md:pb-8">
                {monthDataLoading ? (
                  <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-center h-20">
                    <Loader2 size={18} className="animate-spin text-emerald-500" />
                  </div>
                ) : (
                  <MiniMonthCalendar
                    monthData={monthData}
                    calYear={calYear}
                    calMonth={calMonth}
                    selectedDate={inspectorDate}
                    onDayClick={(dateStr) => {
                      setInspectorDate(dateStr);
                      const d = new Date(dateStr);
                      setCalYear(d.getFullYear());
                      setCalMonth(d.getMonth() + 1);
                    }}
                    onPrevMonth={handleCalPrevMonth}
                    onNextMonth={handleCalNextMonth}
                  />
                )}

                {/* ── DAILY DETAIL for selected date ── */}
                {inspectorLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
                ) : (
                  (() => {
                    const isToday    = inspectorDate === getLocalDate();
                    const isWorking  = isToday && inspectorData?.status === "working";
                    const isPastDate = inspectorDate < getLocalDate();

                    let workMins = 0, breakMins = 0;
                    const validPunches   = (inspectorData?.punches || []).filter(p => isStrictlySameDate(p, inspectorDate));
                    const timelineEvents = [];

                    if (validPunches.length > 0) {
                      const renderPunches = [...validPunches].map(p => new Date(p).getTime());
                      if (isWorking) renderPunches.push(now);

                      for (let i = 0; i < renderPunches.length; i++) {
                        const isPunchIn         = i % 2 === 0;
                        const timeStr           = formatTime(renderPunches[i]);
                        const isLivePlaceholder = isWorking && i === renderPunches.length - 1;
                        timelineEvents.push({ time: timeStr, type: isPunchIn ? "IN" : "OUT", isLive: isLivePlaceholder });
                        if (i < renderPunches.length - 1) {
                          const dur = Math.floor((renderPunches[i + 1] - renderPunches[i]) / 60000);
                          if (isPunchIn) workMins  += dur;
                          else           breakMins += dur;
                        }
                      }
                    }

                    const targetMins    = getTargetHours(inspectorData || inspectedUser) * 60;
                    const remainingMins = Math.max(targetMins - workMins, 0);
                    const progress      = Math.min((workMins / targetMins) * 100, 100);

                    let calculatedStatus = "Absent (A)", statusMarker = "A";
                    if (validPunches.length > 0) {
                      if      (workMins >= targetMins - 30)     { calculatedStatus = "Full Day (F)"; statusMarker = "F"; }
                      else if (workMins >= targetMins / 2)      { calculatedStatus = "Half Day (H)"; statusMarker = "H"; }
                      else                                       { calculatedStatus = "Absent (A)";  statusMarker = "A"; }
                    }

                    return (
                      <div className="space-y-4 pb-8">
                        <div className="flex items-center gap-2 px-1">
                          <CalendarDays size={13} className="text-emerald-500 shrink-0" />
                          <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">
                            {new Date(inspectorDate).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>

                        {isPastDate && (
                          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">System Ledger Status</p>
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest
                                ${statusMarker === "F" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                                : statusMarker === "H" ? "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800/50"
                                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-800/50"}`}>
                                {calculatedStatus}
                              </span>
                            </div>
                            <button
                              onClick={() => { setOverrideTarget({ user: inspectedUser, date: inspectorDate }); setOverrideForm({ status: statusMarker, reason: "" }); }}
                              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors min-h-[36px]"
                            >
                              <Edit2 size={12} /> Override
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 relative overflow-hidden">
                            {isWorking && <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />}
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
                              <p className="text-xs font-bold text-gray-900 dark:text-white">
                                <span className="font-mono font-black">{formatDuration(remainingMins)}</span> remaining
                              </p>
                            </div>
                            <div className="w-12 h-12 rounded-full border-4 border-gray-100 dark:border-neutral-800 flex items-center justify-center relative overflow-hidden">
                              <div className="absolute inset-0 rounded-full border-4 border-blue-500 transition-all duration-1000" style={{ clipPath: `polygon(0 0, 100% 0, 100% ${progress}%, 0 ${progress}%)` }} />
                              <span className="text-[10px] font-black relative z-10 text-gray-900 dark:text-white">{Math.round(progress)}%</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2 border-b border-gray-100 dark:border-neutral-900 pb-2">
                            <History size={14} /> Chronological Log
                          </h3>
                          {timelineEvents.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                              <Clock size={32} className="mx-auto text-gray-400 mb-3" />
                              <p className="text-sm font-bold text-gray-500">No punches recorded on this date.</p>
                            </div>
                          ) : (
                            <div className="relative pl-6 border-l-2 border-gray-100 dark:border-neutral-800 ml-3 space-y-8">
                              {timelineEvents.map((evt, idx) => {
                                const isPIn = evt.type === "IN";
                                return (
                                  <div key={idx} className="relative">
                                    <div className={`absolute -left-[33px] top-1 w-4 h-4 rounded-full ring-4 ring-white dark:ring-[#050505] shadow-sm flex items-center justify-center ${isPIn ? "bg-emerald-500" : "bg-red-500"} ${evt.isLive ? "animate-pulse" : ""}`} />
                                    <div className="bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 rounded-xl p-3 shadow-sm inline-block min-w-[180px] max-w-full">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isPIn ? "text-emerald-600" : "text-red-600"}`}>
                                          {evt.isLive ? "Currently Active" : `Punched ${evt.type}`}
                                        </span>
                                        {evt.isLive && <Activity size={12} className="text-emerald-500 animate-pulse" />}
                                      </div>
                                      <p className="font-mono font-black text-lg text-gray-900 dark:text-white">{evt.isLive ? "In Progress" : evt.time}</p>
                                    </div>
                                    {idx < timelineEvents.length - 1 && (
                                      <div className="py-4 pl-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white dark:bg-[#050505] px-2 py-1 rounded-md border border-gray-100 dark:border-neutral-800">
                                          {isPIn ? "Working: " : "On Break: "}
                                          <span className={isPIn ? "text-emerald-500" : "text-red-500"}>
                                            {formatDuration(Math.floor((
                                              new Date(isStrictlySameDate(validPunches[idx + 1], inspectorDate) ? validPunches[idx + 1] : now).getTime() -
                                              new Date(validPunches[idx]).getTime()
                                            ) / 60000))}
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
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: OVERRIDE STATUS
      ══════════════════════════════════════════════════════════════ */}
      {overrideTarget && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl shrink-0 relative">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-300 dark:bg-neutral-700 rounded-full md:hidden" />
              <h2 className="text-base font-black flex items-center gap-2 text-gray-900 dark:text-white mt-2 md:mt-0">
                <Edit2 size={18} className="text-emerald-500" /> Override Ledger Status
              </h2>
              <button onClick={() => setOverrideTarget(null)}
                className="p-2.5 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400 min-w-[40px] min-h-[40px] flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit} className="p-5 md:p-6 space-y-5 pb-safe">
              <div className="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-neutral-800">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Employee</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{overrideTarget.user.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ledger Date</p>
                  <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {new Date(overrideTarget.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">New Ledger Status</label>
                <div className="relative">
                  <select value={overrideForm.status} onChange={e => setOverrideForm({ ...overrideForm, status: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer min-h-[52px]">
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
                <textarea required value={overrideForm.reason} onChange={e => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none h-20 custom-scrollbar"
                  placeholder="e.g. System glitch, approved late entry..." />
              </div>

              <button type="submit" disabled={overrideSubmitting}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50 min-h-[52px]">
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