"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Banknote, Building2, Calendar, ChevronDown,
  Search, Wallet, CheckCircle2, AlertTriangle,
  X, History, Loader2, Plus, Trash2, ArrowDownRight, FileText, UserCircle, Unlock, Users, ShieldAlert, Check, XCircle
} from "lucide-react";

const formatCurrency = (val) => `₹${parseFloat(val || 0).toLocaleString("en-IN")}`;

// Consolidated UI Mapping
const TYPE_MAP = {
  pre_advance:   { label: "Advance",         color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10",  icon: ArrowDownRight },
  final_advance: { label: "Advance (Old)",   color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10",  icon: ArrowDownRight },
  shop_advance:  { label: "Shop Adv (Old)",  color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10",  icon: ArrowDownRight },
  shop_bill:     { label: "Shop Bill",       color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",   icon: FileText },
  fine:          { label: "Fine/Penalty",    color: "text-red-600 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-500/10",       icon: AlertTriangle },
  other:         { label: "Other",           color: "text-gray-600 dark:text-gray-400",     bg: "bg-gray-100 dark:bg-gray-800",       icon: Banknote },
};

// Only these options will be shown to the user when logging
const ACTIVE_LOG_TYPES = ["pre_advance", "shop_bill", "fine", "other"];

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

export default function FinanceLoggingHub() {
  const searchParams = useSearchParams();
  const initialBranchId = searchParams.get("branch_id") || "all";

  const [session, setSession] = useState(null);
  const now = new Date();
  const [finMonth, setFinMonth] = useState(now.getMonth() + 1);
  const [finYear, setFinYear] = useState(now.getFullYear());

  const [activeTab, setActiveTab] = useState("employees");

  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);

  const [ledgerData, setLedgerData] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState(initialBranchId);
  const [searchQuery, setSearchQuery] = useState("");

  const [activeUserModal, setActiveUserModal] = useState(null);
  const [formType, setFormType] = useState("pre_advance");
  const [formAmount, setFormAmount] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formPaymentMode, setFormPaymentMode] = useState("Cash");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [resolvingId, setResolvingId] = useState(null); 
  
  const [historyModal, setHistoryModal] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) return;
    try { setSession(JSON.parse(raw)); } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [bRes, uRes, lRes, aRes, reqRes] = await Promise.all([
      callApi("get_branches"),
      callApi("get_users"),
      callApi("get_branch_financial_ledger", { branch_id: branchFilter, month: finMonth, year: finYear }),
      callApi("get_monthly_attendance", { branch_id: branchFilter, month: finMonth, year: finYear }),
      callApi("get_advance_requests", { branch_id: branchFilter }) 
    ]);
    if (bRes.status === "success") setBranches(bRes.data || []);
    if (uRes.status === "success") {
      setUsers((uRes.data || []).filter(u => u.status === 'active' && String(u.role).toLowerCase() !== 'admin'));
    }
    if (lRes.status === "success") setLedgerData(lRes.data || []);
    if (aRes.status === "success") setAttendanceData(aRes.data || []);
    if (reqRes.status === "success") setPendingRequests(reqRes.data || []); 
    setLoading(false);
  }, [branchFilter, finMonth, finYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleResolveRequest = async (record_id, status) => {
    setResolvingId(record_id);
    const res = await callApi("resolve_advance_request", { record_id, status, admin_id: session?.id });
    if (res.status === 'success') {
      loadData();
    } else {
      alert(res.message || "Failed to resolve request");
    }
    setResolvingId(null);
  };

  const employeeBalances = useMemo(() => {
    const daysInMonth = new Date(finYear, finMonth, 0).getDate();
    let filteredUsers = users;
    
    if (branchFilter !== "all") {
      filteredUsers = filteredUsers.filter(u => String(u.branch_id) === String(branchFilter));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredUsers = filteredUsers.filter(u => u.name.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q));
    }
    
    return filteredUsers.map(user => {
      const userTxns = ledgerData.filter(l => String(l.user_id) === String(user.id));
      const balances = { advance: 0, shop_bill: 0, fine: 0, other: 0, total_deduction: 0 };
      
      userTxns.forEach(txn => {
        const amt = parseFloat(txn.amount || 0);
        if (['pre_advance', 'final_advance', 'shop_advance'].includes(txn.type)) {
            balances.advance += amt;
        } else if (balances[txn.type] !== undefined) {
            balances[txn.type] += amt;
        }
        balances.total_deduction += amt;
      });

      const userAtt = attendanceData.find(a => String(a.id) === String(user.id));
      const isPaid = userAtt?.ledger_status === 'paid' || userAtt?.status === 'paid';

      const daysWorked = parseFloat(userAtt?.total_duty || userAtt?.days_worked || userAtt?.present || 0);
      const leaveCap = parseInt(user.max_paid_leaves_cap || user.max_paid_leaves || 4);
      const paidLeaves = calcPaidLeaves(daysWorked, leaveCap);
      const totalPaidDays = Math.min(daysInMonth, daysWorked + paidLeaves);
      const fixedSalary = parseFloat(user.monthly_fixed_salary || user.salary || 0);
      const perDayRate = daysInMonth > 0 ? fixedSalary / daysInMonth : 0;
      
      const grossEarned = perDayRate * totalPaidDays;
      const staticDeductions = balances.shop_bill + balances.fine + balances.other;
      const netPayable = Math.max(0, grossEarned - staticDeductions);
      const maxAdv = netPayable * 0.30;
      const availAdv = Math.max(0, maxAdv - balances.advance);
      
      return { ...user, txns: userTxns, balances, fixedSalary, grossEarned, netPayable, maxAdv, takenAdv: balances.advance, availAdv, isPaid };
    });
  }, [users, ledgerData, attendanceData, branchFilter, searchQuery, finMonth, finYear]);

  const globalFilteredUsers = useMemo(() => {
    if (!globalSearchQuery) return users;
    const q = globalSearchQuery.toLowerCase();
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      branches.find(b => b.id === u.branch_id)?.branch_name?.toLowerCase().includes(q)
    );
  }, [users, globalSearchQuery, branches]);

  const filteredLedger = useMemo(() => {
    if (!searchQuery) return ledgerData;
    const q = searchQuery.toLowerCase();
    return ledgerData.filter(r =>
      r.employee_name?.toLowerCase().includes(q) ||
      r.remarks?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q)
    );
  }, [ledgerData, searchQuery]);

  const handleLogTransaction = async (e) => {
    e.preventDefault();
    if (!formAmount || parseFloat(formAmount) <= 0 || !formRemarks.trim()) {
      alert("Please fill all required fields correctly.");
      return;
    }
    setFormSubmitting(true);
    
    const isExceedingLimit = parseFloat(formAmount || 0) > (activeUserModal?.availAdv || 0) && ['pre_advance', 'final_advance', 'shop_advance'].includes(formType);
    const endpoint = isExceedingLimit ? "request_advance" : "log_advance";
    
    const res = await callApi(endpoint, {
      user_id: activeUserModal.id,
      branch_id: activeUserModal.branch_id,
      type: formType,
      amount: parseFloat(formAmount),
      remarks: formRemarks,
      payment_mode: formPaymentMode,
      month: finMonth,
      year: finYear,
      admin_id: session?.id
    });
    
    setFormSubmitting(false);
    if (res.status === "success") {
      setFormAmount("");
      setFormRemarks("");
      loadData();
      if (!isExceedingLimit) setActiveUserModal(null); 
    } else {
      alert(res.message || "Failed to process transaction.");
    }
  };

  const handleVoidRecord = async (record_id) => {
    if (!confirm("Are you absolutely sure you want to VOID this transaction? This will reverse any auto-deductions linked to it.")) return;
    setFormSubmitting(true);
    const res = await callApi("delete_financial_record", { record_id, admin_id: session?.id });
    setFormSubmitting(false);
    if (res.status === "success") {
       loadData(); 
       if (historyModal) setHistoryModal(null);
    } else { 
       alert(res.message || "Failed to void record."); 
    }
  };

  // ASYNC FETCH PREVENTS CRASHES ON CROSS-BRANCH USERS
  const openUserFinanceModal = async (user) => {
    setSearchModalOpen(false);
    setGlobalSearchQuery("");
    setActiveUserModal({ ...user, loading: true });
    setFormType("pre_advance");
    setFormPaymentMode("Cash");

    // Pull accurate cross-branch data on the fly
    const [finRes, attRes] = await Promise.all([
      callApi("get_branch_financial_ledger", { branch_id: user.branch_id, month: finMonth, year: finYear }),
      callApi("get_monthly_attendance", { branch_id: user.branch_id, month: finMonth, year: finYear })
    ]);

    const freshLedger = finRes.data || [];
    const freshAtt = attRes.data || [];
    const daysInMonth = new Date(finYear, finMonth, 0).getDate();

    const userTxns = freshLedger.filter(l => String(l.user_id) === String(user.id));
    const balances = { advance: 0, shop_bill: 0, fine: 0, other: 0, total_deduction: 0 };
    
    userTxns.forEach(txn => {
      const amt = parseFloat(txn.amount || 0);
      if (['pre_advance', 'final_advance', 'shop_advance'].includes(txn.type)) {
          balances.advance += amt;
      } else if (balances[txn.type] !== undefined) {
          balances[txn.type] += amt;
      }
      balances.total_deduction += amt;
    });

    const userAtt = freshAtt.find(a => String(a.id) === String(user.id));
    const isPaid = userAtt?.ledger_status === 'paid' || userAtt?.status === 'paid';
    const daysWorked = parseFloat(userAtt?.total_duty || userAtt?.days_worked || userAtt?.present || 0);
    const leaveCap = parseInt(user.max_paid_leaves_cap || user.max_paid_leaves || 4);
    const paidLeaves = calcPaidLeaves(daysWorked, leaveCap);
    const totalPaidDays = Math.min(daysInMonth, daysWorked + paidLeaves);
    const fixedSalary = parseFloat(user.monthly_fixed_salary || user.salary || 0);
    const perDayRate = daysInMonth > 0 ? fixedSalary / daysInMonth : 0;
    
    const grossEarned = perDayRate * totalPaidDays;
    const staticDeductions = balances.shop_bill + balances.fine + balances.other;
    const netPayable = Math.max(0, grossEarned - staticDeductions);
    const maxAdv = netPayable * 0.30;
    const availAdv = Math.max(0, maxAdv - balances.advance);

    setActiveUserModal({ 
      ...user, 
      txns: userTxns, 
      balances, 
      fixedSalary, 
      grossEarned, 
      netPayable, 
      maxAdv, 
      takenAdv: balances.advance, 
      availAdv, 
      isPaid, 
      loading: false 
    });
  };

  const openHistoryModal = (user, typesArray, label) => {
    const txns = ledgerData.filter(l => String(l.user_id) === String(user.id) && typesArray.includes(l.type));
    setHistoryModal({ user, label, data: txns });
  };

  return (
    <div className="w-full overflow-hidden box-border flex flex-col gap-4 pb-24 md:pb-0 animate-in fade-in duration-500">

      {/* HEADER CARD */}
      <div className="w-full box-border bg-white/60 dark:bg-neutral-900/40 backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 rounded-3xl shadow-sm p-4 md:p-5">
        <div className="mb-4">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500 mb-1">
            <Wallet size={14} className="shrink-0" />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase">Master Ledger</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Finance &amp; Transaction Hub
          </h1>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shadow-sm w-full">
            <button onClick={() => setActiveTab("employees")} className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-black transition-all min-h-[44px] ${activeTab === 'employees' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              Employee Balances
            </button>
            <button onClick={() => setActiveTab("ledger")} className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-black transition-all min-h-[44px] ${activeTab === 'ledger' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              Master Ledger
            </button>
          </div>

          <div className="flex items-center gap-3 w-full">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 shadow-sm flex-1 min-w-0 min-h-[44px]">
              <Calendar size={14} className="text-orange-500 shrink-0" />
              <select value={finMonth} onChange={(e) => setFinMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer min-w-0">
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "short" })}</option>
                ))}
              </select>
              <span className="text-gray-300 dark:text-neutral-700">|</span>
              <select value={finYear} onChange={(e) => setFinYear(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer min-w-0">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button onClick={() => setSearchModalOpen(true)} className="flex items-center justify-center gap-1.5 px-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-black rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all shrink-0 min-h-[44px] whitespace-nowrap">
              <Plus size={14} strokeWidth={3} />
              <span>Log Transaction</span>
            </button>
          </div>
        </div>
      </div>

      {/* PENDING APPROVALS PANEL */}
      {pendingRequests.length > 0 && (
        <div className="bg-white dark:bg-[#0a0a0a] border border-indigo-200 dark:border-indigo-900/50 rounded-2xl md:rounded-[2rem] shadow-lg shadow-indigo-500/10 overflow-hidden relative">
           <div className="p-4 md:p-6 bg-indigo-50/50 dark:bg-indigo-500/5 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center animate-pulse"><ShieldAlert size={20}/></div>
              <div>
                 <h2 className="text-lg font-black text-indigo-900 dark:text-indigo-100">Manager Approvals Required</h2>
                 <p className="text-xs font-bold text-indigo-600/80 dark:text-indigo-400/80">These requests exceed the 30% safety limit and require your authorization.</p>
              </div>
           </div>
           <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pendingRequests.map(req => {
                 const T = TYPE_MAP[req.type] || TYPE_MAP.other;
                 return (
                   <div key={req.id} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                      {resolvingId === req.id && <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-10 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={24}/></div>}
                      <div>
                        <div className="flex items-start justify-between mb-3">
                           <div>
                             <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${T.bg} ${T.color} border-current mb-1`}>{T.label}</span>
                             <p className={`font-mono font-black text-2xl leading-none ${T.color}`}>{formatCurrency(req.amount)}</p>
                           </div>
                           <div className="text-right">
                             <p className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[120px]">{req.user_name}</p>
                             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{req.branch_name}</p>
                           </div>
                        </div>
                        <div className="mb-4 bg-gray-50 dark:bg-[#050505] p-3 rounded-xl border border-gray-100 dark:border-neutral-900">
                           <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 leading-relaxed break-words">{req.remarks}</p>
                           <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-neutral-800">
                             <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Requested by: {req.manager_name}</p>
                             <p className="text-[9px] font-bold text-gray-500">{req.payment_mode || 'Cash'}</p>
                           </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-auto">
                         <button onClick={() => handleResolveRequest(req.id, 'rejected')} className="flex items-center justify-center gap-1.5 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 text-xs font-black uppercase tracking-widest rounded-xl transition-colors"><XCircle size={14}/> Reject</button>
                         <button onClick={() => handleResolveRequest(req.id, 'approved')} className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-md shadow-emerald-500/20"><Check size={14} strokeWidth={3}/> Approve</button>
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>
      )}

      {/* FILTERS ROW */}
      <div className="flex flex-col sm:flex-row gap-3 w-full box-border">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee or record..."
            className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 transition-all shadow-sm box-border"
          />
        </div>
        <div className="relative w-full sm:w-56 shrink-0">
          <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-11 pr-8 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 transition-all appearance-none cursor-pointer shadow-sm box-border"
          >
            <option value="all">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* TAB 1 — EMPLOYEE BALANCES */}
      {activeTab === "employees" && (
        <div className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col overflow-hidden box-border" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-orange-500 mb-4" />
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Aggregating Ledgers...</p>
            </div>
          ) : employeeBalances.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-4 py-20">
              <UserCircle size={40} className="text-gray-300 dark:text-neutral-700 mb-4" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">No Personnel Found</h3>
              <p className="text-sm font-bold text-gray-500">Adjust your filters.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="text-left border-collapse" style={{ minWidth: '1000px', width: '100%' }}>
                <thead className="sticky top-0 z-30">
                  <tr className="bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md border-b border-gray-300 dark:border-neutral-700 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    <th className="p-4 sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 z-40 border-r border-gray-300 dark:border-neutral-700">Personnel</th>
                    <th className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">Fixed Salary</th>
                    <th className="p-4 text-right text-emerald-600 border-r border-gray-300 dark:border-neutral-700">Net Earned</th>
                    <th className="p-4 text-center text-blue-600 bg-blue-50/30 dark:bg-blue-900/10 border-x border-blue-300 dark:border-blue-700/50">Dynamic Limit (30%)</th>
                    <th className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">Advance</th>
                    <th className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">Shop Bill</th>
                    <th className="p-4 text-right text-red-500 border-r border-gray-300 dark:border-neutral-700">Fines / Other</th>
                    <th className="p-4 text-right bg-orange-50/50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-500 border-x border-orange-300 dark:border-orange-700/50">Deductions</th>
                    <th className="p-4 text-center sticky right-0 bg-gray-50/95 dark:bg-[#050505]/95 z-40 border-l border-gray-300 dark:border-neutral-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 dark:divide-neutral-700">
                  {employeeBalances.map(row => {
                    const fineTotal = row.balances.fine + row.balances.other;
                    const hasTransactions = row.balances.total_deduction !== 0;
                    const limitExceeded = row.availAdv <= 0;
                    
                    return (
                      <tr key={row.id} className={`hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors group ${row.isPaid ? 'opacity-80' : ''}`}>
                        <td className="p-4 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50 dark:group-hover:bg-[#111] z-20 border-r border-gray-300 dark:border-neutral-700 transition-colors">
                          <p className="font-black text-sm text-gray-900 dark:text-white whitespace-nowrap mb-0.5">{row.name}</p>
                          <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest">{row.department || "Staff"}</p>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400 border-r border-gray-300 dark:border-neutral-700">{formatCurrency(row.fixedSalary)}</td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-emerald-600 border-r border-gray-300 dark:border-neutral-700">{formatCurrency(row.netPayable)}</td>
                        <td className="p-4 text-center bg-blue-50/10 dark:bg-blue-900/5 border-x border-blue-300 dark:border-blue-700/50">
                          {limitExceeded ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-900/50 whitespace-nowrap">Limit Reached</span>
                          ) : (
                            <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">{formatCurrency(row.availAdv)}</span>
                          )}
                        </td>
                        
                        <td className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">
                          {row.balances.advance > 0 ? (
                            <button onClick={() => openHistoryModal(row, ['pre_advance', 'final_advance', 'shop_advance'], 'Advance')} className="font-mono font-black text-sm text-orange-600 hover:underline bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 rounded-lg">
                              {formatCurrency(row.balances.advance)}
                            </button>
                          ) : "—"}
                        </td>
                        <td className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">
                           {row.balances.shop_bill > 0 ? (
                            <button onClick={() => openHistoryModal(row, ['shop_bill'], 'Shop Bills')} className="font-mono font-black text-sm text-amber-600 hover:underline bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg">
                              {formatCurrency(row.balances.shop_bill)}
                            </button>
                          ) : "—"}
                        </td>
                        <td className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">
                           {fineTotal > 0 ? (
                            <button onClick={() => openHistoryModal(row, ['fine', 'other'], 'Fines & Others')} className="font-mono font-black text-sm text-red-500 hover:underline bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-lg">
                              {formatCurrency(fineTotal)}
                            </button>
                          ) : "—"}
                        </td>
                        
                        <td className="p-4 text-right bg-orange-50/50 dark:bg-orange-900/10 border-x border-orange-300 dark:border-orange-700/50">
                          {hasTransactions ? (
                            <span className="font-mono font-black text-lg text-orange-600 dark:text-orange-400 whitespace-nowrap">-{formatCurrency(row.balances.total_deduction)}</span>
                          ) : (
                            <span className="font-mono text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-4 text-center sticky right-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50 dark:group-hover:bg-[#111] z-20 border-l border-gray-300 dark:border-neutral-700 transition-colors">
                          {row.isPaid ? (
                             <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800/50 shadow-sm whitespace-nowrap">
                               <CheckCircle2 size={12} strokeWidth={3} /> Paid Lock
                             </span>
                          ) : (
                             <button
                               onClick={() => openUserFinanceModal(row)}
                               className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 whitespace-nowrap min-h-[40px]"
                             >
                               <Plus size={11} strokeWidth={3}/> Log Record
                             </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2 — MASTER LEDGER */}
      {activeTab === "ledger" && (
        <div className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col overflow-hidden box-border" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-orange-500 mb-4" />
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">Syncing Master Ledger...</p>
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-4 py-20">
              <History size={40} className="text-gray-300 dark:text-neutral-700 mb-4" />
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">Clean Slate</h3>
              <p className="text-xs font-bold text-gray-500 max-w-sm">No transactions for this period.</p>
            </div>
          ) : (
            <div className="overflow-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="text-left border-collapse" style={{ minWidth: '800px', width: '100%' }}>
                <thead className="sticky top-0 z-30">
                  <tr className="bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md border-b border-gray-300 dark:border-neutral-700 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    <th className="p-4 border-r border-gray-300 dark:border-neutral-700">Entity Profile</th>
                    <th className="p-4 border-r border-gray-300 dark:border-neutral-700">Transaction</th>
                    <th className="p-4 border-r border-gray-300 dark:border-neutral-700">Remarks</th>
                    <th className="p-4 border-r border-gray-300 dark:border-neutral-700">Audit Trail</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 dark:divide-neutral-700">
                  {filteredLedger.map((row) => {
                    const T = TYPE_MAP[row.type] || TYPE_MAP.other;
                    const Icon = T.icon;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors group">
                        <td className="p-4 border-r border-gray-300 dark:border-neutral-700">
                          <p className="font-black text-sm text-gray-900 dark:text-white whitespace-nowrap mb-0.5">{row.employee_name}</p>
                          <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">{row.branch_name} • {row.department}</p>
                        </td>
                        <td className="p-4 border-r border-gray-300 dark:border-neutral-700">
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-xl ${T.bg} ${T.color} flex items-center justify-center shrink-0`}>
                              <Icon size={14} />
                            </div>
                            <div>
                              <p className={`font-mono font-black text-base leading-none mb-1 ${T.color}`}>{formatCurrency(row.amount)}</p>
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${T.bg} ${T.color}`}>{T.label}</span>
                                <span className="text-[9px] font-bold text-gray-500">{row.payment_mode || 'Cash'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 border-r border-gray-300 dark:border-neutral-700">
                          <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">{row.remarks}</p>
                        </td>
                        <td className="p-4 border-r border-gray-300 dark:border-neutral-700">
                          <p className="font-mono text-xs font-bold text-gray-900 dark:text-white mb-1">
                            {new Date(row.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            <span className="w-3.5 h-3.5 rounded bg-gray-200 dark:bg-neutral-800 flex items-center justify-center text-gray-600 dark:text-neutral-300 shrink-0">{row.logged_by_name?.charAt(0) || "?"}</span>
                            {row.logged_by_name || "System"}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => handleVoidRecord(row.id)} title="Void Transaction" className="inline-flex items-center justify-center w-9 h-9 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 hover:border-red-50 hover:text-red-500 rounded-lg transition-all text-gray-400">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GLOBAL SEARCH MODAL */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-2xl max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col border border-gray-200 dark:border-neutral-800 overflow-hidden">
            <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
              <div className="w-10 h-1 bg-gray-300 dark:bg-neutral-700 rounded-full" />
            </div>
            <div className="p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111] shrink-0 flex items-center gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input autoFocus value={globalSearchQuery} onChange={(e) => setGlobalSearchQuery(e.target.value)} placeholder="Search by name, branch, or department..." className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm box-border" />
              </div>
              <button onClick={() => { setSearchModalOpen(false); setGlobalSearchQuery(""); }} className="p-2.5 bg-gray-100 dark:bg-neutral-900 rounded-xl hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {globalFilteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center opacity-50">
                  <Users size={32} className="text-gray-400 mb-3" />
                  <p className="text-sm font-bold text-gray-500">No personnel found.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {globalFilteredUsers.map(u => {
                    const branchName = branches.find(b => b.id === u.branch_id)?.branch_name || 'Unknown Branch';
                    return (
                      <button key={u.id} onClick={() => openUserFinanceModal(u)} className="w-full flex items-center justify-between p-3 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl transition-colors text-left group min-h-[60px]">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center shrink-0 border border-gray-200 dark:border-neutral-800">
                            <span className="font-black text-sm text-gray-600 dark:text-neutral-400">{u.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-sm text-gray-900 dark:text-white truncate">{u.name}</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{branchName} • {u.department || 'Staff'}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-mono text-xs font-bold text-gray-500">{u.mobile_number}</p>
                          <span className="text-[10px] font-black text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 mt-0.5">
                            Select <ArrowDownRight size={12}/>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* USER FINANCE MODAL */}
      {activeUserModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-4xl max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col overflow-hidden">
            <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
              <div className="w-10 h-1 bg-gray-300 dark:bg-neutral-700 rounded-full" />
            </div>
            <div className="p-4 md:p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/10 text-orange-500 flex items-center justify-center shrink-0">
                  <UserCircle size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900 dark:text-white leading-tight">{activeUserModal.name}</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Finance Profile</p>
                </div>
              </div>
              <button onClick={() => { setActiveUserModal(null); setFormAmount(""); setFormRemarks(""); }} className="p-2.5 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            {activeUserModal.loading ? (
               <div className="flex justify-center items-center py-28 flex-1"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
            ) : (
               <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
                 {/* LEFT: LOG FORM */}
                 <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-gray-100 dark:border-neutral-900 p-4 md:p-6 overflow-y-auto bg-white dark:bg-[#0a0a0a]">
                   
                   {activeUserModal.isPaid && (
                     <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-start gap-3">
                       <CheckCircle2 className="text-emerald-500 mt-0.5" size={20}/>
                       <div>
                          <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 uppercase">Salary Locked & Paid</p>
                          <p className="text-xs font-bold text-emerald-600/80 dark:text-emerald-400/80 mt-1 leading-snug">The financial ledger for {new Date(0, finMonth-1).toLocaleString('en-IN', {month:'long'})} is permanently locked because the salary has been paid. Adjust the global month filter to next month to log new records.</p>
                       </div>
                     </div>
                   )}
                   
                   <div className="mb-6 p-4 bg-gray-50 dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-neutral-800">
                     <div className="flex items-center justify-between mb-3">
                       <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">30% Dynamic Limit</p>
                       <p className="font-mono text-xs font-black text-gray-900 dark:text-white">Max: {formatCurrency(activeUserModal.maxAdv)}</p>
                     </div>
                     <div className="w-full h-2.5 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden flex mb-2">
                       <div style={{ width: `${Math.min((activeUserModal.takenAdv / activeUserModal.maxAdv) * 100, 100)}%` }} className="h-full bg-orange-500 transition-all" />
                     </div>
                     <div className="flex justify-between items-center text-[10px] font-bold">
                       <span className="text-orange-600 dark:text-orange-400">Consumed: {formatCurrency(activeUserModal.takenAdv)}</span>
                       <span className="text-emerald-600 dark:text-emerald-400">Available: {formatCurrency(activeUserModal.availAdv)}</span>
                     </div>
                     <div className="mt-3 pt-3 border-t border-gray-200 dark:border-neutral-800">
                       <p className="text-[9px] font-bold text-gray-400">
                         Net Earned: <span className="text-gray-700 dark:text-neutral-300 font-mono">{formatCurrency(activeUserModal.netPayable)}</span>
                       </p>
                     </div>
                   </div>

                   {!activeUserModal.isPaid && ['pre_advance', 'final_advance', 'shop_advance'].includes(formType) && parseFloat(formAmount || 0) > activeUserModal.availAdv && (
                     <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2 animate-in fade-in zoom-in-95">
                       <Unlock size={14} className="text-red-500 mt-0.5 shrink-0" />
                       <div>
                         <p className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest mb-0.5">Admin Override Active</p>
                         <p className="text-[10px] font-bold text-red-600/80 dark:text-red-400/80 leading-snug">Amount exceeds the 30% dynamic limit. As Admin, you may proceed directly.</p>
                       </div>
                     </div>
                   )}

                   <form onSubmit={handleLogTransaction} className={`space-y-4 ${activeUserModal.isPaid ? 'opacity-50 pointer-events-none' : ''}`}>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Type</label>
                         <div className="relative">
                           <select required value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer min-h-[52px] box-border">
                             {ACTIVE_LOG_TYPES.map((val) => (
                               <option key={val} value={val}>{TYPE_MAP[val].label}</option>
                             ))}
                           </select>
                           <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                         </div>
                       </div>

                       <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Payment Mode</label>
                         <div className="relative">
                           <select required value={formPaymentMode} onChange={(e) => setFormPaymentMode(e.target.value)} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer min-h-[52px] box-border">
                             <option value="Cash">Cash</option>
                             <option value="UPI">UPI</option>
                             <option value="Bank Transfer">Bank Transfer</option>
                             <option value="Cheque">Cheque</option>
                             <option value="Deduction">Deduction (No Cash)</option>
                           </select>
                           <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                         </div>
                       </div>
                     </div>

                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Amount</label>
                       <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black font-mono pointer-events-none">₹</span>
                         <input required type="number" step="0.01" min="1" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" className="w-full bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl py-3.5 pl-8 pr-4 text-base font-black font-mono text-orange-700 dark:text-orange-400 outline-none focus:ring-2 focus:ring-orange-500/50 min-h-[52px] box-border" />
                       </div>
                     </div>

                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Mandatory Remarks</label>
                       <textarea required value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} placeholder="Reason for this transaction..." className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-20 box-border" />
                     </div>

                     <button type="submit" disabled={formSubmitting || activeUserModal.isPaid} className="w-full py-4 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4 min-h-[52px]">
                       {formSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} strokeWidth={3} />}
                       Submit Record
                     </button>
                   </form>
                 </div>

                 {/* RIGHT: PERSONAL HISTORY */}
                 <div className="w-full md:w-1/2 p-4 md:p-6 overflow-y-auto bg-gray-50/50 dark:bg-[#050505]">
                   <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-5 flex items-center gap-2">
                     <History size={14} className="text-blue-500" /> Current Month History
                   </h3>
                   {activeUserModal.txns.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                       <History size={32} className="text-gray-400 mb-3" />
                       <p className="text-sm font-bold text-gray-500">No transactions recorded.</p>
                     </div>
                   ) : (
                     <div className="space-y-3">
                       {activeUserModal.txns.map(txn => {
                         const T = TYPE_MAP[txn.type] || TYPE_MAP.other;
                         return (
                           <div key={txn.id} className="bg-white dark:bg-[#111] border border-gray-100 dark:border-neutral-800 p-4 rounded-2xl shadow-sm">
                             <div className="flex justify-between items-start mb-2">
                               <div>
                                 <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${T.bg} ${T.color} mb-1`}>{T.label}</span>
                                 <p className={`font-mono font-black text-lg leading-none ${T.color}`}>{formatCurrency(txn.amount)}</p>
                               </div>
                               <button onClick={() => handleVoidRecord(txn.id)} disabled={formSubmitting || activeUserModal.isPaid} className={`p-2 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${activeUserModal.isPaid ? 'text-gray-300 dark:text-neutral-700 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'}`}>
                                 <Trash2 size={14} />
                               </button>
                             </div>
                             <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 mb-3 leading-snug">{txn.remarks}</p>
                             <div className="flex items-center justify-between border-t border-gray-50 dark:border-neutral-900 pt-2">
                               <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                 {new Date(txn.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} · {txn.logged_by_name || 'System'}
                               </p>
                               <p className="text-[9px] font-bold text-gray-500">{txn.payment_mode || 'Cash'}</p>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   )}
                 </div>
               </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY / LOG VIEWER MODAL */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md max-h-[85dvh] flex flex-col rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2"><History size={16} className="text-blue-500" /> {historyModal.label} History</h2>
              <button onClick={() => setHistoryModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors"><X size={16} /></button>
            </div>
            
            <div className="p-6 bg-gray-50 dark:bg-[#111] border-b border-gray-100 dark:border-neutral-900 shrink-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Entity Profile</p>
              <p className="font-black text-gray-900 dark:text-white text-lg">{historyModal.user.name}</p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">{new Date(0, finMonth - 1).toLocaleString('en-IN', {month:'long'})} {finYear}</p>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 pb-safe space-y-4">
              {historyModal.data.length === 0 ? (
                <div className="text-center text-gray-400 font-bold py-10 text-sm">No transactions found.</div>
              ) : (
                <div className="space-y-4">
                  {historyModal.data.map(txn => {
                    const T = TYPE_MAP[txn.type] || TYPE_MAP.other;
                    return (
                      <div key={txn.id} className="border border-gray-100 dark:border-neutral-800 rounded-2xl p-4 bg-white dark:bg-black shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${T.bg} ${T.color} border-current opacity-80 mb-1`}>{T.label}</span>
                            <p className={`font-mono font-black text-lg leading-none ${T.color}`}>{formatCurrency(txn.amount)}</p>
                          </div>
                          {!historyModal.user.isPaid && (
                            <button onClick={() => handleVoidRecord(txn.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-neutral-300 font-medium mb-3 leading-snug">{txn.remarks || "No remarks logged"}</p>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-neutral-900">
                          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <span className="w-5 h-5 rounded-md bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-[9px] font-black text-gray-500">{txn.logged_by_name?.charAt(0) || "?"}</span>
                            <span>{txn.logged_by_name || "System"}</span>
                          </div>
                          <p className="text-[9px] font-bold text-gray-500">{txn.payment_mode || 'Cash'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}