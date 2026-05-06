"use client";

import { useEffect, useMemo, useState } from "react";
import { callApi } from "@/lib/apiClient";
import {
  Banknote, Building2, Calendar, ChevronDown, Download, FileText,
  Filter, Info, Loader2, RefreshCw, Search, Wallet, CheckCircle2,
  Clock3, IndianRupee, Sparkles, AlertTriangle, X, History
} from "lucide-react";

// ─── CORE MATH ENGINE ──────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

// STRICT LOGIC: Only calculates earned "Paid Leaves". No "Week Offs" or "Holidays".
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

function calcRow(row, daysInMonth) {
  const salary = parseFloat(row.monthly_fixed_salary || row.salary || 0);
  const totalDuty = parseFloat(row.total_duty || row.days_worked || 0);
  const leaveCap = parseInt(row.max_paid_leaves_cap || row.max_paid_leaves || 4);
  
  const paidLeaves = calcPaidLeaves(totalDuty, leaveCap);
  const paidDuty = Math.min(daysInMonth, totalDuty + paidLeaves);
  const perDay = daysInMonth > 0 ? salary / daysInMonth : 0;

  const preAdvance = parseFloat(row.pre_advance || 0);
  const finalAdvance = parseFloat(row.final_advance || 0);
  const shopAdvance = parseFloat(row.shop_advance || 0);
  const shopBill = parseFloat(row.shop_bill || 0);
  const deduction = parseFloat(row.deduction || 0);
  const paid = parseFloat(row.paid_amount || row.paid || 0);

  const totalAdvance = preAdvance + finalAdvance + shopAdvance + shopBill;
  const gross = perDay * paidDuty;
  const salaryToPay = Math.max(0, gross - totalAdvance - deduction);
  
  // Calculate if they are in the negative (took more advance than earned)
  const theoreticalNet = gross - totalAdvance - deduction;
  const isNegative = theoreticalNet < 0;

  const advanceDue = paid - salaryToPay;

  return {
    salary, totalDuty, leaveCap, paidLeaves, paidDuty, perDay,
    preAdvance, finalAdvance, shopAdvance, shopBill, totalAdvance,
    deduction, salaryToPay, paid, advanceDue, gross, isNegative, theoreticalNet
  };
}

