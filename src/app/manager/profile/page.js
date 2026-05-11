"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  UserCircle2, Loader2, CalendarDays, Banknote, 
  History, Clock3, FileText, Download, CheckCircle2,
  Briefcase, IndianRupee, Wallet, Calendar, AlertTriangle, ChevronRight
} from "lucide-react";

const formatCurrency = (val) => `₹${parseFloat(val || 0).toLocaleString("en-IN")}`;

export default function ManagerPersonalProfile() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Data
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [finance, setFinance] = useState(null);
  const [paystubs, setPaystubs] = useState([]);
  
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [downloadingId, setDownloadingId] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) { router.push("/"); return; }
    try { setSession(JSON.parse(raw)); } catch { router.push("/"); }
  }, [router]);

  const loadPersonalData = useCallback(async () => {
    if (!session?.id) return;
    setLoading(true);
    
    const [pRes, aRes, fRes] = await Promise.all([
      callApi("get_my_profile", { user_id: session.id }),
      callApi("get_my_attendance", { user_id: session.id, month: selMonth, year: selYear }),
      callApi("get_my_financials", { user_id: session.id, month: selMonth, year: selYear })
    ]);

    if (pRes.status === "success") setProfile(pRes.data);
    if (aRes.status === "success") setAttendance(aRes.data || []);
    if (fRes.status === "success") {
      setFinance(fRes.data);
      setPaystubs(fRes.data.payroll_history || []);
    }
    setLoading(false);
  }, [session?.id, selMonth, selYear]);

  useEffect(() => { if (session) loadPersonalData(); }, [session, loadPersonalData]);

  const handleDownloadSlip = async (stub) => {
    setDownloadingId(true);
    const res = await callApi("download_salary_slip", { user_id: session.id, month: stub.payroll_month, year: stub.payroll_year });
    if (res.status === "success" && res.url) window.open(res.url, "_blank");
    else alert("Slip not generated yet.");
    setDownloadingId(false);
  };

  if (!session || (!profile && loading)) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-blue-500 mb-4" size={48} strokeWidth={2} />
      <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Loading Personal Profile...</p>
    </div>
  );

  const initials = session.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const advancesTaken = finance ? (parseFloat(finance.summary?.pre_advance || 0) + parseFloat(finance.summary?.final_advance || 0) + parseFloat(finance.summary?.shop_advance || 0)) : 0;
  const finesTaken = finance ? (parseFloat(finance.summary?.fine || 0) + parseFloat(finance.summary?.other || 0)) : 0;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 w-full px-3 md:px-0 max-w-5xl mx-auto">
      
      {/* ── HERO PROFILE CARD ── */}
      <div className="relative bg-white/60 dark:bg-[#0a0a0a]/60 backdrop-blur-2xl border border-gray-200/60 dark:border-neutral-800/60 rounded-[2rem] p-6 md:p-8 shadow-sm overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 mt-3 md:mt-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl font-black shadow-lg shadow-blue-500/10 border-2 border-white dark:border-neutral-800 shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 mb-1.5">
              <UserCircle2 size={14} className="shrink-0" />
              <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Personal Portal</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-2">{session.name}</h1>
            <p className="text-xs md:text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <Briefcase size={14}/> Manager • {session.branch_name}
            </p>
          </div>
        </div>

        <div className="flex items-center bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-1.5 shadow-sm shrink-0 overflow-x-auto z-10">
          <button onClick={() => setActiveTab("overview")} className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Overview</button>
          <button onClick={() => setActiveTab("attendance")} className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'attendance' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Attendance</button>
          <button onClick={() => setActiveTab("finance")} className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'finance' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Finances & Slips</button>
        </div>
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {activeTab === "overview" && profile && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 animate-in slide-in-from-bottom-4">
          <div className="md:col-span-1 space-y-4 md:space-y-6">
            <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl p-6 border border-gray-200 dark:border-neutral-800 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Employment Details</h3>
              <div className="space-y-5">
                <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Employee ID</p><p className="font-mono font-black text-sm text-gray-900 dark:text-white">UID-{profile.id}</p></div>
                <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Mobile Number</p><p className="font-mono font-black text-sm text-gray-900 dark:text-white">+91 {profile.mobile}</p></div>
                <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Fixed Monthly Salary</p><p className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">{formatCurrency(profile.monthly_fixed_salary)}</p></div>
              </div>
            </div>
          </div>
          
          <div className="md:col-span-2 bg-blue-600 dark:bg-blue-900/20 rounded-3xl p-6 md:p-8 text-white border border-blue-500 dark:border-blue-900/50 shadow-lg relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            <CalendarDays size={48} className="text-white/20 mb-4" />
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">My Time Ledger</h2>
            <p className="text-blue-100 font-medium text-sm max-w-md">Your personal attendance logs and biometric records are securely stored. Switch to the Attendance tab to view your daily punch history for the current month.</p>
            <button onClick={() => setActiveTab("attendance")} className="mt-6 px-6 py-3 bg-white text-blue-600 w-fit rounded-xl font-black text-sm flex items-center gap-2 active:scale-95 transition-all">
              View My Attendance <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: ATTENDANCE ── */}
      {activeTab === "attendance" && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4">
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
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
            ) : attendance.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-bold text-sm">No punches logged for this period.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-900">
                {attendance.map((day, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-5 hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-black text-gray-400 uppercase">{new Date(day.date).toLocaleDateString("en-IN", { weekday: "short" })}</span>
                        <span className="text-sm font-black text-gray-900 dark:text-white leading-none mt-0.5">{new Date(day.date).getDate()}</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">System Status</p>
                        {day.status === 'F' ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-900/50"><CheckCircle2 size={12}/> Full Day</span> : 
                         day.status === 'H' ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-yellow-200 dark:border-yellow-900/50">Half Day</span> : 
                         day.status === 'L' ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-200 dark:border-blue-900/50">On Leave</span> : 
                         <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-200 dark:border-red-900/50"><AlertTriangle size={12}/> Absent</span>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:flex items-center gap-4 md:gap-8 bg-gray-50 dark:bg-[#111] md:bg-transparent p-3 md:p-0 rounded-xl">
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

      {/* ── TAB: FINANCES & SLIPS ── */}
      {activeTab === "finance" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            
            {/* Advance History */}
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm h-fit">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><Wallet size={14} className="text-orange-500" /> Advance & Deductions</h3>
              <div className="flex gap-4 mb-5 p-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-900/50 rounded-2xl">
                 <div>
                   <p className="text-[10px] font-bold text-orange-600/70 dark:text-orange-400/70 uppercase tracking-widest mb-1">Total Advances</p>
                   <p className="font-mono font-black text-xl text-orange-600 dark:text-orange-400">{formatCurrency(advancesTaken)}</p>
                 </div>
                 <div className="border-l border-orange-200 dark:border-orange-900/50 pl-4">
                   <p className="text-[10px] font-bold text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Fines / Deductions</p>
                   <p className="font-mono font-black text-xl text-red-600 dark:text-red-400">{formatCurrency(finesTaken)}</p>
                 </div>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {finance?.advance_history?.length === 0 ? (
                  <p className="text-center text-sm font-bold text-gray-400 py-4">No records found.</p>
                ) : (
                  finance?.advance_history?.map(txn => (
                    <div key={txn.id} className="flex justify-between items-center bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 p-3 rounded-xl">
                      <div>
                        <p className="text-xs font-black text-gray-900 dark:text-white uppercase">{txn.type.replace('_', ' ')}</p>
                        <p className="text-[9px] font-bold text-gray-500">{new Date(txn.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="font-mono font-black text-sm text-orange-600 dark:text-orange-400">{formatCurrency(txn.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Salary Slips */}
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm h-fit">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><FileText size={14} className="text-blue-500" /> Historical Salary Slips</h3>
              
              <div className="space-y-3">
                {paystubs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <Banknote size={32} className="text-gray-400 mb-2" />
                    <p className="text-sm font-bold text-gray-500">No salary slips generated yet.</p>
                  </div>
                ) : (
                  paystubs.map((stub, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 p-4 rounded-2xl hover:border-blue-300 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">
                          {new Date(stub.payroll_year, stub.payroll_month - 1).toLocaleString("en-IN", { month: "short" })}
                        </div>
                        <div>
                          <p className="font-black text-sm text-gray-900 dark:text-white">{new Date(stub.payroll_year, stub.payroll_month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}</p>
                          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mt-0.5">Cleared • {formatCurrency(stub.paid_amount)}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDownloadSlip(stub)} disabled={downloadingId} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl hover:text-blue-500 transition-colors shadow-sm disabled:opacity-50">
                         {downloadingId ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}