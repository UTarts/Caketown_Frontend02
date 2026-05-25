"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Banknote, Building2, Calendar, ChevronDown,
  Search, Wallet, CheckCircle2, AlertTriangle,
  X, History, Loader2, Plus, Trash2, ArrowDownRight, FileText, UserCircle, Unlock, Users
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState(initialBranchId);
  const [searchQuery, setSearchQuery] = useState("");

  const [activeUserModal, setActiveUserModal] = useState(null);
  const [formType, setFormType] = useState("pre_advance");
  const [formAmount, setFormAmount] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) return;
    try { setSession(JSON.parse(raw)); } catch {}
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [bRes, uRes, lRes, aRes] = await Promise.all([
      callApi("get_branches"),
      callApi("get_users"),
      callApi("get_branch_financial_ledger", { branch_id: branchFilter, month: finMonth, year: finYear }),
      callApi("get_monthly_attendance", { branch_id: branchFilter, month: finMonth, year: finYear })
    ]);
    if (bRes.status === "success") setBranches(bRes.data || []);
    if (uRes.status === "success") {
      setUsers((uRes.data || []).filter(u => u.status === 'active' && String(u.role).toLowerCase() !== 'admin'));
    }
    if (lRes.status === "success") setLedgerData(lRes.data || []);
    if (aRes.status === "success") setAttendanceData(aRes.data || []);
    setLoading(false);
  }, [branchFilter, finMonth, finYear]);

  useEffect(() => { loadData(); }, [loadData]);

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
      const balances = { pre_advance: 0, final_advance: 0, shop_advance: 0, shop_bill: 0, fine: 0, other: 0, total_deduction: 0 };
      userTxns.forEach(txn => {
        const amt = parseFloat(txn.amount || 0);
        if (balances[txn.type] !== undefined) balances[txn.type] += amt;
        balances.total_deduction += amt;
      });
      const userAtt = attendanceData.find(a => String(a.id) === String(user.id));
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
      const takenAdv = balances.pre_advance + balances.final_advance + balances.shop_advance;
      const availAdv = Math.max(0, maxAdv - takenAdv);
      return { ...user, txns: userTxns, balances, fixedSalary, grossEarned, netPayable, maxAdv, takenAdv, availAdv };
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
    const res = await callApi("log_advance", {
      user_id: activeUserModal.id,
      branch_id: activeUserModal.branch_id,
      type: formType,
      amount: parseFloat(formAmount),
      remarks: formRemarks,
      month: finMonth,
      year: finYear,
      admin_id: session?.id
    });
    setFormSubmitting(false);
    if (res.status === "success") {
      setFormAmount("");
      setFormRemarks("");
      loadData();
    } else {
      alert(res.message || "Failed to log transaction.");
    }
  };

  const handleVoidRecord = async (record_id) => {
    if (!confirm("Are you absolutely sure you want to VOID this transaction?")) return;
    setFormSubmitting(true);
    const res = await callApi("delete_financial_record", { record_id, admin_id: session?.id });
    setFormSubmitting(false);
    if (res.status === "success") { loadData(); }
    else { alert(res.message || "Failed to void record."); }
  };

  const openUserFinanceModal = (user) => {
    setSearchModalOpen(false);
    setGlobalSearchQuery("");
    const daysInMonth = new Date(finYear, finMonth, 0).getDate();
    const userTxns = ledgerData.filter(l => String(l.user_id) === String(user.id));
    const balances = { pre_advance: 0, final_advance: 0, shop_advance: 0, shop_bill: 0, fine: 0, other: 0, total_deduction: 0 };
    userTxns.forEach(txn => {
      const amt = parseFloat(txn.amount || 0);
      if (balances[txn.type] !== undefined) balances[txn.type] += amt;
      balances.total_deduction += amt;
    });
    const userAtt = attendanceData.find(a => String(a.id) === String(user.id));
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
    const takenAdv = balances.pre_advance + balances.final_advance + balances.shop_advance;
    const availAdv = Math.max(0, maxAdv - takenAdv);
    setActiveUserModal({ ...user, txns: userTxns, balances, fixedSalary, netPayable, maxAdv, takenAdv, availAdv });
    setFormType("pre_advance");
  };

  return (
    /*
     * ROOT CONTAINER
     * - NO fixed width, NO min-width
     * - w-full + overflow-hidden = nothing escapes the viewport
     * - box-sizing is border-box so padding never adds to width
     */
    <div className="w-full overflow-hidden box-border flex flex-col gap-4 pb-24 md:pb-0 animate-in fade-in duration-500">

      {/* ══════════════════════════════════════════════════════════════
          HEADER CARD
          Mobile: title row + stacked controls
          Desktop: title left, controls right in one row
      ══════════════════════════════════════════════════════════════ */}
      <div className="w-full box-border bg-white/60 dark:bg-neutral-900/40 backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 rounded-3xl shadow-sm p-4 md:p-5">

        {/* Title */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500 mb-1">
            <Wallet size={14} className="shrink-0" />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase">Master Ledger</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Finance &amp; Transaction Hub
          </h1>
        </div>

        {/* Controls — always stacked on mobile, row on md+ */}
        <div className="flex flex-col gap-3 w-full">

          {/* Row 1: Tab switcher — full width on mobile */}
          <div className="flex items-center bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shadow-sm w-full">
            <button
              onClick={() => setActiveTab("employees")}
              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-black transition-all min-h-[44px] ${activeTab === 'employees' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Employee Balances
            </button>
            <button
              onClick={() => setActiveTab("ledger")}
              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-black transition-all min-h-[44px] ${activeTab === 'ledger' ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Master Ledger
            </button>
          </div>

          {/* Row 2: Month/Year picker + Log Transaction button side by side */}
          <div className="flex items-center gap-3 w-full">
            {/* Month/Year picker — grows to fill available space */}
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 shadow-sm flex-1 min-w-0 min-h-[44px]">
              <Calendar size={14} className="text-orange-500 shrink-0" />
              <select
                value={finMonth}
                onChange={(e) => setFinMonth(parseInt(e.target.value))}
                className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer min-w-0"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "short" })}</option>
                ))}
              </select>
              <span className="text-gray-300 dark:text-neutral-700">|</span>
              <select
                value={finYear}
                onChange={(e) => setFinYear(parseInt(e.target.value))}
                className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer min-w-0"
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Log Transaction button — fixed width, never shrinks to text */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-black rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all shrink-0 min-h-[44px] whitespace-nowrap"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Log Transaction</span>
            </button>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          FILTERS ROW
      ══════════════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════════════
          TAB 1 — EMPLOYEE BALANCES
          The outer card has overflow-hidden.
          ONLY the inner <div> with overflow-auto scrolls sideways.
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "employees" && (
        <div
          className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col overflow-hidden box-border"
          style={{ maxHeight: 'calc(100vh - 20rem)' }}
        >
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
            /* ── THIS is the only element that scrolls horizontally ── */
            <div className="overflow-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="text-left border-collapse" style={{ minWidth: '1000px', width: '100%' }}>
                <thead className="sticky top-0 z-30">
                  <tr className="bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md border-b border-gray-300 dark:border-neutral-700 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    <th className="p-4 sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 z-40 border-r border-gray-300 dark:border-neutral-700">Personnel</th>
                    <th className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">Fixed Salary</th>
                    <th className="p-4 text-right text-emerald-600 border-r border-gray-300 dark:border-neutral-700">Net Earned</th>
                    <th className="p-4 text-center text-blue-600 bg-blue-50/30 dark:bg-blue-900/10 border-x border-blue-300 dark:border-blue-700/50">Dynamic Limit (30%)</th>
                    <th className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">Pre-Advance</th>
                    <th className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">Final Advance</th>
                    <th className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">Shop / Bills</th>
                    <th className="p-4 text-right text-red-500 border-r border-gray-300 dark:border-neutral-700">Fines</th>
                    <th className="p-4 text-right bg-orange-50/50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-500 border-x border-orange-300 dark:border-orange-700/50">Net Month Impact</th>
                    <th className="p-4 text-center sticky right-0 bg-gray-50/95 dark:bg-[#050505]/95 z-40 border-l border-gray-300 dark:border-neutral-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 dark:divide-neutral-700">
                  {employeeBalances.map(row => {
                    const shopTotal = row.balances.shop_advance + row.balances.shop_bill;
                    const hasTransactions = row.balances.total_deduction !== 0;
                    const limitExceeded = row.availAdv <= 0;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors group">
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
                        <td className="p-4 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400 border-r border-gray-300 dark:border-neutral-700">{row.balances.pre_advance > 0 ? formatCurrency(row.balances.pre_advance) : "—"}</td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400 border-r border-gray-300 dark:border-neutral-700">{row.balances.final_advance > 0 ? formatCurrency(row.balances.final_advance) : "—"}</td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400 border-r border-gray-300 dark:border-neutral-700">{shopTotal > 0 ? formatCurrency(shopTotal) : "—"}</td>
                        <td className="p-4 text-right font-mono font-bold text-sm text-red-500 border-r border-gray-300 dark:border-neutral-700">{row.balances.fine > 0 ? formatCurrency(row.balances.fine) : "—"}</td>
                        <td className="p-4 text-right bg-orange-50/50 dark:bg-orange-900/10 border-x border-orange-300 dark:border-orange-700/50">
                          {hasTransactions ? (
                            <span className="font-mono font-black text-lg text-orange-600 dark:text-orange-400 whitespace-nowrap">-{formatCurrency(row.balances.total_deduction)}</span>
                          ) : (
                            <span className="font-mono text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-4 text-center sticky right-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50 dark:group-hover:bg-[#111] z-20 border-l border-gray-300 dark:border-neutral-700 transition-colors">
                          <button
                            onClick={() => { setActiveUserModal(row); setFormType("pre_advance"); }}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 whitespace-nowrap min-h-[40px]"
                          >
                            <Plus size={11} strokeWidth={3}/> Log / View
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

      {/* ══════════════════════════════════════════════════════════════
          TAB 2 — MASTER LEDGER
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === "ledger" && (
        <div
          className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm flex flex-col overflow-hidden box-border"
          style={{ maxHeight: 'calc(100vh - 20rem)' }}
        >
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
              <table className="text-left border-collapse" style={{ minWidth: '700px', width: '100%' }}>
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
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${T.bg} ${T.color}`}>{T.label}</span>
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
                          <button
                            onClick={() => handleVoidRecord(row.id)}
                            title="Void Transaction"
                            className="inline-flex items-center justify-center w-9 h-9 bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 hover:border-red-500 hover:text-red-500 rounded-lg transition-all text-gray-400"
                          >
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

      {/* ══════════════════════════════════════════════════════════════
          GLOBAL SEARCH MODAL
      ══════════════════════════════════════════════════════════════ */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-2xl max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col border border-gray-200 dark:border-neutral-800 overflow-hidden">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
              <div className="w-10 h-1 bg-gray-300 dark:bg-neutral-700 rounded-full" />
            </div>
            <div className="p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111] shrink-0 flex items-center gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  autoFocus
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder="Search by name, branch, or department..."
                  className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 shadow-sm box-border"
                />
              </div>
              <button
                onClick={() => { setSearchModalOpen(false); setGlobalSearchQuery(""); }}
                className="p-2.5 bg-gray-100 dark:bg-neutral-900 rounded-xl hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
              >
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
                      <button
                        key={u.id}
                        onClick={() => openUserFinanceModal(u)}
                        className="w-full flex items-center justify-between p-3 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl transition-colors text-left group min-h-[60px]"
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

      {/* ══════════════════════════════════════════════════════════════
          USER FINANCE MODAL
      ══════════════════════════════════════════════════════════════ */}
      {activeUserModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-4xl max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col overflow-hidden">
            {/* Drag handle */}
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
              <button
                onClick={() => { setActiveUserModal(null); setFormAmount(""); setFormRemarks(""); }}
                className="p-2.5 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
              {/* LEFT: LOG FORM */}
              <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-gray-100 dark:border-neutral-900 p-4 md:p-6 overflow-y-auto bg-white dark:bg-[#0a0a0a]">
                <div className="mb-6 p-4 bg-gray-50 dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">30% Dynamic Limit</p>
                    <p className="font-mono text-xs font-black text-gray-900 dark:text-white">Max: {formatCurrency(activeUserModal.maxAdv)}</p>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden flex mb-2">
                    <div
                      style={{ width: `${Math.min((activeUserModal.takenAdv / activeUserModal.maxAdv) * 100, 100)}%` }}
                      className="h-full bg-orange-500 transition-all"
                    />
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

                {['pre_advance', 'final_advance', 'shop_advance'].includes(formType) && parseFloat(formAmount || 0) > activeUserModal.availAdv && (
                  <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2 animate-in fade-in zoom-in-95">
                    <Unlock size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest mb-0.5">Admin Override Active</p>
                      <p className="text-[10px] font-bold text-red-600/80 dark:text-red-400/80 leading-snug">Amount exceeds the 30% dynamic limit. As Admin, you may proceed.</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleLogTransaction} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Transaction Type</label>
                    <div className="relative">
                      <select
                        required
                        value={formType}
                        onChange={(e) => setFormType(e.target.value)}
                        className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer min-h-[52px] box-border"
                      >
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
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black font-mono pointer-events-none">₹</span>
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="1"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl py-3.5 pl-8 pr-4 text-base font-black font-mono text-orange-700 dark:text-orange-400 outline-none focus:ring-2 focus:ring-orange-500/50 min-h-[52px] box-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Mandatory Remarks</label>
                    <textarea
                      required
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      placeholder="Reason for this transaction..."
                      className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-20 box-border"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="w-full py-4 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4 min-h-[52px]"
                  >
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
                            <button
                              onClick={() => handleVoidRecord(txn.id)}
                              disabled={formSubmitting}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 mb-3 leading-snug">{txn.remarks}</p>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-50 dark:border-neutral-900 pt-2">
                            {new Date(txn.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} · {txn.logged_by_name || 'System'}
                          </p>
                        </div>
                      );
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