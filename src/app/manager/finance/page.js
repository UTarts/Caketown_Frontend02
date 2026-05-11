"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import { canRead, canWrite } from "@/lib/permissions";
import {
  Banknote, Calendar, ChevronDown, Search, Wallet, CheckCircle2, 
  AlertTriangle, X, History, Loader2, Plus, Trash2, ArrowDownRight, 
  ArrowUpRight, FileText, UserCircle, IndianRupee, ShieldAlert, Lock
} from "lucide-react";

const formatCurrency = (val) => `₹${parseFloat(val || 0).toLocaleString("en-IN")}`;

const TYPE_MAP = {
  pre_advance: { label: "Pre-Advance", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", icon: ArrowDownRight },
  final_advance: { label: "Final Advance", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", icon: ArrowDownRight },
  shop_advance: { label: "Shop Adv", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", icon: ArrowDownRight },
  shop_bill: { label: "Shop Bill", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", icon: FileText },
  fine: { label: "Fine/Penalty", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10", icon: AlertTriangle },
  repayment: { label: "Repayment", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", icon: ArrowUpRight },
  other: { label: "Other", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800", icon: Banknote },
};

export default function ManagerFinanceHub() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  
  const now = new Date();
  const [finMonth, setFinMonth] = useState(now.getMonth() + 1);
  const [finYear, setFinYear] = useState(now.getFullYear());
  
  const [activeTab, setActiveTab] = useState("employees"); 
  
  const [users, setUsers] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [activeUserModal, setActiveUserModal] = useState(null);
  const [formType, setFormType] = useState("pre_advance");
  const [formAmount, setFormAmount] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) { router.push("/"); return; }
    try {
      const parsed = JSON.parse(raw);
      if (!canRead(parsed.feature_permissions, 'view_finance_ledger')) {
        router.push("/manager/dashboard"); return;
      }
      setSession(parsed);
    } catch { router.push("/"); }
  }, [router]);

  const loadData = useCallback(async () => {
    if (!session?.branch_id) return;
    setLoading(true);
    const [uRes, lRes] = await Promise.all([
      callApi("get_branch_staff", { branch_id: session.branch_id }),
      callApi("get_branch_financial_ledger", { branch_id: session.branch_id, month: finMonth, year: finYear })
    ]);
    
    if (uRes.status === "success") setUsers((uRes.data || []).filter(u => u.status === 'active' && u.role !== 'admin'));
    if (lRes.status === "success") setLedgerData(lRes.data || []);
    setLoading(false);
  }, [session?.branch_id, finMonth, finYear]);

  useEffect(() => { if (session) loadData(); }, [session, loadData]);

  // SMART CALCULATIONS & 30% LIMIT TRACKING
  const employeeBalances = useMemo(() => {
    let filteredUsers = users;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredUsers = filteredUsers.filter(u => u.name.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q));
    }

    return filteredUsers.map(user => {
      const userTxns = ledgerData.filter(l => String(l.user_id) === String(user.id));
      const balances = { pre_advance: 0, final_advance: 0, shop_advance: 0, shop_bill: 0, fine: 0, repayment: 0, other: 0, total_deduction: 0 };

      userTxns.forEach(txn => {
        const amt = parseFloat(txn.amount || 0);
        if (balances[txn.type] !== undefined) balances[txn.type] += amt;
        if (txn.type === 'repayment') balances.total_deduction -= amt;
        else balances.total_deduction += amt;
      });

      const salary = parseFloat(user.monthly_fixed_salary || user.salary || 0);
      const maxAdv = salary * 0.30;
      const takenAdv = balances.pre_advance + balances.final_advance + balances.shop_advance;
      const availAdv = Math.max(0, maxAdv - takenAdv);

      return { ...user, txns: userTxns, balances, maxAdv, takenAdv, availAdv, salary };
    });
  }, [users, ledgerData, searchQuery]);

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
      alert("Please fill all required fields correctly."); return;
    }

    setFormSubmitting(true);
    const res = await callApi("log_advance", {
      user_id: activeUserModal.id,
      branch_id: session.branch_id,
      type: formType,
      amount: parseFloat(formAmount),
      remarks: formRemarks,
      month: finMonth,
      year: finYear,
      actor_id: session.id 
    });
    setFormSubmitting(false);

    if (res.status === "success") {
      setFormAmount(""); setFormRemarks(""); loadData();
    } else {
      alert(res.message || "Failed to log transaction.");
    }
  };

  const handleVoidRecord = async (record_id) => {
    if (!confirm("Are you absolutely sure you want to VOID this transaction? This will reverse any auto-deductions linked to it.")) return;
    
    setFormSubmitting(true);
    const res = await callApi("delete_financial_record", { record_id, actor_id: session.id });
    setFormSubmitting(false);

    if (res.status === "success") loadData();
    else alert(res.message || "Failed to void record.");
  };

  if (!session) return null;

  // ─── PERMISSIONS MATRIX ───
  const canLogAdv = canWrite(session.feature_permissions, 'log_advance');
  const canLogBill = canWrite(session.feature_permissions, 'log_shop_bill');
  const canDelete = canWrite(session.feature_permissions, 'delete_finance_record');
  const canLogAnything = canLogAdv || canLogBill;

  // Dynamic dropdown options based on permissions
  const availableTypes = Object.keys(TYPE_MAP).filter(key => {
    if (['pre_advance', 'final_advance', 'shop_advance', 'repayment'].includes(key)) return canLogAdv;
    if (['shop_bill', 'fine', 'other'].includes(key)) return canLogBill;
    return false;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-2rem)] gap-4 md:gap-5 animate-in fade-in duration-500 text-gray-900 dark:text-neutral-200 font-sans w-full min-w-0 max-w-full overflow-hidden px-3 md:px-0">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-4 md:p-5 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm w-full shrink-0 mt-3 md:mt-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500 mb-1">
            <Wallet size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Branch Ledger</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            Finance Hub - {session.branch_name}
          </h1>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          {!canLogAnything && (
            <div className="hidden md:flex bg-yellow-50 dark:bg-yellow-500/10 px-4 py-2.5 rounded-xl border border-yellow-200 dark:border-yellow-900/50 items-center gap-2 text-yellow-700 dark:text-yellow-500 text-xs font-bold shrink-0">
               <ShieldAlert size={16}/> Read-Only
            </div>
          )}

          <div className="flex items-center bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shadow-sm shrink-0">
            <button onClick={() => setActiveTab("employees")} className={`px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${activeTab === 'employees' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              Employee Balances
            </button>
            <button onClick={() => setActiveTab("ledger")} className={`px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${activeTab === 'ledger' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              Master Ledger
            </button>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-2 shrink-0 shadow-sm">
            <Calendar size={14} className="text-orange-500" />
            <select value={finMonth} onChange={(e) => setFinMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
              {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "short" })}</option>)}
            </select>
            <select value={finYear} onChange={(e) => setFinYear(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer border-l border-gray-200 dark:border-neutral-700 pl-2 ml-2">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="relative w-full md:w-96 shrink-0">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search employee or record..." className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 transition-all shadow-sm" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: EMPLOYEE BALANCES TABLE
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "employees" && (
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm flex flex-col flex-1 min-w-0 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <Loader2 size={32} className="animate-spin text-orange-500 mb-4" />
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Aggregating Ledgers...</p>
            </div>
          ) : employeeBalances.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
              <UserCircle size={40} className="text-gray-300 dark:text-neutral-700 mb-4" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">No Personnel Found</h3>
              <p className="text-sm font-bold text-gray-500">Adjust your search or branch filters.</p>
            </div>
          ) : (
            <div className="flex-1 w-full overflow-auto custom-scrollbar relative">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap shadow-sm">
                    <th className="p-4 sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md z-40 border-r border-gray-200 dark:border-neutral-800 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">Personnel</th>
                    <th className="p-4 text-center text-blue-600 bg-blue-50/30 dark:bg-blue-900/10 border-x border-blue-100 dark:border-blue-900/30">Avail. Limit (30%)</th>
                    <th className="p-4 text-right">Pre-Advance</th>
                    <th className="p-4 text-right">Final Advance</th>
                    <th className="p-4 text-right">Shop / Bills</th>
                    <th className="p-4 text-right text-red-500">Fines</th>
                    <th className="p-4 text-right text-emerald-500">Repayments</th>
                    <th className="p-4 text-right bg-orange-50/50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-500 border-x border-orange-100 dark:border-orange-900/30">Net Month Impact</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                  {employeeBalances.map(row => {
                    const shopTotal = row.balances.shop_advance + row.balances.shop_bill;
                    const hasTransactions = row.balances.total_deduction !== 0;
                    const limitExceeded = row.availAdv <= 0;

                    return (
                      <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors group">
                        <td className="p-4 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/50 dark:group-hover:bg-[#111] z-20 border-r border-gray-100 dark:border-neutral-900 shadow-[4px_0_12px_rgba(0,0,0,0.02)] transition-colors">
                          <div className="min-w-0">
                            <p className="font-black text-sm text-gray-900 dark:text-white whitespace-nowrap mb-0.5 truncate">{row.name}</p>
                            <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest truncate">{row.department || "Staff"}</p>
                          </div>
                        </td>
                        
                        <td className="p-4 text-center bg-blue-50/10 dark:bg-blue-900/5 border-x border-blue-100 dark:border-blue-900/30">
                          {limitExceeded ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-900/50">Limit Reached</span>
                          ) : (
                            <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">{formatCurrency(row.availAdv)}</span>
                          )}
                        </td>

                        <td className="p-4 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400">{row.balances.pre_advance > 0 ? formatCurrency(row.balances.pre_advance) : "—"}</td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400">{row.balances.final_advance > 0 ? formatCurrency(row.balances.final_advance) : "—"}</td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400">{shopTotal > 0 ? formatCurrency(shopTotal) : "—"}</td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-red-500">{row.balances.fine > 0 ? formatCurrency(row.balances.fine) : "—"}</td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-emerald-500">{row.balances.repayment > 0 ? formatCurrency(row.balances.repayment) : "—"}</td>
                        
                        <td className="p-4 text-right bg-orange-50/50 dark:bg-orange-900/10 border-x border-orange-100 dark:border-orange-900/30">
                          {hasTransactions ? (
                             <span className="font-mono font-black text-lg text-orange-600 dark:text-orange-400">-{formatCurrency(row.balances.total_deduction)}</span>
                          ) : (
                             <span className="font-mono text-sm text-gray-400">—</span>
                          )}
                        </td>

                        <td className="p-4 text-center">
                          <button 
                            onClick={() => { 
                              setActiveUserModal(row); 
                              setFormType(availableTypes.length > 0 ? availableTypes[0] : "other"); 
                            }} 
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 whitespace-nowrap"
                          >
                            {canLogAnything ? <Plus size={12} strokeWidth={3}/> : <History size={12} strokeWidth={3}/>}
                            {canLogAnything ? "Log / View" : "View History"}
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

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: MASTER LEDGER
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "ledger" && (
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm flex flex-col flex-1 min-w-0 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <Loader2 size={32} className="animate-spin text-orange-500 mb-4" />
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">Syncing Master Ledger...</p>
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
              <History size={40} className="text-gray-300 dark:text-neutral-700 mb-4" />
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-1">Clean Slate</h3>
              <p className="text-xs font-bold text-gray-500 max-w-sm">No financial transactions logged for this period.</p>
            </div>
          ) : (
            <div className="flex-1 w-full overflow-auto custom-scrollbar relative bg-white dark:bg-[#0a0a0a]">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap shadow-sm">
                    <th className="p-4 border-r border-gray-200 dark:border-neutral-800 w-1/4">Entity Profile</th>
                    <th className="p-4 border-r border-gray-200 dark:border-neutral-800">Transaction Classification</th>
                    <th className="p-4 border-r border-gray-200 dark:border-neutral-800 w-1/3">Mandatory Remarks</th>
                    <th className="p-4 border-r border-gray-200 dark:border-neutral-800">Audit Trail</th>
                    {canDelete && <th className="p-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                  {filteredLedger.map((row) => {
                    const T = TYPE_MAP[row.type] || TYPE_MAP.other;
                    const Icon = T.icon;

                    return (
                      <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors group">
                        
                        <td className="p-4 border-r border-gray-100 dark:border-neutral-900 transition-colors">
                          <div className="min-w-0">
                            <p className="font-black text-sm text-gray-900 dark:text-white whitespace-nowrap mb-0.5 truncate">{row.employee_name}</p>
                            <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest truncate">{row.department}</p>
                          </div>
                        </td>

                        <td className="p-4 border-r border-gray-100 dark:border-neutral-900 transition-colors">
                           <div className="flex items-start gap-3">
                             <div className={`w-8 h-8 rounded-xl ${T.bg} ${T.color} flex items-center justify-center shrink-0`}>
                               <Icon size={14} />
                             </div>
                             <div>
                               <p className={`font-mono font-black text-base leading-none mb-1 ${T.color}`}>{formatCurrency(row.amount)}</p>
                               <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${T.bg.split(' ')[0]} border-current opacity-70`}>{T.label}</span>
                             </div>
                           </div>
                        </td>

                        <td className="p-4 border-r border-gray-100 dark:border-neutral-900 transition-colors">
                          <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">{row.remarks}</p>
                        </td>

                        <td className="p-4 border-r border-gray-100 dark:border-neutral-900 transition-colors">
                          <p className="font-mono text-xs font-bold text-gray-900 dark:text-white mb-1">{new Date(row.created_at).toLocaleString('en-IN', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</p>
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            <span className="w-3.5 h-3.5 rounded bg-gray-200 dark:bg-neutral-800 flex items-center justify-center text-gray-600 dark:text-neutral-300">{row.logged_by_name?.charAt(0) || "?"}</span>
                            {row.logged_by_name || "System"}
                          </div>
                        </td>

                        {canDelete && (
                          <td className="p-4 text-center">
                            <button onClick={() => handleVoidRecord(row.id)} title="Void Transaction" className="inline-flex items-center justify-center w-8 h-8 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 hover:border-red-500 hover:text-red-500 dark:hover:border-red-500/50 dark:hover:text-red-400 rounded-lg transition-all text-gray-400">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: LOG TRANSACTION & PERSONAL HISTORY
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
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
              
              {/* LEFT SIDE: LOG FORM */}
              <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-gray-100 dark:border-neutral-900 p-5 md:p-6 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0a0a0a]">
                
                {/* 30% ADVANCE TRACKER MODULE */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">30% Advance Limit Tracker</p>
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

                {canLogAnything ? (
                  <form onSubmit={handleLogTransaction} className="space-y-4">
                    
                    {/* HARD BLOCK WARNING (Managers cannot override) */}
                    {['pre_advance', 'final_advance', 'shop_advance'].includes(formType) && parseFloat(formAmount || 0) > activeUserModal.availAdv && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2 animate-in fade-in zoom-in-95">
                        <Lock size={14} className="text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest mb-0.5">Limit Exceeded</p>
                          <p className="text-[10px] font-bold text-red-600/80 dark:text-red-400/80 leading-snug">This amount exceeds the 30% limit. Managers cannot process this without Admin intervention.</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Transaction Type</label>
                      <div className="relative">
                        <select required value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer">
                          {availableTypes.map((val) => (
                            <option key={val} value={val}>{TYPE_MAP[val].label}</option>
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

                    <button 
                      type="submit" 
                      disabled={formSubmitting || (['pre_advance', 'final_advance', 'shop_advance'].includes(formType) && parseFloat(formAmount || 0) > activeUserModal.availAdv)} 
                      className="w-full py-3.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                    >
                      {formSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} strokeWidth={3} />}
                      Submit Record
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                    <ShieldAlert size={32} className="text-gray-400 mb-3" />
                    <p className="text-sm font-bold text-gray-500">Read-Only Mode</p>
                    <p className="text-xs text-gray-400 mt-1">You do not have permission to log new records.</p>
                  </div>
                )}
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
                            {canDelete && (
                              <button onClick={() => handleVoidRecord(txn.id)} disabled={formSubmitting} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 size={14} />
                              </button>
                            )}
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
          </div>
        </div>
      )}

    </div>
  );
}