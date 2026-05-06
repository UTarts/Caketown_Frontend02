"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { callApi, logout } from "@/lib/apiClient";
import {
  Banknote, CalendarDays, Clock3, FileText, Loader2, UserCircle2,
  CheckCircle2, XCircle, LayoutDashboard, History, Download, LogOut, 
  Activity, Sparkles, MapPin, Sun, Moon
} from "lucide-react";

// ─── HELPERS ───────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}h ${m}m`;
}

function AttendanceMarker({ status }) {
  const map = {
    F:  { label: "P",  bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400" },
    P:  { label: "P",  bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400" },
    H:  { label: "H",  bg: "bg-yellow-100 dark:bg-yellow-500/20",   text: "text-yellow-700 dark:text-yellow-400" },
    A:  { label: "A",  bg: "bg-red-100 dark:bg-red-500/20",         text: "text-red-700 dark:text-red-400" },
    "-":{ label: "–",  bg: "bg-transparent",                        text: "text-gray-300 dark:text-neutral-700" },
  };
  const m = map[status] || map["-"];
  return <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black transition-colors ${m.bg} ${m.text}`}>{m.label}</span>;
}

// ─── MAIN PORTAL ───────────────────────────────────────────────────────────
export default function StaffPortalPage() {
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [dark, setDark] = useState(false);

  // Data States
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [finance, setFinance] = useState(null);
  
  // Date Scopes
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [downloadingId, setDownloadingId] = useState(false);

  // Theme Init
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  // Auth Init
  useEffect(() => {
    try {
      const raw = localStorage.getItem("caketown_session");
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || (parsed.role !== "staff" && parsed.role !== "manager")) {
        router.push("/"); return;
      }
      setSession(parsed);
    } catch {
      router.push("/");
    }
  }, [router]);

  const fetchPortalData = useCallback(async () => {
    if (!session?.id) return;
    setLoading(true);

    try {
      const [profRes, attRes, finRes] = await Promise.all([
        callApi("get_my_profile", { user_id: session.id }),
        callApi("get_my_attendance", { user_id: session.id, month: selMonth, year: selYear }),
        callApi("get_my_financials", { user_id: session.id, month: selMonth, year: selYear })
      ]);

      if (profRes.status === "success") setProfile(profRes.data);
      if (attRes.status === "success") setAttendance(attRes.data || []);
      if (finRes.status === "success") setFinance(finRes.data);
    } catch (err) {
      console.error("Portal sync error:", err);
    } finally {
      setLoading(false);
    }
  }, [session, selMonth, selYear]);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  const handleDownloadSlip = async () => {
    setDownloadingId(true);
    const res = await callApi("download_salary_slip", { user_id: session.id, month: selMonth, year: selYear });
    if (res.status === "success" && res.url) window.open(res.url, "_blank");
    else alert(res.message || "Failed to generate salary slip PDF.");
    setDownloadingId(false);
  };

  if (!session || loading && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#050505]">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Loading Workspace...</p>
      </div>
    );
  }

  const navItems = [
    { id: "home", label: "Dashboard", icon: LayoutDashboard },
    { id: "attendance", label: "Attendance", icon: CalendarDays },
    { id: "finance", label: "Finance", icon: Banknote },
    { id: "profile", label: "Profile", icon: UserCircle2 },
  ];

  const initials = profile?.name?.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "S";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-neutral-200 font-sans pb-24 md:pb-10 selection:bg-emerald-500 selection:text-white">
      
      {/* ── MOBILE TOP HEADER (With Diagonal Logo) ─────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-neutral-800 h-16 flex items-center justify-between shadow-sm">
        {/* White Diagonal Logo Container */}
        <div className="absolute top-0 left-0 h-16 w-40 bg-white shadow-[2px_0_10px_rgba(0,0,0,0.1)] z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>
          {/* REPLACE SRC WITH YOUR LOGO PATH */}
          <img src="/logo.png" alt="Caketown" className="w-full h-full object-contain p-2 pr-6" />
        </div>
        
        <div className="flex-1"></div> {/* Spacer */}
        
        <button onClick={toggleTheme} className="p-2.5 mr-4 rounded-full bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors z-20">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* ── DESKTOP TOP NAV (With Diagonal Logo) ───────────────────────── */}
      <nav className="hidden md:flex sticky top-0 z-50 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-gray-200 dark:border-neutral-800 h-20 items-center justify-between pl-0 pr-8">
        
        {/* White Diagonal Logo Container */}
        <div className="h-20 w-64 bg-white shadow-[2px_0_15px_rgba(0,0,0,0.05)] relative z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>
           {/* REPLACE SRC WITH YOUR LOGO PATH */}
           <img src="/logo.png" alt="Caketown" className="w-full h-full object-contain p-3 pr-8" />
        </div>

        <div className="flex gap-2">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === item.id ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-900'}`}>
              <span className="flex items-center gap-2"><item.icon size={16} /> {item.label}</span>
            </button>
          ))}
          <button onClick={toggleTheme} className="ml-4 p-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      {/* ── MAIN CONTENT AREA ──────────────────────────────────────────── */}
      <main className="max-w-[1200px] mx-auto p-4 md:p-8 pt-20 md:pt-8 animate-in fade-in duration-500">

        {/* ═══════════════════════════════════════════════════════════════
            TAB: HOME / DASHBOARD
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "home" && (
          <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* HERO SECTION */}
            <div className="relative bg-white/60 dark:bg-[#0a0a0a]/60 backdrop-blur-2xl border border-gray-200/60 dark:border-neutral-800/60 rounded-[2rem] p-6 md:p-10 shadow-sm overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              
              <div className="flex items-center gap-5 relative z-10">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl font-black shadow-lg shadow-emerald-500/10 border-2 border-white dark:border-neutral-800 shrink-0">
                  {initials}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-emerald-500" />
                    <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase text-emerald-600 dark:text-emerald-500">Welcome Back</span>
                  </div>
                  <h1 className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
                    {profile?.name}
                  </h1>
                  <span className="px-3 py-1 bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-xs font-bold rounded-lg uppercase tracking-wider inline-flex items-center gap-1.5">
                    <MapPin size={12} /> {profile?.branch_name || "Unassigned"}
                  </span>
                </div>
              </div>
            </div>

            {/* QUICK STATS */}
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mt-8 mb-4">Current Month Snapshot</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Total Duty</p>
                  <Activity size={16} className="text-emerald-500" />
                </div>
                <p className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{finance?.present || 0}</p>
              </div>
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Paid Leaves</p>
                  <CalendarDays size={16} className="text-blue-500" />
                </div>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{finance?.paid_leaves || 0}</p>
              </div>
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Advances</p>
                  <Clock3 size={16} className="text-orange-500" />
                </div>
                <p className="text-2xl font-black text-orange-600 dark:text-orange-400 tabular-nums">₹{parseFloat(finance?.total_advance || 0).toLocaleString("en-IN")}</p>
              </div>
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Net Payable</p>
                  <Banknote size={16} className="text-emerald-500" />
                </div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">₹{parseFloat(finance?.salary_to_pay || 0).toLocaleString("en-IN")}</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: ATTENDANCE HISTORY
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "attendance" && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap gap-2.5 items-center bg-white dark:bg-[#0a0a0a] p-2.5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm w-fit">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2">
                <CalendarDays size={14} className="text-emerald-500" />
                <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                  {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
                </select>
              </div>
              <select value={selYear} onChange={e => setSelYear(parseInt(e.target.value))} className="bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2 text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={fetchPortalData} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-black rounded-xl hover:bg-gray-800 active:scale-95 transition-all">Load</button>
            </div>

            {loading ? (
              <div className="flex justify-center py-24"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : attendance.length === 0 ? (
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-16 text-center">
                <CalendarDays size={40} className="text-gray-300 dark:text-neutral-700 mx-auto mb-4" />
                <p className="text-base font-black text-gray-900 dark:text-white">No Records Found</p>
                <p className="text-sm font-bold text-gray-500 mt-1">No attendance data for this month.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attendance.map((item, i) => {
                  const d = new Date(item.work_date || item.date);
                  return (
                    <div key={i} className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-colors">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 dark:border-neutral-900">
                        <div>
                          <p className="font-black text-lg text-gray-900 dark:text-white">{pad(d.getDate())}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.toLocaleDateString("en-IN", { month: "short", weekday: "long" })}</p>
                        </div>
                        <AttendanceMarker status={item.status === "F" ? "P" : item.status} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">First In</p>
                          <p className="font-mono font-black text-gray-900 dark:text-white">{item.first_in ? new Date(item.first_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Last Out</p>
                          <p className="font-mono font-black text-gray-900 dark:text-white">{item.last_out ? new Date(item.last_out).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Work Time</p>
                          <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">{item.work_time ? formatDuration(item.work_time * 60) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Break Time</p>
                          <p className="font-mono font-black text-yellow-600 dark:text-yellow-500">{item.break_time ? formatDuration(item.break_time * 60) : "0h 0m"}</p>
                        </div>
                      </div>

                      {item.remark && (
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-neutral-900">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Remark</p>
                          <p className="text-xs font-medium text-gray-600 dark:text-neutral-400">{item.remark}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: FINANCE LEDGER
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "finance" && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap gap-2.5 items-center bg-white dark:bg-[#0a0a0a] p-2.5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm w-fit">
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2">
                <CalendarDays size={14} className="text-emerald-500" />
                <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                  {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
                </select>
              </div>
              <select value={selYear} onChange={e => setSelYear(parseInt(e.target.value))} className="bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2 text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={fetchPortalData} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-black rounded-xl hover:bg-gray-800 active:scale-95 transition-all">Load</button>
            </div>

            {loading ? (
               <div className="flex justify-center py-24"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : !finance ? (
               <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-16 text-center">
                 <Banknote size={40} className="text-gray-300 dark:text-neutral-700 mx-auto mb-4" />
                 <p className="text-base font-black text-gray-900 dark:text-white">No Financial Data</p>
                 <p className="text-sm font-bold text-gray-500 mt-1">No payroll calculations exist for this month yet.</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Paystub Card */}
                <div className="xl:col-span-2 space-y-4">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-2">
                    <FileText size={16} className="text-emerald-500" /> Salary Breakdown
                  </h3>
                  <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-900">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Fixed Base</p>
                        <p className="font-mono font-black text-lg text-gray-900 dark:text-white">₹{parseFloat(finance.base_salary).toLocaleString("en-IN")}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-900/30">
                        <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest mb-1">Duty Days</p>
                        <p className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-lg">{finance.present}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-900/30">
                        <p className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest mb-1">Paid Leaves</p>
                        <p className="font-mono font-black text-blue-700 dark:text-blue-400 text-lg">+{finance.paid_leaves}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-500/10 border border-red-100 dark:border-red-900/30">
                        <p className="text-[10px] font-bold text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Advances Taken</p>
                        <p className="font-mono font-black text-red-700 dark:text-red-400 text-lg">₹{parseFloat(finance.total_advance).toLocaleString("en-IN")}</p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 rounded-3xl">
                      <div>
                        <p className="text-xs font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest mb-1">Net Payable Amount</p>
                        <p className="font-mono font-black text-4xl text-emerald-800 dark:text-emerald-400">₹{parseFloat(finance.salary_to_pay).toLocaleString("en-IN")}</p>
                      </div>
                      <button onClick={handleDownloadSlip} disabled={downloadingId} className="w-full md:w-auto px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                        {downloadingId ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} strokeWidth={2.5} />} 
                        Download Paystub
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ledger History */}
                <div className="xl:col-span-1 space-y-4 flex flex-col h-[500px] xl:h-[auto]">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-2 shrink-0">
                    <History size={16} className="text-orange-500" /> Transaction Ledger
                  </h3>
                  
                  <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm flex-1 overflow-hidden flex flex-col">
                    {finance.advance_history?.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                        <Banknote size={32} className="text-gray-400 mb-3" />
                        <p className="font-bold text-sm text-gray-500">No transactions this month.</p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-2 flex-1">
                        {finance.advance_history?.map((txn) => (
                          <div key={txn.id} className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-base">₹{parseFloat(txn.amount).toLocaleString("en-IN")}</span>
                              <span className="text-[10px] font-black text-orange-800/50 dark:text-orange-200/50 uppercase tracking-widest">{txn.type.replace('_', ' ')}</span>
                            </div>
                            <p className="text-xs font-bold text-gray-700 dark:text-neutral-300 leading-snug mb-3">{txn.remarks || "No remarks provided"}</p>
                            <div className="flex items-center justify-between pt-3 border-t border-orange-200/50 dark:border-orange-900/50">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                {new Date(txn.created_at).toLocaleString("en-IN", { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                              </span>
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
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: PROFILE & SETTINGS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "profile" && (
          <div className="space-y-6 max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-[2rem] p-8 shadow-sm text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-500/10 to-transparent"></div>
              
              <div className="w-24 h-24 mx-auto rounded-[2rem] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl font-black shadow-lg shadow-blue-500/10 border-4 border-white dark:border-neutral-900 relative z-10 mb-4">
                {initials}
              </div>
              
              <h2 className="text-2xl font-black text-gray-900 dark:text-white relative z-10">{profile?.name}</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1 relative z-10">{profile?.role}</p>

              <div className="grid grid-cols-2 gap-4 mt-8 relative z-10 text-left">
                <div className="p-4 bg-gray-50 dark:bg-[#111] rounded-2xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Mobile</p>
                  <p className="font-mono font-black text-sm text-gray-900 dark:text-white">{profile?.mobile_number}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-[#111] rounded-2xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Shift Target</p>
                  <p className="font-mono font-black text-sm text-gray-900 dark:text-white">{profile?.standard_shift_hours}h / Day</p>
                </div>
              </div>
            </div>

            {/* THEME TOGGLE FOR STAFF */}
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-[2rem] p-4 shadow-sm">
              <button onClick={toggleTheme} className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center text-gray-600 dark:text-neutral-400 group-hover:text-emerald-500 transition-colors">
                    {dark ? <Sun size={16} /> : <Moon size={16} />}
                  </div>
                  <div className="text-left">
                    <span className="font-black text-sm text-gray-900 dark:text-white block">Appearance</span>
                    <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Switch to {dark ? "Light" : "Dark"} Mode</span>
                  </div>
                </div>
              </button>
            </div>

            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-[2rem] p-4 shadow-sm">
              <button onClick={() => logout(router)} className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <LogOut size={18} />
                  <span className="font-black text-sm">Secure Logout</span>
                </div>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ── MOBILE BOTTOM NAV (PWA STYLE) ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white/90 dark:bg-black/90 backdrop-blur-2xl border-t border-gray-200 dark:border-neutral-800 z-50 px-2 pt-2 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-none">
        <div className="flex justify-around items-center mb-2">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className="flex-1 flex flex-col items-center gap-1 p-1">
                <div className={`relative p-2 rounded-xl transition-all duration-300 ${active ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-transparent'}`}>
                  <Icon size={22} className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-neutral-500'} strokeWidth={active ? 2.5 : 2} />
                  {active && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full"></span>}
                </div>
                <span className={`text-[10px] font-bold transition-colors ${active ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-neutral-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}