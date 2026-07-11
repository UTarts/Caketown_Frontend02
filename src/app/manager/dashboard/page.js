"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import { canRead, canWrite } from "@/lib/permissions";
import {
  Activity, Users, Banknote, Clock3, Loader2, ScanFace,
  CheckCircle2, Coffee, RefreshCw, History, Shield,
  ArrowRight, MonitorPlay, Wallet, MapPin, Search, X, 
  ArrowDownRight, UserCircle, ShieldAlert, Lock, ChevronDown, 
  Send, FileText, AlertTriangle, Trash2
} from "lucide-react";

// ─── HELPERS & CONSTANTS ───
const formatCurrency = (val) => `₹${parseFloat(val || 0).toLocaleString("en-IN")}`;

const TYPE_MAP = {
  pre_advance:   { label: "Pre-Advance",   color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10",  icon: ArrowDownRight },
  final_advance: { label: "Final Advance", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10",  icon: ArrowDownRight },
  shop_advance:  { label: "Shop Adv",      color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",   icon: ArrowDownRight },
  shop_bill:     { label: "Shop Bill",     color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",   icon: FileText },
  fine:          { label: "Fine/Penalty",  color: "text-red-600 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-500/10",       icon: AlertTriangle },
  other:         { label: "Other",         color: "text-gray-600 dark:text-gray-400",     bg: "bg-gray-100 dark:bg-gray-800",       icon: Banknote },
};

function calcPaidLeaves(daysPresent, cap) {
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

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [masterData, setMasterData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);

  // ─── SHORTCUT MODAL STATES ───
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [activeUserModal, setActiveUserModal] = useState(null);
  const [formType, setFormType] = useState("pre_advance");
  const [formAmount, setFormAmount] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // ─── GATEKEEPER & SESSION ───
  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) { router.push("/"); return; }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.role !== "manager") {
        router.push("/");
        return;
      }
      setSession(parsed);
    } catch {
      router.push("/");
    }
  }, [router]);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!session?.branch_id) return;
    if (!isSilent) setLoading(true);
    else setSyncing(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const [masterRes, liveRes, logsRes] = await Promise.all([
        callApi("get_branch_master", { branch_id: session.branch_id }),
        callApi("get_live_attendance", { branch_id: session.branch_id, date: today }),
        callApi("get_system_logs", { branch_id: session.branch_id, per_page: 50 })
      ]);

      if (masterRes.status === "success") setMasterData(masterRes.data);
      if (liveRes.status === "success") setLiveData(liveRes.data);
      if (logsRes.status === "success") setSystemLogs(logsRes.data || []);

    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchDashboardData();
      const interval = setInterval(() => fetchDashboardData(true), 45000);
      return () => clearInterval(interval);
    }
  }, [session, fetchDashboardData]);

  // ─── MODAL SHORTCUT LOGIC ───
  const globalFilteredUsers = useMemo(() => {
    const staffList = masterData?.staff || [];
    if (!globalSearchQuery) return staffList.filter(u => u.status === 'active');
    const q = globalSearchQuery.toLowerCase();
    return staffList.filter(u => 
      u.status === 'active' && (u.name?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q))
    );
  }, [masterData, globalSearchQuery]);

  const openUserFinanceModal = async (u) => {
     setSearchModalOpen(false);
     setGlobalSearchQuery("");
     setActiveUserModal({ ...u, loading: true });
     setFormType("pre_advance");

     const m = new Date().getMonth() + 1;
     const y = new Date().getFullYear();

     const [finRes, attRes] = await Promise.all([
        callApi("get_branch_financial_ledger", { branch_id: session.branch_id, month: m, year: y }),
        callApi("get_monthly_attendance", { branch_id: session.branch_id, month: m, year: y })
     ]);

     const ledgerData = finRes.data || [];
     const attendanceData = attRes.data || [];

     const userTxns = ledgerData.filter(l => String(l.user_id) === String(u.id));
     const balances = { pre_advance: 0, final_advance: 0, shop_advance: 0, shop_bill: 0, fine: 0, other: 0, total_deduction: 0 };

     userTxns.forEach(txn => {
        const amt = parseFloat(txn.amount || 0);
        if (balances[txn.type] !== undefined) balances[txn.type] += amt;
        balances.total_deduction += amt;
     });

     const daysInMonth = new Date(y, m, 0).getDate();
     const userAtt = attendanceData.find(a => String(a.id) === String(u.id));
     const daysWorked = parseFloat(userAtt?.total_duty || userAtt?.days_worked || userAtt?.present || 0);
     const leaveCap = parseInt(u.max_paid_leaves_cap || u.max_paid_leaves || 4);
     const paidLeaves = calcPaidLeaves(daysWorked, leaveCap);
     const totalPaidDays = Math.min(daysInMonth, daysWorked + paidLeaves);

     const fixedSalary = parseFloat(u.monthly_fixed_salary || u.salary || 0);
     const perDayRate = daysInMonth > 0 ? fixedSalary / daysInMonth : 0;
      
     const grossEarned = perDayRate * totalPaidDays;
     const staticDeductions = balances.shop_bill + balances.fine + balances.other;
     const netPayable = Math.max(0, grossEarned - staticDeductions);

     const maxAdv = netPayable * 0.30;
     const takenAdv = balances.pre_advance + balances.final_advance + balances.shop_advance;
     const availAdv = Math.max(0, maxAdv - takenAdv);

     setActiveUserModal({
         ...u, txns: userTxns, balances, fixedSalary, netPayable, maxAdv, takenAdv, availAdv, loading: false
     });
  };

  const handleLogTransaction = async (e) => {
    e.preventDefault();
    if (!formAmount || parseFloat(formAmount) <= 0 || !formRemarks.trim()) return alert("Fill all required fields.");
    
    setFormSubmitting(true);
    const isExceedingLimit = parseFloat(formAmount || 0) > (activeUserModal?.availAdv || 0) && ['pre_advance', 'final_advance', 'shop_advance'].includes(formType);
    const endpoint = isExceedingLimit ? "request_advance" : "log_advance";

    const res = await callApi(endpoint, {
      user_id: activeUserModal.id, branch_id: session.branch_id, manager_id: session.id, actor_id: session.id,
      type: formType, amount: parseFloat(formAmount), remarks: formRemarks,
      month: new Date().getMonth() + 1, year: new Date().getFullYear()
    });
    
    setFormSubmitting(false);

    if (res.status === "success") {
      setFormAmount(""); setFormRemarks("");
      if (isExceedingLimit) alert("Approval request sent to Admin successfully.");
      setActiveUserModal(null);
      fetchDashboardData(true); 
    } else { 
      alert(res.message || "Failed to log transaction."); 
    }
  };

  const handleVoidRecord = async (record_id) => {
    if (!confirm("Are you sure you want to VOID this transaction?")) return;
    setFormSubmitting(true);
    const res = await callApi("delete_financial_record", { record_id, actor_id: session.id });
    setFormSubmitting(false);
    if (res.status === "success") openUserFinanceModal(activeUserModal); 
    else alert(res.message || "Failed to void record.");
  };

  if (!session || (loading && !masterData)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Establishing Secure Uplink...</p>
      </div>
    );
  }

  // ─── DATA PROCESSING ───
  const permissions =
    session.feature_permissions ||
    session.featurepermissions ||
    session.permissions ||
    {};

  // FIXED: Filter out inactive staff before counting the total
  const activeStaff = (masterData?.staff || []).filter(u => u.status === 'active');
  const totalStaff = activeStaff.length;
  
  const allPeople = liveData?.all_people || [];

  const onFloorCount = allPeople.filter(p => p.status === 'working').length;
  const onBreakCount = allPeople.filter(p => p.status === 'on_break').length;
  const absentCount = totalStaff - onFloorCount - onBreakCount;

  const financialLogs = systemLogs.filter(log =>
    log.action_type.includes("ADVANCE") ||
    log.action_type.includes("SALARY") ||
    log.action_type.includes("BILL") ||
    log.action_type.includes("FINE") ||
    log.action_type.includes("DEDUCTION")
  ).slice(0, 15);

  const QUICK_LINKS = [
    { title: "Live Floor Monitoring",  path: "/manager/live-floor", icon: Activity,    color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-900/50", perm: "view_live_attendance" },
    { title: "Biometric Terminal Ops", path: "/manager/terminal",   icon: MonitorPlay, color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-500/10",       border: "border-blue-200 dark:border-blue-900/50",    perm: "manage_terminal" },
    { title: "Staff Roster & Faces",   path: "/manager/staff",      icon: Users,       color: "text-purple-500",  bg: "bg-purple-50 dark:bg-purple-500/10",   border: "border-purple-200 dark:border-purple-900/50",perm: "view_staff_list" },
    { title: "Finance Ledger",         path: "/manager/finance",    icon: Wallet,      color: "text-orange-500",  bg: "bg-orange-50 dark:bg-orange-500/10",   border: "border-orange-200 dark:border-orange-900/50",perm: "view_finance_ledger" },
    { title: "Process Payroll",        path: "/manager/payroll",    icon: Banknote,    color: "text-rose-500",    bg: "bg-rose-50 dark:bg-rose-500/10",       border: "border-rose-200 dark:border-rose-900/50",    perm: "view_payroll" },
  ];

  // Derive available types based on specific log permissions
  const canLogAdv = canWrite(permissions, 'log_advance');
  const canLogBill = canWrite(permissions, 'log_shop_bill');
  const canDeleteRec = canWrite(permissions, 'delete_finance_record');
  const availableTypes = Object.keys(TYPE_MAP).filter(key => {
    if (['pre_advance', 'final_advance', 'shop_advance', 'repayment'].includes(key)) return canLogAdv;
    if (['shop_bill', 'fine', 'other'].includes(key)) return canLogBill;
    return false;
  });

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 w-full overflow-x-hidden">

      {/* ── COMMAND CENTER HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mx-3 md:mx-0 mt-3 md:mt-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 mb-1">
            <Shield size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Branch Command Center</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            {session.branch_name || "Assigned Branch"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0 relative z-10 w-full md:w-auto">
          <button onClick={() => fetchDashboardData(false)} className="p-3.5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 hover:border-blue-500/50 rounded-xl text-gray-600 dark:text-neutral-400 hover:text-blue-500 transition-all shadow-sm group">
            <RefreshCw size={18} className={`${syncing ? "animate-spin text-blue-500" : ""} group-hover:rotate-180 transition-transform duration-500`} />
          </button>

          {/* DYNAMIC SHORTCUT: If they have Log Advance permission, allow instant logging from Dashboard */}
          {(canLogAdv || canLogBill) && (
            <button
              onClick={() => setSearchModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-black shadow-lg shadow-orange-500/20 transition-all active:scale-95 uppercase tracking-wider"
            >
              <Banknote size={18} strokeWidth={2.5} /> Log Advance
            </button>
          )}

          {canWrite(permissions, "manage_terminal") && (
            <button
              onClick={() => router.push("/manager/terminal")}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-wider"
            >
              <ScanFace size={18} strokeWidth={2.5} /> Launch Terminal
            </button>
          )}
        </div>
      </div>

      {/* ── LIVE BRANCH METRICS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 px-3 md:px-0">
        {[
          { label: "Total Branch Staff", value: totalStaff,    icon: Users,         color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10",    border: "border-blue-100 dark:border-blue-900/30"    },
          { label: "On Floor Now",       value: onFloorCount,  icon: CheckCircle2,  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-100 dark:border-emerald-900/30" },
          { label: "On Break",           value: onBreakCount,  icon: Coffee,        color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-500/10",border: "border-yellow-100 dark:border-yellow-900/30" },
          { label: "Off Duty / Absent",  value: absentCount,   icon: Clock3,        color: "text-red-600 dark:text-red-400",      bg: "bg-red-50 dark:bg-red-500/10",      border: "border-red-100 dark:border-red-900/30"      },
        ].map((card) => (
          <div key={card.label} className={`rounded-3xl p-5 md:p-6 shadow-sm border ${card.border} ${card.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-[10px] uppercase tracking-widest font-black ${card.color} opacity-80`}>{card.label}</p>
              <card.icon size={16} className={`${card.color} opacity-60`} />
            </div>
            <p className={`text-3xl md:text-4xl font-black tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 px-3 md:px-0">

        {/* ── QUICK COMMAND HUB ── */}
        <div className={`space-y-4 ${canRead(permissions, "view_system_logs") ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
          <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
            <Activity size={16} className="text-blue-500" /> Authorized Modules
          </h3>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-4 shadow-sm flex flex-col gap-3">
            {QUICK_LINKS.map((link) => {
              if (!canRead(permissions, link.perm)) return null;

              return (
                <button
                  key={link.title}
                  onClick={() => router.push(link.path)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 hover:shadow-md group ${link.bg} ${link.border}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-white dark:bg-black shadow-sm flex items-center justify-center ${link.color}`}>
                      <link.icon size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-black text-sm text-gray-900 dark:text-white">{link.title}</span>
                  </div>
                  <ArrowRight size={18} className={`${link.color} opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
                </button>
              );
            })}

            {QUICK_LINKS.filter(link => canRead(permissions, link.perm)).length === 0 && (
              <div className="p-8 text-center text-gray-400 font-bold text-sm">
                No active modules assigned to your profile.
              </div>
            )}
          </div>
        </div>

        {/* ── RECENT FINANCIAL ACTIVITY FEED (Gated) ── */}
        {canRead(permissions, "view_system_logs") && (
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
              <History size={16} className="text-orange-500" /> Recent Financial Activity
            </h3>

            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden h-[500px]">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {financialLogs.length === 0 ? (
                  <div className="text-center text-gray-400 font-bold mt-32 text-sm flex flex-col items-center">
                    <Banknote size={32} className="mb-3 opacity-20" />
                    No financial activity recorded recently.
                  </div>
                ) : (
                  <div className="relative pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6">
                    {financialLogs.map((log) => (
                      <div key={log.id} className="relative group">
                        <div className="absolute -left-[19px] md:-left-[23px] top-1 w-3 h-3 rounded-full ring-4 bg-orange-500 ring-white dark:ring-[#0a0a0a]" />
                        <div className="pl-2">
                          <p className="text-sm font-bold text-gray-800 dark:text-neutral-200 leading-snug">{log.description}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md">
                              {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {log.actor_name && (
                              <span className="text-[10px] font-bold text-blue-500 truncate max-w-[200px]">
                                Action by: {log.actor_name}
                              </span>
                            )}
                          </div>
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

      {/* ══════════════════════════════════════════════════════════════
          GLOBAL SEARCH MODAL FOR LOGGING SHORTCUT
      ══════════════════════════════════════════════════════════════ */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-2xl max-h-[88vh] md:max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="p-3 md:p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111] shrink-0 flex items-center gap-3">
              <div className="flex-1 relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  autoFocus 
                  value={globalSearchQuery} 
                  onChange={(e) => setGlobalSearchQuery(e.target.value)} 
                  placeholder="Search staff by name or department..." 
                  className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 transition-all shadow-sm" 
                />
              </div>
              <button onClick={() => { setSearchModalOpen(false); setGlobalSearchQuery(""); }} className="p-3 bg-gray-100 dark:bg-neutral-900 rounded-xl hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400 min-w-[44px] min-h-[44px] flex items-center justify-center"><X size={18} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 max-h-[60vh]">
              {globalFilteredUsers.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-14 text-center opacity-50">
                    <Users size={30} className="text-gray-400 mb-3" />
                    <p className="text-sm font-bold text-gray-500">No active personnel found.</p>
                 </div>
              ) : (
                <div className="space-y-1">
                  {globalFilteredUsers.map(u => (
                    <button key={u.id} onClick={() => openUserFinanceModal(u)} className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl transition-colors text-left group min-h-[60px]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center shrink-0 border border-gray-200 dark:border-neutral-800">
                           <span className="font-black text-sm text-gray-600 dark:text-neutral-400">{u.name.charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm text-gray-900 dark:text-white truncate">{u.name}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{u.department || 'Staff'}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-mono text-xs font-bold text-gray-500">{u.mobile_number}</p>
                        <span className="text-[10px] font-black text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 mt-0.5">Select <ArrowDownRight size={12}/></span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          FINANCE LOGGING MODAL
      ══════════════════════════════════════════════════════════════ */}
      {activeUserModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-4xl max-h-[92vh] md:max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col overflow-hidden">
            
            <div className="p-4 md:p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/10 text-orange-500 flex items-center justify-center shrink-0">
                  <UserCircle size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900 dark:text-white leading-tight">{activeUserModal.name}</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Quick Finance Log</p>
                </div>
              </div>
              <button onClick={() => { setActiveUserModal(null); setFormAmount(""); setFormRemarks(""); }} className="p-2.5 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400 min-w-[40px] min-h-[40px] flex items-center justify-center"><X size={16} /></button>
            </div>
            
            {activeUserModal.loading ? (
               <div className="flex justify-center items-center py-28"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
            ) : (
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
                
                {/* LEFT: LOG FORM */}
                <div className={`w-full ${canRead(permissions, "view_finance_ledger") ? "md:w-1/2 md:border-r" : "md:w-full"} border-b md:border-b-0 border-gray-100 dark:border-neutral-900 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0a0a0a] max-h-[45vh] md:max-h-none`}>
                  
                  <div className="mb-5 p-4 bg-gray-50 dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">30% Dynamic Limit</p>
                      <p className="font-mono text-xs font-black text-gray-900 dark:text-white">Max: {formatCurrency(activeUserModal.maxAdv)}</p>
                    </div>
                    
                    <div className="w-full h-2.5 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden flex mb-2">
                      <div style={{ width: `${Math.min((activeUserModal.takenAdv / activeUserModal.maxAdv) * 100, 100)}%` }} className="h-full bg-orange-500 transition-all"></div>
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-orange-600 dark:text-orange-400">Consumed: {formatCurrency(activeUserModal.takenAdv)}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">Available: {formatCurrency(activeUserModal.availAdv)}</span>
                    </div>
                  </div>

                  {['pre_advance', 'final_advance', 'shop_advance'].includes(formType) && parseFloat(formAmount || 0) > activeUserModal.availAdv && (
                    <div className="mb-5 p-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-900/50 rounded-xl flex items-start gap-2 animate-in fade-in zoom-in-95">
                      <ShieldAlert size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-0.5">Admin Approval Required</p>
                        <p className="text-[10px] font-bold text-indigo-600/80 dark:text-indigo-400/80 leading-snug">Amount exceeds 30% safety limit. This record will be sent to Admin for final approval.</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleLogTransaction} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Transaction Type</label>
                      <div className="relative">
                        <select required value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-base font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer min-h-[48px]">
                          {availableTypes.map((val) => <option key={val} value={val}>{TYPE_MAP[val].label}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black font-mono">₹</span>
                        <input required type="number" step="0.01" min="1" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" className="w-full bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl py-3 pl-8 pr-4 text-base font-black font-mono text-orange-700 dark:text-orange-400 outline-none focus:ring-2 focus:ring-orange-500/50 min-h-[48px]" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Mandatory Remarks</label>
                      <textarea required value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} placeholder="Reason for this transaction..." className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-20 custom-scrollbar" />
                    </div>

                    <button 
                      type="submit" 
                      disabled={formSubmitting} 
                      className={`w-full py-4 mb-24 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4 min-h-[52px] ${parseFloat(formAmount || 0) > activeUserModal.availAdv && ['pre_advance', 'final_advance', 'shop_advance'].includes(formType) ? "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20" : "bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 dark:text-black shadow-gray-900/20 dark:shadow-white/10"}`}
                    >
                      {formSubmitting ? <Loader2 size={16} className="animate-spin" /> : parseFloat(formAmount || 0) > activeUserModal.availAdv && ['pre_advance', 'final_advance', 'shop_advance'].includes(formType) ? <Send size={16} strokeWidth={3} /> : <CheckCircle2 size={16} strokeWidth={3} />}
                      {parseFloat(formAmount || 0) > activeUserModal.availAdv && ['pre_advance', 'final_advance', 'shop_advance'].includes(formType) ? "Send to Admin" : "Submit Record"}
                    </button>
                  </form>
                </div>

                {/* RIGHT: TRANSACTION HISTORY (Gated by permission) */}
                {canRead(permissions, "view_finance_ledger") && (
                  <div className="w-full md:w-1/2 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-[#050505] max-h-[45vh] md:max-h-none">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><History size={14} className="text-blue-500" /> Current Month History</h3>
                    
                    {activeUserModal.txns.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                        <History size={28} className="text-gray-400 mb-3" />
                        <p className="text-sm font-bold text-gray-500">No transactions recorded.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeUserModal.txns.map(txn => {
                          const T = TYPE_MAP[txn.type] || TYPE_MAP.other;
                          return (
                            <div key={txn.id} className="bg-white dark:bg-[#111] border border-gray-100 dark:border-neutral-800 p-4 rounded-2xl shadow-sm relative">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${T.bg} ${T.color} border-current opacity-80 mb-1`}>{T.label}</span>
                                  <p className={`font-mono font-black text-lg leading-none ${T.color}`}>{formatCurrency(txn.amount)}</p>
                                </div>
                                {canDeleteRec && (
                                  <button onClick={() => handleVoidRecord(txn.id)} disabled={formSubmitting} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 mb-3 leading-snug">{txn.remarks}</p>
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-50 dark:border-neutral-900 pt-2">
                                {new Date(txn.created_at).toLocaleDateString('en-IN', {month:'short', day:'numeric'})} by {txn.logged_by_name || 'System'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}