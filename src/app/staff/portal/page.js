"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { callApi, logout } from "@/lib/apiClient";
import {
  Banknote, CalendarDays, Loader2, CheckCircle2, 
  LayoutDashboard, History, Download, LogOut, 
  Activity, Wallet, Coffee, ChevronRight, AlertTriangle, 
  Sun, Moon, X, Plus, Calendar, ShieldCheck, Clock, FileText
} from "lucide-react";

// --- HELPERS ---
const formatCurrency = (val) => `₹${parseFloat(val || 0).toLocaleString("en-IN")}`;

export default function StaffPortalPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState("home");
  const [dark, setDark] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Data States
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [finance, setFinance] = useState(null);
  const [paystubs, setPaystubs] = useState([]);
  const [leaves, setLeaves] = useState([]);
  
  // Scopes
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [downloadingId, setDownloadingId] = useState(false);

  // Leave Form Modal
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start_date: "", end_date: "", reason: "" });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = () => logout(router);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("caketown_session");
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || (parsed.role !== "staff" && parsed.role !== "manager")) {
        router.push("/"); return;
      }
      setSession(parsed);
    } catch { router.push("/"); }
  }, [router]);

  const fetchPortalData = useCallback(async () => {
    if (!session?.id) return;
    setLoading(true);

    try {
      const [profRes, attRes, finRes, leavesRes] = await Promise.all([
        callApi("get_my_profile", { user_id: session.id }),
        callApi("get_my_attendance", { user_id: session.id, month: selMonth, year: selYear }),
        callApi("get_my_financials", { user_id: session.id, month: selMonth, year: selYear }),
        callApi("get_leave_applications", { branch_id: session.branch_id, status: 'all' })
      ]);

      if (profRes.status === "success") setProfile(profRes.data);
      if (attRes.status === "success") setAttendance(attRes.data || []);
      if (finRes.status === "success") {
        setFinance(finRes.data);
        setPaystubs(finRes.data.payroll_history || []);
      }
      if (leavesRes.status === "success") {
        const myLeaves = (leavesRes.data || []).filter(l => String(l.user_id) === String(session.id));
        setLeaves(myLeaves);
      }
    } catch (err) {
      console.error("Portal sync error:", err);
    } finally {
      setLoading(false);
    }
  }, [session, selMonth, selYear]);

  useEffect(() => { fetchPortalData(); }, [fetchPortalData]);

  const handleDownloadSlip = async (stub) => {
    setDownloadingId(true);
    const res = await callApi("download_salary_slip", { user_id: session.id, month: stub.payroll_month, year: stub.payroll_year });
    if (res.status === "success" && res.url) window.open(res.url, "_blank");
    else alert(res.message || "Failed to generate salary slip.");
    setDownloadingId(false);
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setLeaveSubmitting(true);
    const res = await callApi("apply_leave", {
      user_id: session.id,
      branch_id: session.branch_id,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason
    });
    setLeaveSubmitting(false);

    if (res.status === "success") {
      setLeaveForm({ start_date: "", end_date: "", reason: "" });
      setShowLeaveForm(false);
      fetchPortalData(); // Refresh leaves list
    } else {
      alert(res.message || "Failed to submit leave application.");
    }
  };

  if (!session || (loading && !profile)) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 dark:bg-[#050505]">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Loading App...</p>
      </div>
    );
  }

  const navItems = [
    { id: "home", label: "Overview", icon: LayoutDashboard },
    { id: "attendance", label: "Duty Logs", icon: CalendarDays },
    { id: "finance", label: "Finances", icon: Wallet },
    { id: "leave", label: "Leaves", icon: Coffee },
  ];

  const initials = profile?.name?.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "S";
  const advancesTaken = finance ? (parseFloat(finance.summary?.pre_advance || 0) + parseFloat(finance.summary?.final_advance || 0) + parseFloat(finance.summary?.shop_advance || 0)) : 0;
  const finesTaken = finance ? (parseFloat(finance.summary?.fine || 0) + parseFloat(finance.summary?.other || 0)) : 0;

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-neutral-200">
      
      {/* ── UNIFIED APP HEADER ── */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-neutral-800/60 h-16 flex items-center justify-between shadow-sm px-4">
        {/* Logo */}
        <div className="absolute top-0 left-0 h-16 w-40 bg-white shadow-[2px_0_10px_rgba(0,0,0,0.1)] z-10 flex flex-col justify-center px-4" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>
          <img src="/logo.png" alt="Caketown" className="h-6 w-auto object-contain object-left" onError={(e) => { e.target.style.display='none'; }} />
          <span className="text-[8px] text-blue-600 font-black uppercase tracking-widest mt-0.5">Staff Portal</span>
        </div>

        {/* Desktop Tabs (Hidden on Mobile) */}
        <div className="hidden md:flex flex-1 items-center justify-center gap-2 pl-40">
           {navItems.map(item => (
             <button key={item.id} onClick={() => setActiveTab(item.id)} className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === item.id ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
               <item.icon size={16} /> {item.label}
             </button>
           ))}
        </div>

        <div className="flex-1 md:hidden"></div>

        {/* Profile Menu Trigger */}
        <div className="relative z-20" ref={profileMenuRef}>
           <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-xs border border-blue-200 dark:border-blue-800 shadow-sm active:scale-95 transition-all">
             {initials}
           </button>
           
           {profileMenuOpen && (
             <div className="absolute top-[120%] right-0 w-56 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl p-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
               <div className="px-3 py-2 mb-2 border-b border-gray-100 dark:border-neutral-900">
                 <p className="text-sm font-black text-gray-900 dark:text-white truncate">{profile.name}</p>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{profile.branch_name}</p>
               </div>
               <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                 {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? "Light Mode" : "Dark Mode"}
               </button>
               <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors mt-1">
                 <LogOut size={16} /> Secure Logout
               </button>
             </div>
           )}
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="pt-20 pb-28 md:pb-10 max-w-3xl mx-auto px-4 md:px-8 h-full">
        
        {/* ── TAB: OVERVIEW ── */}
        {activeTab === "home" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-500 rounded-[2rem] p-6 md:p-8 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-2xl font-black mb-4 shadow-sm">{initials}</div>
                <p className="text-blue-100 font-bold text-xs uppercase tracking-widest mb-1">Welcome Back,</p>
                <h2 className="text-3xl font-black tracking-tight">{profile.name}</h2>
                <p className="text-sm font-medium text-blue-100 mt-1.5 flex items-center gap-2 opacity-90"><Activity size={14}/> {profile.department} • {profile.branch_name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-5 border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col justify-center">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 pl-1">Fixed Salary</p>
                 <p className="font-mono font-black text-2xl text-blue-600 dark:text-blue-400 pl-1">{formatCurrency(profile.monthly_fixed_salary)}</p>
               </div>
               <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-5 border border-gray-200 dark:border-neutral-800 shadow-sm flex flex-col justify-center">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Face ID Vector</p>
                 {profile.face_registered ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl font-black text-[10px] uppercase tracking-widest border border-emerald-200 dark:border-emerald-900/50 w-fit"><CheckCircle2 size={14}/> Registered</span>
                 ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-xl font-black text-[10px] uppercase tracking-widest border border-red-200 dark:border-red-900/50 w-fit"><AlertTriangle size={14}/> Missing</span>
                 )}
               </div>
            </div>
            
            {/* Quick Stats */}
            <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-5 border border-gray-200 dark:border-neutral-800 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2 pl-1"><Calendar size={14} className="text-blue-500" /> Current Month Pulse</h3>
              <div className="flex gap-4 p-4 bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 rounded-2xl">
                 <div>
                   <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Present</p>
                   <p className="font-mono font-black text-xl text-gray-900 dark:text-white">{attendance.filter(a => a.status === 'F' || a.status === 'H').length} Days</p>
                 </div>
                 <div className="border-l border-gray-200 dark:border-neutral-800 pl-4">
                   <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Absent</p>
                   <p className="font-mono font-black text-xl text-red-500">{attendance.filter(a => a.status === 'A').length} Days</p>
                 </div>
              </div>
              <button onClick={() => setActiveTab("attendance")} className="w-full mt-3 py-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-blue-100 dark:border-blue-900/50 flex items-center justify-center gap-2">
                Open Duty Ledger <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: ATTENDANCE ── */}
        {activeTab === "attendance" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 w-fit shadow-sm">
              <Calendar size={16} className="text-blue-500" />
              <select value={selMonth} onChange={(e) => setSelMonth(parseInt(e.target.value))} className="bg-transparent text-sm font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
              </select>
              <select value={selYear} onChange={(e) => setSelYear(parseInt(e.target.value))} className="bg-transparent text-sm font-black text-gray-900 dark:text-white outline-none cursor-pointer border-l border-gray-200 dark:border-neutral-700 pl-2 ml-2">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden min-h-[400px]">
              {attendance.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-bold text-sm">No punches logged for this period.</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-neutral-900">
                  {attendance.map((day, i) => (
                    <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-4 md:p-5 hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors gap-3">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[9px] font-black text-gray-400 uppercase">{new Date(day.date).toLocaleDateString("en-IN", { weekday: "short" })}</span>
                          <span className="text-sm font-black text-gray-900 dark:text-white leading-none mt-0.5">{new Date(day.date).getDate()}</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Status</p>
                          {day.status === 'F' ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-900/50"><CheckCircle2 size={12}/> Full Day</span> : 
                           day.status === 'H' ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-yellow-200 dark:border-yellow-900/50">Half Day</span> : 
                           day.status === 'L' ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-200 dark:border-blue-900/50">On Leave</span> : 
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-200 dark:border-red-900/50"><AlertTriangle size={12}/> Absent</span>}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:flex items-center gap-3 md:gap-8 bg-gray-50 dark:bg-[#111] md:bg-transparent p-3 md:p-0 rounded-xl">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">First In</p>
                          <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">{day.first_in ? new Date(day.first_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Last Out</p>
                          <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">{day.last_out ? new Date(day.last_out).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                        </div>
                        <div className="col-span-2 md:col-span-1 md:text-right border-t md:border-t-0 border-gray-200 dark:border-neutral-800 pt-2 md:pt-0">
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Total Duty</p>
                          <p className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">{day.hours_worked}h Logged</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: FINANCES ── */}
        {activeTab === "finance" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm h-fit">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2 pl-1"><Wallet size={14} className="text-orange-500" /> Current Balances</h3>
              <div className="flex flex-col md:flex-row gap-3 md:gap-4 p-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-900/50 rounded-2xl">
                 <div>
                   <p className="text-[10px] font-bold text-orange-600/70 dark:text-orange-400/70 uppercase tracking-widest mb-1">Total Advances Taken</p>
                   <p className="font-mono font-black text-2xl text-orange-600 dark:text-orange-400">{formatCurrency(advancesTaken)}</p>
                 </div>
                 <div className="md:border-l border-t md:border-t-0 border-orange-200 dark:border-orange-900/50 md:pl-4 pt-2 md:pt-0">
                   <p className="text-[10px] font-bold text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Fines / Deductions</p>
                   <p className="font-mono font-black text-2xl text-red-600 dark:text-red-400">{formatCurrency(finesTaken)}</p>
                 </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm h-fit">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2 pl-1"><FileText size={14} className="text-blue-500" /> Historical Salary Slips</h3>
              <div className="space-y-3">
                {paystubs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <Banknote size={32} className="text-gray-400 mb-2" />
                    <p className="text-sm font-bold text-gray-500">No salary slips generated yet.</p>
                  </div>
                ) : (
                  paystubs.map((stub, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 p-4 rounded-2xl group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">
                          {new Date(stub.payroll_year, stub.payroll_month - 1).toLocaleString("en-IN", { month: "short" })}
                        </div>
                        <div>
                          <p className="font-black text-sm text-gray-900 dark:text-white">{new Date(stub.payroll_year, stub.payroll_month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}</p>
                          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mt-0.5 flex items-center gap-1"><CheckCircle2 size={10}/> Cleared • {formatCurrency(stub.paid_amount)}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDownloadSlip(stub)} disabled={downloadingId} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl hover:text-blue-500 hover:border-blue-300 dark:hover:border-blue-900/50 transition-colors shadow-sm disabled:opacity-50">
                         {downloadingId ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* ── TAB: LEAVES ── */}
        {activeTab === "leave" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            
            <button 
              onClick={() => setShowLeaveForm(true)}
              className="w-full flex items-center justify-center gap-2 py-4 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] uppercase tracking-wider"
            >
              <Plus size={18} strokeWidth={2.5}/> Apply For Leave
            </button>

            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2 pl-1"><Clock size={14} className="text-blue-500" /> My Application History</h3>
              
              <div className="space-y-4">
                {leaves.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <Coffee size={32} className="text-gray-400 mb-2" />
                    <p className="text-sm font-bold text-gray-500">No leave applications found.</p>
                  </div>
                ) : (
                  leaves.map((req) => (
                    <div key={req.id} className={`border rounded-2xl p-4 relative overflow-hidden ${
                      req.status === 'pending' ? 'bg-yellow-50/30 dark:bg-yellow-900/5 border-yellow-200 dark:border-yellow-900/50' : 
                      req.status === 'approved' ? 'bg-emerald-50/30 dark:bg-emerald-900/5 border-emerald-200 dark:border-emerald-900/50' :
                      'bg-red-50/30 dark:bg-red-900/5 border-red-200 dark:border-red-900/50'
                    }`}>
                      {req.status === 'pending' && <div className="absolute top-0 right-0 px-3 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 text-[9px] font-black uppercase tracking-widest rounded-bl-xl">Pending</div>}
                      {req.status === 'approved' && <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-bl-xl">Approved</div>}
                      {req.status === 'rejected' && <div className="absolute top-0 right-0 px-3 py-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-[9px] font-black uppercase tracking-widest rounded-bl-xl">Rejected</div>}
                      
                      <div className="grid grid-cols-2 gap-3 mb-3 pr-20">
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">From Date</p>
                          <p className="text-xs font-mono font-black text-gray-900 dark:text-white">{new Date(req.start_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">To Date</p>
                          <p className="text-xs font-mono font-black text-gray-900 dark:text-white">{new Date(req.end_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>

                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">My Reason</p>
                      <div className="bg-white dark:bg-black border border-gray-100 dark:border-neutral-800 p-3 rounded-xl text-xs font-medium text-gray-700 dark:text-neutral-300">
                        {req.reason}
                      </div>

                      {req.admin_remarks && (
                        <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-neutral-800/50">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><ShieldCheck size={10}/> Manager Remarks</p>
                          <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 pl-1">{req.admin_remarks}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── HIGH-END MOBILE BOTTOM NAVBAR ── */}
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-6 duration-500 pb-safe">
        <div className="bg-white/85 dark:bg-[#0a0a0a]/85 backdrop-blur-2xl border border-gray-200/60 dark:border-neutral-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl p-2 flex items-center justify-between">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button 
                key={item.id} 
                onClick={() => setActiveTab(item.id)} 
                className="relative flex-1 flex flex-col items-center justify-center p-2 rounded-2xl group transition-all"
              >
                {active && (
                  <span className="absolute inset-0 bg-blue-50 dark:bg-blue-500/20 rounded-2xl -z-10 animate-in zoom-in-90 duration-200"></span>
                )}
                <Icon size={20} className={`mb-1 transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-neutral-400'}`} strokeWidth={active ? 2.5 : 2} />
                <span className={`text-[9px] font-black tracking-wide ${active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-neutral-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MODAL: APPLY FOR LEAVE ── */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] rounded-t-3xl shrink-0">
              <h2 className="text-base font-black flex items-center gap-2 text-gray-900 dark:text-white"><Coffee size={18} className="text-blue-500" /> Apply For Leave</h2>
              <button onClick={() => setShowLeaveForm(false)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><X size={16} /></button>
            </div>
            
            <form onSubmit={handleApplyLeave} className="p-5 md:p-6 space-y-5 pb-safe">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Start Date</label>
                  <input type="date" required value={leaveForm.start_date} min={new Date().toISOString().split('T')[0]} onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm font-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">End Date</label>
                  <input type="date" required value={leaveForm.end_date} min={leaveForm.start_date || new Date().toISOString().split('T')[0]} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm font-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Detailed Reason</label>
                <textarea required value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none h-24 custom-scrollbar" placeholder="Please provide the exact reason for your leave request..." />
              </div>

              <button type="submit" disabled={leaveSubmitting} className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50 uppercase tracking-wider mt-2">
                {leaveSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} strokeWidth={2.5} />} 
                Submit Application
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}