"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { callApi } from "@/lib/apiClient";
import Link from "next/link";
import {
  Building2, Users, Banknote, Clock, RefreshCw, UserCheck, MapPin, 
  Wallet, Shield, FileText, X, History, ChevronLeft, ChevronRight, Activity, 
  LogIn, Loader2, Plus, Search, ChevronDown, UserCircle, Unlock, CheckCircle2, Trash2, ArrowDownRight, AlertTriangle
} from "lucide-react";

const formatCurrency = (val) => `₹${parseFloat(val || 0).toLocaleString("en-IN")}`;

// ─── LOGGING METADATA ────────────
const LOG_MAP = {
  create_user:      { color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Admin" },
  USER_CREATED:     { color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Admin" },
  delete_user:      { color: "text-red-500",     bg: "bg-red-500/10",     dot: "bg-red-500",     label: "Admin" },
  USER_DELETED:     { color: "text-red-500",     bg: "bg-red-500/10",     dot: "bg-red-500",     label: "Admin" },
  update_user:      { color: "text-blue-500",    bg: "bg-blue-500/10",    dot: "bg-blue-500",    label: "Admin" },
  USER_UPDATED:     { color: "text-blue-500",    bg: "bg-blue-500/10",    dot: "bg-blue-500",    label: "Admin" },
  SALARY_PAID:      { color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500", label: "Payroll" },
  advance_log:      { color: "text-orange-500",  bg: "bg-orange-500/10",  dot: "bg-orange-500",  label: "Finance" },
  ADVANCE_LOGGED:   { color: "text-orange-500",  bg: "bg-orange-500/10",  dot: "bg-orange-500",  label: "Finance" },
  FACE_REGISTERED:  { color: "text-indigo-500",  bg: "bg-indigo-500/10",  dot: "bg-indigo-500",  label: "Biometric" },
  default:          { color: "text-slate-500",   bg: "bg-slate-500/10",   dot: "bg-slate-400",   label: "System" },
};

const TYPE_MAP = {
  pre_advance: { label: "Pre-Advance", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", icon: ArrowDownRight },
  final_advance: { label: "Final Advance", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", icon: ArrowDownRight },
  shop_advance: { label: "Shop Adv", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", icon: ArrowDownRight },
  shop_bill: { label: "Shop Bill", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", icon: FileText },
  fine: { label: "Fine/Penalty", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10", icon: AlertTriangle },
  other: { label: "Other", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800", icon: Banknote },
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

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [session, setSession] = useState(null); 
  const [stats, setStats] = useState(null);
  const [liveData, setLiveData] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  
  // PRESET FILTERS (Financial transactions defaulted)
  const [logBranchFilter, setLogBranchFilter] = useState("all");
  const [logCategoryFilter, setLogCategoryFilter] = useState("financial"); 

  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);

  // FINANCE MODAL STATE
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [activeUserModal, setActiveUserModal] = useState(null);
  const [formType, setFormType] = useState("pre_advance");
  const [formAmount, setFormAmount] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) return;
    try { setSession(JSON.parse(raw)); } catch {}
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const fetchDashboardAndLive = useCallback(async () => {
    setLoading(true);
    const [res, uRes, bRes] = await Promise.all([
      callApi("get_admin_dashboard"),
      callApi("get_users"),
      callApi("get_branches")
    ]);
    
    if (uRes.status === "success") setUsers((uRes.data || []).filter(u => u.status === 'active' && u.role !== 'admin'));
    if (bRes.status === "success") setBranches(bRes.data || []);

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
    const res = await callApi("get_system_logs", { per_page: 500 }); 
    if (res.status === "success") {
      const highLevelLogs = (res.data || []).filter(log => {
        const type = String(log.action_type).toUpperCase();
        return !type.includes("PUNCH") && !type.includes("LOGIN") && !type.includes("ATTENDANCE") && !type.includes("OVERRIDE") && !type.includes("LEAVE");
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

  // SMART FILTERING LOGIC
  const groupedFilteredLogs = useMemo(() => {
    const filtered = logs.filter(log => {
      // 1. Date Filter
      if (filterDate) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate !== filterDate) return false;
      }
      
      // 2. Branch Filter (Identify branch_id by direct link OR user association)
      let resolvedBranchId = log.branch_id;
      if (!resolvedBranchId && log.user_id) {
         const affectedUser = users.find(u => String(u.id) === String(log.user_id));
         if (affectedUser) resolvedBranchId = affectedUser.branch_id;
      }

      if (logBranchFilter !== 'all') {
        if (logBranchFilter === 'global') {
          if (resolvedBranchId && String(resolvedBranchId) !== "0" && String(resolvedBranchId) !== "null") return false;
        } else {
          if (String(resolvedBranchId) !== String(logBranchFilter)) return false;
        }
      }
      
      // 3. Category Filter
      if (logCategoryFilter === "financial") {
         const t = String(log.action_type).toLowerCase();
         const isFin = t.includes("advance") || t.includes("finance") || t.includes("salary") || t.includes("bill") || t.includes("fine") || t.includes("pay");
         if (!isFin) return false;
      } else if (logCategoryFilter === "system") {
         const t = String(log.action_type).toLowerCase();
         const isFin = t.includes("advance") || t.includes("finance") || t.includes("salary") || t.includes("bill") || t.includes("fine") || t.includes("pay");
         if (isFin) return false;
      }

      return true;
    });

    const scrubbedLogs = filtered.map(log => {
      let cleanDesc = log.description;
      let branchName = "Global System";
      
      // Inherit branch_id from the user if it's missing on the log record
      let actualBranchId = log.branch_id;
      if (!actualBranchId && log.user_id) {
         const affectedUser = users.find(u => String(u.id) === String(log.user_id));
         if (affectedUser) actualBranchId = affectedUser.branch_id;
      }
      
      if (actualBranchId && String(actualBranchId) !== "0" && String(actualBranchId) !== "null") {
        const matchedBranch = branches.find(b => String(b.id) === String(actualBranchId));
        if (matchedBranch) {
          branchName = matchedBranch.branch_name;
        } else {
          branchName = `Branch #${actualBranchId}`; 
        }
      }
      
      branches.forEach(b => {
        cleanDesc = cleanDesc.replace(new RegExp(`branch ID ${b.id}\\b`, 'gi'), b.branch_name);
        cleanDesc = cleanDesc.replace(new RegExp(`branch ${b.id}\\b`, 'gi'), b.branch_name);
      });

      return { ...log, description: cleanDesc, branchName };
    });

    return groupLogsByDate(scrubbedLogs);
  }, [logs, filterDate, branches, users, logBranchFilter, logCategoryFilter]);

  // ─── FINANCE MODAL LOGIC ───
  const globalFilteredUsers = useMemo(() => {
    if (!globalSearchQuery) return users;
    const q = globalSearchQuery.toLowerCase();
    return users.filter(u => 
      u.name?.toLowerCase().includes(q) || 
      u.department?.toLowerCase().includes(q) ||
      branches.find(b => b.id === u.branch_id)?.branch_name?.toLowerCase().includes(q)
    );
  }, [users, globalSearchQuery, branches]);

  const openUserFinanceModal = async (u) => {
     setSearchModalOpen(false);
     setGlobalSearchQuery("");
     setActiveUserModal({ ...u, loading: true });
     setFormType("pre_advance");

     const m = now.getMonth() + 1;
     const y = now.getFullYear();

     const [finRes, attRes] = await Promise.all([
        callApi("get_branch_financial_ledger", { branch_id: u.branch_id, month: m, year: y }),
        callApi("get_monthly_attendance", { branch_id: u.branch_id, month: m, year: y })
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
         ...u,
         txns: userTxns,
         balances,
         fixedSalary,
         netPayable,
         maxAdv,
         takenAdv,
         availAdv,
         loading: false
     });
  };

  const handleLogTransaction = async (e) => {
    e.preventDefault();
    if (!formAmount || parseFloat(formAmount) <= 0 || !formRemarks.trim()) return alert("Fill all required fields.");
    
    setFormSubmitting(true);
    const res = await callApi("log_advance", {
      user_id: activeUserModal.id, branch_id: activeUserModal.branch_id, type: formType,
      amount: parseFloat(formAmount), remarks: formRemarks,
      month: now.getMonth() + 1, year: now.getFullYear(), admin_id: session?.id
    });
    setFormSubmitting(false);

    if (res.status === "success") {
      setFormAmount(""); setFormRemarks("");
      openUserFinanceModal(activeUserModal); // Refresh their data instantly
      fetchFeed(); // Refresh the audit log on the dashboard
    } else { alert(res.message || "Failed to log transaction."); }
  };

  const handleVoidRecord = async (record_id) => {
    if (!confirm("Void this transaction?")) return;
    setFormSubmitting(true);
    const res = await callApi("delete_financial_record", { record_id, admin_id: session?.id });
    setFormSubmitting(false);
    if (res.status === "success") {
      openUserFinanceModal(activeUserModal);
      fetchFeed();
    } else { alert(res.message || "Failed to void record."); }
  };

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

      {/* ── GLOBAL TELEMETRY ────────────────────── */}
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

        <div className="relative overflow-hidden bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Command Shortcuts</p>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-1">
              <button onClick={() => setSearchModalOpen(true)} className="flex flex-col items-center justify-center p-3 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-2xl transition-colors text-center active:scale-95">
                <Banknote size={20} className="mb-2" strokeWidth={2.5}/>
                <span className="text-[10px] font-black uppercase tracking-widest">Log Advance</span>
              </button>
              <Link href="/admin/personnel" className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl transition-colors text-center active:scale-95">
                <Users size={20} className="mb-2" strokeWidth={2.5}/>
                <span className="text-[10px] font-black uppercase tracking-widest">Add Staff</span>
              </Link>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6 md:gap-8">
        
        {/* ── BRANCH SURVEILLANCE DATA WIDGETS ─────────────────────────────────── */}
        <div className="space-y-5 flex flex-col h-[700px]">
          <div className="flex items-center justify-between px-1 shrink-0">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <Building2 size={16} className="text-blue-500" /> Operational Branches
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-6 pb-6">
            {loading ? (
               <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
            ) : stats?.branch_grid?.length === 0 ? (
               <div className="bg-white dark:bg-[#0a0a0a] border border-dashed border-gray-200 dark:border-neutral-800 rounded-3xl p-10 text-center text-gray-400 font-bold text-sm">No branches configured.</div>
            ) : (
              stats?.branch_grid?.map(branch => {
                const total = parseInt(branch.staff_count) || 0;
                const present = parseInt(branch.present_today) || 0;
                const activePeople = liveData[branch.id]?.filter(p => p.status === 'working' || p.status === 'on_break') || [];
                
                return (
                  <div key={branch.id} className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-[2rem] shadow-sm overflow-hidden flex flex-col shrink-0">
                    
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
                            <tr className="bg-gray-50/50 dark:bg-[#050505] border-b border-gray-300 dark:border-neutral-700 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              <th className="p-4 border-r border-gray-300 dark:border-neutral-700">Personnel</th>
                              <th className="p-4 text-center border-r border-gray-300 dark:border-neutral-700">First In</th>
                              <th className="p-4 text-center border-r border-gray-300 dark:border-neutral-700">Last Out</th>
                              <th className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">Work Time</th>
                              <th className="p-4 text-right">Break Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-300 dark:divide-neutral-700">
                            {activePeople.map(person => {
                              const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
                              
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
                                  <td className="p-4 border-r border-gray-300 dark:border-neutral-700">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full ${isWorking ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'} shrink-0`}></span>
                                      <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{person.name}</p>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{person.role}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 border-r border-gray-300 dark:border-neutral-700 text-center font-mono text-xs text-gray-600 dark:text-neutral-400 flex items-center justify-center gap-1.5"><LogIn size={12} className="text-gray-400"/> {formatTime(strictFirstPunch)}</td>
                                  <td className="p-4 border-r border-gray-300 dark:border-neutral-700 text-center font-mono text-xs text-gray-600 dark:text-neutral-400">{isWorking ? <span className="text-emerald-500 font-black text-[10px] uppercase tracking-widest animate-pulse">Active</span> : formatTime(strictLastPunch)}</td>
                                  <td className="p-4 border-r border-gray-300 dark:border-neutral-700 text-right font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">{formatDuration(workMins)}</td>
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
              })
            )}
          </div>
        </div>

        {/* ── SMART SYSTEM FEED (FINANCE & ADMIN LOGS ONLY) ────────────────────────── */}
        <div className="space-y-4 flex flex-col h-[700px]">
          <div className="flex items-center justify-between px-1 shrink-0">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
              <History size={16} className="text-purple-500" /> Admin Audit Log
            </h2>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
            
            <div className="p-3 md:p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-neutral-900/20 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              
              {/* Presets and Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select value={logCategoryFilter} onChange={e => setLogCategoryFilter(e.target.value)} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-neutral-300 outline-none cursor-pointer shadow-sm">
                  <option value="financial">Finance Logs</option>
                  <option value="system">Admin & System</option>
                  <option value="all">All Activities</option>
                </select>
                <select value={logBranchFilter} onChange={e => setLogBranchFilter(e.target.value)} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-neutral-300 outline-none cursor-pointer shadow-sm">
                  <option value="all">All Branches</option>
                  <option value="global">Global Changes</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                </select>
              </div>
              
              {/* Date Pagination */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shrink-0 shadow-sm w-full sm:w-auto justify-between sm:justify-start">
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
                <div className="space-y-8 pb-safe">
                  {Object.entries(groupedFilteredLogs).map(([dateLabel, logGroup]) => (
                    <div key={dateLabel}>
                      <div className="flex items-center gap-4 mb-5 sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm z-10 py-1 -mt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 dark:bg-neutral-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-800">{dateLabel}</span>
                        <div className="h-px bg-gray-100 dark:bg-neutral-800 flex-1"></div>
                      </div>
                      
                      <div className="relative pl-4 md:pl-6 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6">
                        {logGroup.map((log) => {
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
                                  <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700">
                                    {log.branchName}
                                  </span>
                                  <span className="text-[10px] font-bold text-gray-400 tabular-nums ml-1">
                                    {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                                  </span>
                                  {log.actor_name && (
                                    <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5 border-l border-gray-200 dark:border-neutral-800 pl-2 ml-1">
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

      {/* ══════════════════════════════════════════════════════════════════
          GLOBAL SEARCH MODAL (Triggered by 'Log Advance' Shortcut)
      ══════════════════════════════════════════════════════════════════ */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-2xl max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111] shrink-0 flex items-center gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  autoFocus
                  value={globalSearchQuery} 
                  onChange={(e) => setGlobalSearchQuery(e.target.value)} 
                  placeholder="Search by name, branch, or department..." 
                  className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 transition-all shadow-sm" 
                />
              </div>
              <button onClick={() => { setSearchModalOpen(false); setGlobalSearchQuery(""); }} className="p-3 bg-gray-100 dark:bg-neutral-900 rounded-xl hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><X size={18} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {globalFilteredUsers.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-16 text-center opacity-50">
                    <Users size={32} className="text-gray-400 mb-3" />
                    <p className="text-sm font-bold text-gray-500">No personnel found matching your search.</p>
                 </div>
              ) : (
                <div className="space-y-1">
                  {globalFilteredUsers.map(u => {
                    const branchName = branches.find(b => b.id === u.branch_id)?.branch_name || 'Unknown Branch';
                    return (
                      <button 
                        key={u.id} 
                        onClick={() => openUserFinanceModal(u)}
                        className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center shrink-0 border border-gray-200 dark:border-neutral-800">
                             <span className="font-black text-sm text-gray-600 dark:text-neutral-400">{u.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-sm text-gray-900 dark:text-white truncate">{u.name}</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{branchName} • {u.department || 'Staff'}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-xs font-bold text-gray-500">{u.mobile_number}</p>
                          <span className="text-[10px] font-black text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 mt-0.5">Select <ArrowDownRight size={12}/></span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FINANCE LOGGING MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {activeUserModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-4xl max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col overflow-hidden">
            
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/10 text-orange-500 flex items-center justify-center shrink-0">
                  <UserCircle size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900 dark:text-white leading-tight">{activeUserModal.name}</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Finance Profile</p>
                </div>
              </div>
              <button onClick={() => { setActiveUserModal(null); setFormAmount(""); setFormRemarks(""); }} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><X size={16} /></button>
            </div>
            
            {activeUserModal.loading ? (
               <div className="flex justify-center items-center py-32"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
            ) : (
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
                
                {/* LEFT SIDE: LOG FORM */}
                <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-gray-100 dark:border-neutral-900 p-5 md:p-6 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0a0a0a]">
                  
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-neutral-800">
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
                    
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-neutral-800 flex justify-between items-center">
                      <p className="text-[9px] font-bold text-gray-400">Calculated on Net Earned: <span className="text-gray-700 dark:text-neutral-300 font-mono">{formatCurrency(activeUserModal.netPayable)}</span></p>
                    </div>
                  </div>

                  {['pre_advance', 'final_advance', 'shop_advance'].includes(formType) && parseFloat(formAmount || 0) > activeUserModal.availAdv && (
                    <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2 animate-in fade-in zoom-in-95">
                      <Unlock size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest mb-0.5">Admin Override Active</p>
                        <p className="text-[10px] font-bold text-red-600/80 dark:text-red-400/80 leading-snug">This amount exceeds the dynamic 30% limit. Managers require approval for this, but as an Admin, you may proceed.</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleLogTransaction} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Transaction Type</label>
                      <div className="relative">
                        <select required value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer">
                          {Object.entries(TYPE_MAP).map(([val, cfg]) => (
                            <option key={val} value={val}>{cfg.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black font-mono">₹</span>
                        <input required type="number" step="0.01" min="1" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" className="w-full bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl py-3 pl-8 pr-4 text-base font-black font-mono text-orange-700 dark:text-orange-400 outline-none focus:ring-2 focus:ring-orange-500/50" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Mandatory Remarks</label>
                      <textarea required value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} placeholder="Reason for this transaction..." className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-20 custom-scrollbar" />
                    </div>

                    <button type="submit" disabled={formSubmitting} className="w-full py-3.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
                      {formSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} strokeWidth={3} />}
                      Submit Record
                    </button>
                  </form>
                </div>

                {/* RIGHT SIDE: PERSONAL HISTORY */}
                <div className="w-full md:w-1/2 p-5 md:p-6 overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-[#050505]">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-5 flex items-center gap-2"><History size={14} className="text-blue-500" /> Current Month History</h3>
                  
                  {activeUserModal.txns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                      <History size={32} className="text-gray-400 mb-3" />
                      <p className="text-sm font-bold text-gray-500">No transactions recorded.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 pb-safe">
                      {activeUserModal.txns.map(txn => {
                        const T = TYPE_MAP[txn.type] || TYPE_MAP.other;
                        return (
                          <div key={txn.id} className="bg-white dark:bg-[#111] border border-gray-100 dark:border-neutral-800 p-4 rounded-2xl shadow-sm relative">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${T.bg} ${T.color} border-current opacity-80 mb-1`}>{T.label}</span>
                                <p className={`font-mono font-black text-lg leading-none ${T.color}`}>{formatCurrency(txn.amount)}</p>
                              </div>
                              <button onClick={() => handleVoidRecord(txn.id)} disabled={formSubmitting} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 mb-3 leading-snug">{txn.remarks}</p>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-50 dark:border-neutral-900 pt-2">
                              Logged: {new Date(txn.created_at).toLocaleDateString('en-IN', {month:'short', day:'numeric'})} by {txn.logged_by_name || 'System'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}