// Formatting Helper for strict Date & Time
const formatDateTime = (isoStr) => {
  if (!isoStr) return "Unknown Date";
  const d = new Date(isoStr);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function GlobalPayrollEnginePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("all");
  const [query, setQuery] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Modals for App-Like Mobile Experience
  const [breakdownModal, setBreakdownModal] = useState(null); 
  const [historyModal, setHistoryModal] = useState(null); 

  const daysInMonth = new Date(year, month, 0).getDate();

  const fetchAll = async () => {
    setLoading(true);
    const [branchesRes, payrollRes] = await Promise.all([
      callApi("get_branches"),
      callApi("get_global_payroll_data", { month, year, branch_id: branchId === "all" ? "" : branchId }),
    ]);

    if (branchesRes.status === "success") setBranches(branchesRes.data || []);
    if (payrollRes.status === "success") setRows(payrollRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [month, year, branchId]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const text = `${row.name || ""} ${row.branch_name || ""} ${row.role || ""}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });
  }, [rows, query]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const c = calcRow(row, daysInMonth);
        acc.salary += c.salary;
        acc.gross += c.gross;
        acc.totalAdvance += c.totalAdvance;
        acc.deduction += c.deduction;
        acc.salaryToPay += c.salaryToPay;
        acc.paid += c.paid;
        return acc;
      },
      { salary: 0, gross: 0, totalAdvance: 0, deduction: 0, salaryToPay: 0, paid: 0 }
    );
  }, [filteredRows, daysInMonth]);

  // ─── API HANDLERS ────────────────────────────────────────────────────────
  const handleMarkPaid = async (row) => {
    const c = calcRow(row, daysInMonth);
    if (c.salaryToPay <= 0) {
      alert("Net payable is 0. Nothing to pay.");
      return;
    }
    if (!confirm(`Confirm payment of ₹${c.salaryToPay.toFixed(0)} to ${row.name}?`)) return;

    setMarkingPaidId(row.id);
    const res = await callApi("mark_salary_paid", {
      user_id: row.id, branch_id: row.branch_id, month, year, amount: c.salaryToPay
    });

    if (res.status === "success") fetchAll();
    else alert(res.message || "Failed to mark salary as paid.");
    setMarkingPaidId(null);
  };

  const handleDownloadSlip = async (row) => {
    setDownloadingId(row.id);
    const res = await callApi("download_salary_slip", { user_id: row.id, month, year });
    if (res.status === "success" && res.url) window.open(res.url, "_blank");
    else alert(res.message || "Failed to generate salary slip PDF.");
    setDownloadingId(null);
  };

  const openHistoryModal = async (user, type, label) => {
    setHistoryModal({ user, type, label, data: [], loading: true });
    const res = await callApi("get_advance_history", { user_id: user.id, month, year });
    if (res.status === "success") {
      setHistoryModal({ user, type, label, data: res.data.filter(t => t.type === type), loading: false });
    } else {
      setHistoryModal({ user, type, label, data: [], loading: false });
    }
  };

  // ─── SMART INTELLIGENCE CALCULATIONS ──────────────────────────────────────
  const totalPending = Math.max(0, totals.salaryToPay - totals.paid);
  const payoutPercentage = totals.salaryToPay > 0 ? Math.round((totals.paid / totals.salaryToPay) * 100) : 0;
  const isMonthComplete = payoutPercentage === 100 && totals.salaryToPay > 0;

  return (
    // FIX: Removed w-full and overflow-x-hidden from here to prevent sidebar overlap
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 text-gray-900 dark:text-neutral-200 font-sans">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mx-3 md:mx-0 mt-3 md:mt-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
            <Banknote size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Global Payroll Engine</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            Finance Master Sheet
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 font-medium leading-relaxed max-w-3xl">
            Centralized salary processor. Automatically calculates net pay using exact attendance rules, paid leave tiers, and logged transaction deductions.
          </p>
        </div>

        <button onClick={fetchAll} className="w-full md:w-auto flex items-center justify-center p-3 md:px-5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl hover:text-emerald-500 text-sm font-bold shadow-sm transition-all shrink-0 gap-2">
          <RefreshCw size={16} className={loading ? "animate-spin text-emerald-500" : ""} /> Sync Ledger
        </button>
      </div>

      <div className="px-3 md:px-0 grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-5">
        
        {/* ── AI INTELLIGENCE BANNER ────────────────────────────────────── */}
        <div className="xl:col-span-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10 flex-1">
            <div className="flex items-center gap-2 mb-2 text-indigo-100">
              <Sparkles size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Payroll Intelligence</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black leading-tight mb-2">
              {isMonthComplete ? "All salaries have been cleared." : `₹${Math.round(totalPending).toLocaleString("en-IN")} pending disbursement.`}
            </h2>
            <p className="text-sm text-indigo-100 font-medium">
              Based on the current attendance and deduction records for the selected period, {payoutPercentage}% of the total generated payroll has been successfully paid out to employees.
            </p>
          </div>
          
          <div className="relative z-10 bg-black/20 backdrop-blur-md rounded-2xl p-5 w-full md:w-64 shrink-0 border border-white/10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold text-indigo-100 uppercase tracking-widest">Payout Progress</span>
              <span className="text-xl font-black">{payoutPercentage}%</span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
              <div style={{ width: `${payoutPercentage}%` }} className="h-full bg-emerald-400 rounded-full transition-all duration-1000"></div>
            </div>
          </div>
        </div>

        {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
        {[
          { label: "Total Generated Gross", value: totals.gross, color: "text-gray-900 dark:text-white", icon: IndianRupee },
          { label: "Total Advances Taken", value: totals.totalAdvance, color: "text-orange-500", icon: Wallet },
          { label: "Penalties & Deductions", value: totals.deduction, color: "text-red-500", icon: AlertTriangle },
          { label: "Net Payable Salary", value: totals.salaryToPay, color: "text-emerald-500", icon: Banknote },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">{card.label}</p>
              <card.icon size={16} className="text-gray-400 opacity-50" />
            </div>
            <p className={`text-2xl md:text-3xl font-black tabular-nums ${card.color}`}>
              ₹{Math.round(card.value).toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </div>

      {/* ── SMART FILTERS ──────────────────────────────────────────────── */}
      <div className="px-3 md:px-0">
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-4 md:p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-neutral-400 px-1">
            <Filter size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Master Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, branch, or role..." className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
            </div>
            
            <div className="relative">
              <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer">
                <option value="all">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── PAYROLL TABLE ──────────────────────────────────────────────── */}
      <div className="px-3 md:px-0">
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-emerald-500 mb-4" />
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Calculating Payroll...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <FileText size={40} className="text-gray-300 dark:text-neutral-700 mb-4" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">No Data Found</h3>
              <p className="text-sm font-bold text-gray-500">No payroll records match the selected filters.</p>
            </div>
          ) : (
            // FIX: max-w-full added here to ensure the table wrapper never breaks the flex parent constraints
            <div className="w-full max-w-full overflow-x-auto custom-scrollbar pb-2">
              <table className="w-full text-left border-collapse min-w-[1400px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    <th className="p-4 md:p-5 sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-sm z-20 shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.2)]">Personnel</th>
                    <th className="p-4 md:p-5 text-right">Fixed Salary</th>
                    <th className="p-4 md:p-5 text-center">Duty Record</th>
                    <th className="p-4 md:p-5 text-right text-red-500/80">Advances</th>
                    <th className="p-4 md:p-5 text-right text-orange-500/80">Shop Bills</th>
                    <th className="p-4 md:p-5 text-right text-red-500/80">Deductions</th>
                    <th className="p-4 md:p-5 text-right bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-500 border-x border-emerald-100 dark:border-emerald-900/30">Net Payable</th>
                    <th className="p-4 md:p-5 text-center">Clearance</th>
                    <th className="p-4 md:p-5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                  {filteredRows.map((row) => {
                    const c = calcRow(row, daysInMonth);
                    const combinedAdvances = c.preAdvance + c.finalAdvance + c.shopAdvance;

                    return (
                      <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors group">
                        
                        <td className="p-4 md:p-5 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/50 dark:group-hover:bg-[#111] z-10 border-r border-gray-100 dark:border-neutral-900 shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.2)] transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-black text-sm md:text-base text-gray-900 dark:text-white whitespace-nowrap mb-0.5 truncate">{row.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest truncate">{row.role}</p>
                                {c.isNegative && (
                                  <span title="Deductions exceed earned salary" className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => setBreakdownModal({ staff: row, math: c, daysInMonth })} className="p-2 bg-gray-50 dark:bg-neutral-900 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-500 rounded-lg transition-colors shrink-0">
                              <Info size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                        
                        <td className="p-4 md:p-5 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400">₹{c.salary.toLocaleString("en-IN")}</td>
                        
                        <td className="p-4 md:p-5 text-center">
                          <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded" title="Total Duty">{c.totalDuty}</span>
                          <span className="text-gray-400 font-bold mx-1.5">+</span>
                          <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded" title="Paid Leaves">{c.paidLeaves}</span>
                          <span className="text-gray-400 font-bold mx-1.5">=</span>
                          <span className="font-mono font-black text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded" title="Paid Duty">{c.paidDuty}</span>
                        </td>
                        
                        <td className="p-4 md:p-5 text-right">
                          {combinedAdvances > 0 ? (
                            <button onClick={() => openHistoryModal(row, "pre_advance", "Advances")} className="font-mono text-sm font-black hover:underline text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-lg transition-colors">
                              ₹{combinedAdvances.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-300 dark:text-neutral-700">—</span>}
                        </td>

                        <td className="p-4 md:p-5 text-right">
                          {c.shopBill > 0 ? (
                            <button onClick={() => openHistoryModal(row, "shop_bill", "Shop Bills")} className="font-mono text-sm font-black hover:underline text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 rounded-lg transition-colors">
                              ₹{c.shopBill.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-300 dark:text-neutral-700">—</span>}
                        </td>

                        <td className="p-4 md:p-5 text-right">
                          {c.deduction > 0 ? (
                            <button onClick={() => openHistoryModal(row, "deduction", "Deductions")} className="font-mono text-sm font-black hover:underline text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-lg transition-colors">
                              ₹{c.deduction.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-300 dark:text-neutral-700">—</span>}
                        </td>

                        <td className="p-4 md:p-5 text-right bg-emerald-50/50 dark:bg-emerald-900/10 border-x border-emerald-100 dark:border-emerald-900/30">
                          <span className={`font-mono font-black text-lg ${c.isNegative ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {c.isNegative ? `-₹${Math.abs(c.theoreticalNet).toLocaleString("en-IN")}` : `₹${c.salaryToPay.toLocaleString("en-IN")}`}
                          </span>
                        </td>

                        <td className="p-4 md:p-5 text-center">
                          {row.ledger_status === 'paid' ? (
                             <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-lg">
                               <CheckCircle2 size={12} strokeWidth={3} /> Paid
                             </span>
                          ) : c.isNegative ? (
                             <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-[10px] font-black uppercase tracking-wider rounded-lg">
                               <AlertTriangle size={12} strokeWidth={3} /> Alert
                             </span>
                          ) : (
                            <button onClick={() => handleMarkPaid(row)} disabled={markingPaidId === row.id || c.salaryToPay <= 0} className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100">
                              {markingPaidId === row.id ? <Loader2 size={14} className="animate-spin" /> : "Mark Paid"}
                            </button>
                          )}
                        </td>

                        <td className="p-4 md:p-5 text-center">
                          <button onClick={() => handleDownloadSlip(row)} disabled={downloadingId === row.id} className="inline-flex items-center justify-center w-10 h-10 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 hover:border-emerald-500 hover:text-emerald-500 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400 rounded-xl transition-all disabled:opacity-50">
                            {downloadingId === row.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={2.5} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#0a0a0a] font-black">
                    <td className="p-4 sticky left-0 z-10 bg-gray-50 dark:bg-[#0a0a0a]">Grand Total</td>
                    <td className="p-4 text-right font-mono">₹{Math.round(totals.salary).toLocaleString("en-IN")}</td>
                    <td className="p-4 text-center">—</td>
                    <td className="p-4 text-right font-mono text-red-500">—</td>
                    <td className="p-4 text-right font-mono text-orange-500">—</td>
                    <td className="p-4 text-right font-mono text-red-500">—</td>
                    <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10">
                      ₹{Math.round(totals.salaryToPay).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-center">—</td>
                    <td className="p-4 text-center">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: SALARY BREAKDOWN (Slide-Up Drawer)
      ══════════════════════════════════════════════════════════════════ */}
      {breakdownModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl">
              <h2 className="text-sm font-black flex items-center gap-2"><Info size={16} className="text-emerald-500" /> Formula Engine Breakdown</h2>
              <button onClick={() => setBreakdownModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors"><X size={16} /></button>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 pb-safe">
              <div>
                <p className="font-black text-xl text-gray-900 dark:text-white leading-tight">{breakdownModal.staff.name}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{breakdownModal.staff.role}</p>
              </div>

              <div className="space-y-3 font-mono text-sm bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 p-5 rounded-2xl">
                <div className="flex justify-between text-gray-500 dark:text-neutral-400"><span>Fixed Salary</span><span className="font-bold text-gray-900 dark:text-white">₹{breakdownModal.math.salary.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between text-gray-500 dark:text-neutral-400"><span>Days in Month</span><span className="font-bold text-gray-900 dark:text-white">{breakdownModal.daysInMonth}</span></div>
                <div className="flex justify-between text-gray-500 dark:text-neutral-400 border-t border-dashed border-gray-200 dark:border-neutral-800 pt-3"><span>Per-Day Rate</span><span className="font-bold text-gray-900 dark:text-white">₹{breakdownModal.math.perDay.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-neutral-300 pt-3"><span>Total Duty</span><span className="font-bold text-emerald-600">{breakdownModal.math.totalDuty}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-neutral-300"><span>Paid Leaves <span className="text-[10px] text-gray-400">(Cap {breakdownModal.math.leaveCap})</span></span><span className="font-bold text-blue-500">+{breakdownModal.math.paidLeaves}</span></div>
                <div className="flex justify-between font-bold text-gray-800 dark:text-neutral-200 border-t border-dashed border-gray-200 dark:border-neutral-800 pt-3"><span>Paid Duty</span><span>{breakdownModal.math.paidDuty}</span></div>
                <div className="flex justify-between font-bold text-gray-800 dark:text-neutral-200"><span>Gross Earned</span><span>₹{parseFloat(breakdownModal.math.gross).toLocaleString("en-IN")}</span></div>
                
                {breakdownModal.math.totalAdvance > 0 && <div className="flex justify-between text-red-500 font-bold pt-3 border-t border-dashed border-gray-200 dark:border-neutral-800"><span>Total Advances</span><span>−₹{breakdownModal.math.totalAdvance.toFixed(0)}</span></div>}
                {breakdownModal.math.deduction > 0 && <div className="flex justify-between text-red-500 font-bold"><span>Deductions & Fines</span><span>−₹{breakdownModal.math.deduction.toFixed(0)}</span></div>}
              </div>

              <div className={`flex justify-between items-center px-5 py-4 rounded-2xl border ${breakdownModal.math.isNegative ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-900/50' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-900/50'}`}>
                <span className={`text-xs font-black uppercase tracking-widest ${breakdownModal.math.isNegative ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>Net Payable</span>
                <span className={`font-mono font-black text-2xl ${breakdownModal.math.isNegative ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {breakdownModal.math.isNegative ? `-₹${Math.abs(breakdownModal.math.theoreticalNet).toLocaleString("en-IN")}` : `₹${parseFloat(breakdownModal.math.salaryToPay).toLocaleString("en-IN")}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: TRANSACTION HISTORY (Slide-Up Drawer with EXACT Timestamp)
      ══════════════════════════════════════════════════════════════════ */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md max-h-[85dvh] flex flex-col rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2"><History size={16} className="text-orange-500" /> {historyModal.label} History</h2>
              <button onClick={() => setHistoryModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors"><X size={16} /></button>
            </div>
            
            <div className="p-6 bg-gray-50 dark:bg-[#111] border-b border-gray-100 dark:border-neutral-900 shrink-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Entity Profile</p>
              <p className="font-black text-gray-900 dark:text-white text-lg">{historyModal.user.name}</p>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 pb-safe space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-100 dark:border-neutral-900 pb-2">{historyModal.label} Records</p>
              
              {historyModal.loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
              ) : historyModal.data.length === 0 ? (
                <div className="text-center text-gray-400 font-bold py-10 text-sm">No transactions found for this query.</div>
              ) : (
                <div className="space-y-4">
                  {historyModal.data.map(txn => (
                    <div key={txn.id} className="border border-gray-100 dark:border-neutral-800 rounded-2xl p-4 bg-white dark:bg-black shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-lg">₹{parseFloat(txn.amount).toLocaleString("en-IN")}</span>
                        {/* FIX: Exact Time and Date Included */}
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{formatDateTime(txn.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-neutral-300 font-medium mb-3">{txn.remarks || "No remarks logged"}</p>
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-50 dark:border-neutral-900">
                        <div className="w-5 h-5 rounded-md bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-[9px] font-black text-gray-500">{txn.logged_by_name?.charAt(0) || "?"}</div>
                        <span className="text-[10px] font-bold text-gray-400">Logged by <span className="text-gray-700 dark:text-neutral-300">{txn.logged_by_name || "System"}</span></span>
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
  );
}