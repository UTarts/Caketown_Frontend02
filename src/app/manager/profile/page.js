"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { callApi, logout } from "@/lib/apiClient";
import {
  UserCircle, Loader2, Mail, Phone, MapPin, Briefcase,
  Banknote, Clock3, Calendar, FileText, Shield, LogOut,
  ChevronRight, ArrowDownToLine, Activity, Info, AlertCircle, CheckCircle2
} from "lucide-react";

// ─── HELPERS ───────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}h ${m}m`;
}

export default function ManagerProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("identity");
  
  // Data States
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);

  // Month/Year Picker
  const now = new Date();
  const [finMonth, setFinMonth] = useState(now.getMonth() + 1);
  const [finYear, setFinYear] = useState(now.getFullYear());
  const daysInMonth = new Date(finYear, finMonth, 0).getDate();

  // ─── INITIALIZATION ───
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

  const fetchData = useCallback(async () => {
    if (!session?.id) return;
    setLoading(true);

    try {
      const [profRes, attRes, finRes] = await Promise.all([
        callApi("get_my_profile", { user_id: session.id }),
        callApi("get_my_attendance", { user_id: session.id, month: finMonth, year: finYear }),
        callApi("get_my_financials", { user_id: session.id, month: finMonth, year: finYear })
      ]);

      if (profRes.status === "success") setProfile(profRes.data);
      if (attRes.status === "success") setAttendance(attRes.data);
      if (finRes.status === "success") setFinancials(finRes.data);
    } catch (err) {
      console.error("Profile sync error:", err);
    } finally {
      setLoading(false);
    }
  }, [session, finMonth, finYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!session || loading && !profile) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Loading Profile...</p>
      </div>
    );
  }

  const TABS = [
    { id: "identity",   label: "Identity & Settings" },
    { id: "attendance", label: "My Attendance" },
    { id: "finance",    label: "My Salary & Finances" },
  ];

  const initials = profile?.name?.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "M";

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 w-full overflow-x-hidden">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 bg-white/60 dark:bg-neutral-900/40 p-6 md:p-8 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mx-3 md:mx-0 mt-3 md:mt-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl font-black shadow-lg shadow-emerald-500/10 border-2 border-white dark:border-neutral-800 relative z-10 shrink-0">
          {initials}
        </div>
        
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500 mb-1">
            Personal Profile
          </p>
          <h1 className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
            {profile?.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 text-xs font-bold rounded-lg uppercase tracking-wider">
              {profile?.role}
            </span>
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg flex items-center gap-1.5">
              <MapPin size={12} /> {profile?.branch_name}
            </span>
          </div>
        </div>
      </div>

      {/* ── TABS ───────────────────────────────────────────────────────── */}
      <div className="sticky top-14 md:top-0 z-30 bg-[#F8FAFC]/90 dark:bg-[#050505]/90 backdrop-blur-xl pt-2 pb-4 px-3 md:px-0">
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 snap-x">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`snap-start shrink-0 px-6 py-3 rounded-2xl text-sm font-black whitespace-nowrap transition-all duration-300 ${
                activeTab === item.id
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
          TAB: IDENTITY & SETTINGS
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "identity" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 px-3 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Contact & Employment Info */}
          <div className="space-y-6">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
              <UserCircle size={16} className="text-blue-500" /> Professional Identity
            </h3>
            
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-neutral-900/50 border border-gray-100 dark:border-neutral-800/80">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0"><Phone size={18} /></div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Mobile Number</p>
                  <p className="font-mono font-black text-gray-900 dark:text-white">{profile?.mobile_number}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-neutral-900/50 border border-gray-100 dark:border-neutral-800/80">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 flex items-center justify-center shrink-0"><Briefcase size={18} /></div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Department</p>
                  <p className="font-black text-gray-900 dark:text-white">{profile?.department || "Operations"}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-neutral-900/50 border border-gray-100 dark:border-neutral-800/80">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0"><Shield size={18} /></div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Biometric Status</p>
                  <p className="font-black text-gray-900 dark:text-white">{profile?.face_registered ? "Registered & Active" : "Pending Registration"}</p>
                </div>
                {profile?.face_registered ? <CheckCircle2 className="text-emerald-500" size={20} /> : <AlertCircle className="text-amber-500" size={20} />}
              </div>
            </div>
          </div>

          {/* Contract & Settings */}
          <div className="space-y-6">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
              <Activity size={16} className="text-orange-500" /> Contract & Settings
            </h3>

            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-orange-50/50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-900/30 text-center">
                  <p className="text-[10px] font-bold text-orange-600/70 dark:text-orange-400/70 uppercase tracking-widest mb-1">Target Shift</p>
                  <p className="font-mono font-black text-orange-600 dark:text-orange-400 text-lg">{profile?.standard_shift_hours}h</p>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-900/30 text-center">
                  <p className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest mb-1">Leave Cap</p>
                  <p className="font-mono font-black text-blue-600 dark:text-blue-400 text-lg">{profile?.max_paid_leaves_cap}</p>
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-100 dark:border-neutral-900 pt-6">
                <button className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-neutral-900 border border-transparent hover:border-gray-200 dark:hover:border-neutral-800 transition-colors group">
                  <div className="flex items-center gap-3 text-gray-700 dark:text-neutral-300">
                    <FileText size={18} className="text-gray-400 group-hover:text-emerald-500 transition-colors" />
                    <span className="font-bold text-sm">Terms & Conditions</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500" />
                </button>
                <button className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-neutral-900 border border-transparent hover:border-gray-200 dark:hover:border-neutral-800 transition-colors group">
                  <div className="flex items-center gap-3 text-gray-700 dark:text-neutral-300">
                    <Shield size={18} className="text-gray-400 group-hover:text-emerald-500 transition-colors" />
                    <span className="font-bold text-sm">Privacy Policy</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500" />
                </button>
                <button onClick={() => logout(router)} className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors active:scale-[0.98]">
                  <div className="flex items-center gap-3">
                    <LogOut size={18} />
                    <span className="font-black text-sm">Log Out of Console</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: MY ATTENDANCE
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "attendance" && (
        <div className="space-y-6 px-3 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-wrap gap-2.5 items-center bg-white dark:bg-[#0a0a0a] p-2.5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm w-fit">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2">
              <Calendar size={14} className="text-emerald-500" />
              <select value={finMonth} onChange={e => setFinMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
              </select>
            </div>
            <select value={finYear} onChange={e => setFinYear(parseInt(e.target.value))} className="bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2 text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-24"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : attendance.length === 0 ? (
              <div className="p-16 text-center text-gray-400 font-bold">No attendance records for this period.</div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <th className="p-5">Date</th>
                      <th className="p-5 text-center">Status</th>
                      <th className="p-5 text-center">First In</th>
                      <th className="p-5 text-center">Last Out</th>
                      <th className="p-5 text-center">Work Time</th>
                      <th className="p-5 text-center text-yellow-600 dark:text-yellow-500">Break Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                    {attendance.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                        <td className="p-5 font-bold text-sm text-gray-900 dark:text-white whitespace-nowrap">
                          {new Date(row.date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}
                        </td>
                        <td className="p-5 text-center">
                          <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                            row.status === "F" ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" :
                            row.status === "H" ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                            row.status === "A" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" :
                            "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400"
                          }`}>
                            {row.status === "F" ? "Full" : row.status === "H" ? "Half" : row.status === "A" ? "Absent" : row.status}
                          </span>
                        </td>
                        <td className="p-5 text-center font-mono font-bold text-sm text-gray-600 dark:text-neutral-400">
                          {row.first_in ? new Date(row.first_in).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </td>
                        <td className="p-5 text-center font-mono font-bold text-sm text-gray-600 dark:text-neutral-400">
                          {row.last_out ? new Date(row.last_out).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' }) : "—"}
                        </td>
                        <td className="p-5 text-center font-mono font-black text-sm text-gray-900 dark:text-white">
                          {formatDuration(row.work_time * 60)}
                        </td>
                        <td className="p-5 text-center font-mono font-bold text-sm text-yellow-600 dark:text-yellow-500">
                          {formatDuration(row.break_time * 60)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: FINANCE
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "finance" && (
        <div className="space-y-6 md:space-y-8 px-3 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-wrap gap-2.5 items-center bg-white dark:bg-[#0a0a0a] p-2.5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm w-fit">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2">
              <Calendar size={14} className="text-emerald-500" />
              <select value={finMonth} onChange={e => setFinMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
              </select>
            </div>
            <select value={finYear} onChange={e => setFinYear(parseInt(e.target.value))} className="bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2 text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {!financials ? (
             <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-16 text-center text-gray-400 font-bold">No financial data found.</div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
              
              {/* Paystub Summary */}
              <div className="xl:col-span-2 space-y-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
                  <Banknote size={16} className="text-emerald-500" /> Paystub Overview
                </h3>
                
                <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-neutral-900/50 border border-gray-100 dark:border-neutral-800">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Fixed Salary</p>
                      <p className="font-mono font-black text-lg text-gray-900 dark:text-white">₹{parseFloat(financials.base_salary).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest mb-1">Days Present</p>
                      <p className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-lg">{financials.present}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-900/30">
                      <p className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-widest mb-1">Paid Holidays</p>
                      <p className="font-mono font-black text-blue-700 dark:text-blue-400 text-lg">+{financials.paid_leaves}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-500/10 border border-red-100 dark:border-red-900/30">
                      <p className="text-[10px] font-bold text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Total Deductions</p>
                      <p className="font-mono font-black text-red-700 dark:text-red-400 text-lg">₹{parseFloat(financials.total_advance + financials.deduction).toLocaleString("en-IN")}</p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 md:p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 rounded-3xl">
                    <div>
                      <p className="text-xs font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest mb-1">Net Payable Amount</p>
                      <p className="font-mono font-black text-4xl text-emerald-800 dark:text-emerald-400">₹{parseFloat(financials.salary_to_pay).toLocaleString("en-IN")}</p>
                    </div>
                    <button onClick={() => window.open(callApi("download_salary_slip", { user_id: session.id, month: finMonth, year: finYear }).url)} className="w-full md:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95">
                      <ArrowDownToLine size={18} strokeWidth={2.5} /> Download Slip
                    </button>
                  </div>
                </div>
              </div>

              {/* Advance History */}
              <div className="xl:col-span-1 space-y-4">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
                  <Clock3 size={16} className="text-orange-500" /> Transaction History
                </h3>
                
                <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm h-[400px] xl:h-[480px] overflow-hidden flex flex-col">
                  {financials.advance_history?.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <Banknote size={32} className="text-gray-300 dark:text-neutral-700 mb-3" />
                      <p className="font-bold text-sm text-gray-400">No financial history this month.</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto custom-scrollbar pr-2 space-y-3 pb-4">
                      {financials.advance_history?.map((txn) => (
                        <div key={txn.id} className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-sm">₹{parseFloat(txn.amount).toLocaleString("en-IN")}</span>
                            <span className="text-[10px] font-black text-orange-800/50 dark:text-orange-200/50 uppercase tracking-widest">{txn.type.replace('_', ' ')}</span>
                          </div>
                          <p className="text-xs font-bold text-gray-700 dark:text-neutral-300 leading-snug mb-3">{txn.remarks || "No remarks provided"}</p>
                          <div className="flex items-center justify-between pt-3 border-t border-orange-200/50 dark:border-orange-900/50">
                            <span className="text-[10px] font-bold text-gray-500">
                              {new Date(txn.created_at).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
    </div>
  );
}