"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Banknote, Building2, Calendar, ChevronDown, Download, FileText,
  Filter, Info, Loader2, RefreshCw, Search, Wallet, CheckCircle2,
  AlertTriangle, X, History, ShieldAlert, ChevronRight, IndianRupee
} from "lucide-react";

// ─── CORE MATH ENGINE & HELPERS ────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
const formatCurrency = (val) => `₹${parseFloat(val || 0).toLocaleString("en-IN")}`;

const TYPE_MAP = {
  pre_advance: { label: "Pre-Advance", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
  final_advance: { label: "Final Advance", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
  shop_advance: { label: "Shop Adv", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10" },
  shop_bill: { label: "Shop Bill", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10" },
  fine: { label: "Fine/Penalty", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" },
  repayment: { label: "Repayment", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  other: { label: "Other", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800" },
};

// STRICT LOGIC: Only calculates earned "Paid Leaves".
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
  const totalDuty = parseFloat(row.total_duty || row.days_worked || row.present || 0);
  const leaveCap = parseInt(row.max_paid_leaves_cap || row.max_paid_leaves || 4);
  
  const paidLeaves = calcPaidLeaves(totalDuty, leaveCap);
  const paidDuty = Math.min(daysInMonth, totalDuty + paidLeaves);
  const perDay = daysInMonth > 0 ? salary / daysInMonth : 0;

  // Granular financial keys directly from patched api.php
  const preAdvance = parseFloat(row.pre_advance || 0);
  const finalAdvance = parseFloat(row.final_advance || 0);
  const shopAdvance = parseFloat(row.shop_advance || 0);
  const shopBill = parseFloat(row.shop_bill || 0);
  const fine = parseFloat(row.fine || 0);
  const other = parseFloat(row.other || 0);
  const repayment = parseFloat(row.repayment || 0);
  const paid = parseFloat(row.paid_amount || row.paid || 0);

  const totalAdvance = preAdvance + finalAdvance + shopAdvance + shopBill;
  const deduction = fine + other;
  
  const gross = perDay * paidDuty;
  
  // Theoretical Net includes the Repayment adding back to the payable salary
  const theoreticalNet = gross - totalAdvance - deduction + repayment;
  const salaryToPay = Math.max(0, theoreticalNet);
  const isNegative = theoreticalNet < 0;

  return {
    salary, totalDuty, leaveCap, paidLeaves, paidDuty, perDay,
    preAdvance, finalAdvance, shopAdvance, shopBill, totalAdvance,
    fine, other, deduction, repayment, salaryToPay, paid, gross, isNegative, theoreticalNet
  };
}

const formatDateTime = (isoStr) => {
  if (!isoStr) return "Unknown Date";
  const d = new Date(isoStr);
  return d.toLocaleString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function GlobalPayrollEnginePage() {
  const searchParams = useSearchParams();
  const initialBranchId = searchParams.get("branch_id") || "all";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [session, setSession] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(initialBranchId);
  const [query, setQuery] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [downloadingId, setDownloadingId] = useState(null);

  // Modals
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", remarks: "" });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [inspectedUser, setInspectedUser] = useState(null);
  const [inspectorData, setInspectorData] = useState([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  const [breakdownModal, setBreakdownModal] = useState(null); 
  const [historyModal, setHistoryModal] = useState(null); 

  const daysInMonth = new Date(year, month, 0).getDate();

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) return;
    try { setSession(JSON.parse(raw)); } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [branchesRes, payrollRes] = await Promise.all([
      callApi("get_branches"),
      callApi("get_monthly_attendance", { month, year, branch_id: branchId === "all" ? "" : branchId }),
    ]);

    if (branchesRes.status === "success") setBranches(branchesRes.data || []);
    if (payrollRes.status === "success") setRows(payrollRes.data || []);
    setLoading(false);
  }, [month, year, branchId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const text = `${row.name || ""} ${row.branch_name || ""} ${row.department || ""} ${row.role || ""}`.toLowerCase();
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
        acc.repayment += c.repayment;
        acc.salaryToPay += c.salaryToPay;
        acc.paid += c.paid;
        return acc;
      },
      { salary: 0, gross: 0, totalAdvance: 0, deduction: 0, repayment: 0, salaryToPay: 0, paid: 0 }
    );
  }, [filteredRows, daysInMonth]);

  // ─── API HANDLERS ────────────────────────────────────────────────────────
  const handleProcessPayment = async (e) => {
    e.preventDefault();
    setPaymentSubmitting(true);
    const res = await callApi("process_salary_payment", {
      user_id: paymentTarget.user_id || paymentTarget.id,
      month, year,
      amount: parseFloat(paymentForm.amount),
      remarks: paymentForm.remarks,
      admin_id: session?.id
    });
    setPaymentSubmitting(false);

    if (res.status === "success") {
      setPaymentTarget(null);
      fetchAll();
    } else {
      alert(res.message || "Failed to process payment.");
    }
  };

  const openMiniLedger = async (user) => {
    setInspectedUser(user);
    setInspectorLoading(true);
    const res = await callApi("get_my_attendance", { user_id: user.user_id || user.id, month, year });
    if (res.status === "success") setInspectorData(res.data || []);
    setInspectorLoading(false);
  };

  const handleDownloadSlip = async (row) => {
    setDownloadingId(row.id);
    const res = await callApi("download_salary_slip", { user_id: row.id, month, year });
    if (res.status === "success" && res.url) window.open(res.url, "_blank");
    else alert(res.message || "Failed to generate salary slip PDF.");
    setDownloadingId(null);
  };

  // Upgraded to handle an array of types for perfect aggregation
  const openHistoryModal = async (user, typesArray, label) => {
    setHistoryModal({ user, typesArray, label, data: [], loading: true });
    const res = await callApi("get_my_financials", { user_id: user.id || user.user_id, month, year });
    if (res.status === "success") {
      setHistoryModal({ 
        user, typesArray, label, 
        data: (res.data.advance_history || []).filter(t => typesArray.includes(t.type)), 
        loading: false 
      });
    } else {
      setHistoryModal({ user, typesArray, label, data: [], loading: false });
    }
  };

  const totalCleared = filteredRows.filter(p => p.status === 'paid' || p.ledger_status === 'paid').length;

  return (
    // ROOT FRAME: Strictly constrains the page. No sideways scrolling allowed outside the table box.
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-2rem)] gap-4 md:gap-5 animate-in fade-in duration-500 text-gray-900 dark:text-neutral-200 font-sans w-full min-w-0 max-w-full overflow-hidden">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-4 md:p-5 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm w-full shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
            <Banknote size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Global Payroll Engine</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            Finance Master Sheet
          </h1>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <button onClick={fetchAll} className="flex items-center justify-center p-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl hover:text-emerald-500 text-sm font-bold shadow-sm transition-all shrink-0">
            <RefreshCw size={16} className={loading ? "animate-spin text-emerald-500" : ""} />
            </button>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 shrink-0 shadow-sm">
              <Calendar size={14} className="text-emerald-500" />
              <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "short" })}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer border-l border-gray-200 dark:border-neutral-700 pl-2 ml-2">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
        </div>
      </div>

      {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 shrink-0 w-full min-w-0">
        {[
          { label: "Total Gross", value: totals.gross, color: "text-gray-900 dark:text-white", icon: IndianRupee },
          { label: "Advances & Deductions", value: totals.totalAdvance + totals.deduction, color: "text-orange-500", icon: Wallet },
          { label: "Net Payable", value: totals.salaryToPay, color: "text-emerald-500", icon: Banknote },
          { label: "Staff Cleared", value: totalCleared, color: "text-blue-500", icon: CheckCircle2, isCount: true },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] md:text-[10px] uppercase tracking-widest font-black text-gray-400 truncate pr-2">{card.label}</p>
              <card.icon size={14} className="text-gray-400 opacity-50 shrink-0" />
            </div>
            <p className={`text-xl md:text-2xl font-black tabular-nums truncate ${card.color}`}>
              {card.isCount ? `${card.value} / ${filteredRows.length}` : `₹${Math.round(card.value).toLocaleString("en-IN")}`}
            </p>
          </div>
        ))}
      </div>

      {/* ── SMART FILTERS ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full min-w-0">
        <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, department, or role..." className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm" />
        </div>
        <div className="relative w-full sm:w-64 shrink-0">
            <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer shadow-sm">
            <option value="all">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* ── PAYROLL TABLE (PERFECTLY FRAMED) ─────────────────────────── */}
      <div className="flex-1 min-h-0 w-full min-w-0 flex flex-col">
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm flex flex-col flex-1 min-w-0 min-h-0 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <Loader2 size={32} className="animate-spin text-emerald-500 mb-4" />
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Calculating Payroll...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
              <FileText size={40} className="text-gray-300 dark:text-neutral-700 mb-4" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">No Data Found</h3>
              <p className="text-sm font-bold text-gray-500">No payroll records match the selected filters.</p>
            </div>
          ) : (
            // CRITICAL FIX: flex-1 overflow-auto forces scroll inside this div ONLY.
            <div className="flex-1 w-full overflow-auto custom-scrollbar relative">
              <table className="w-full text-left border-collapse min-w-[1600px]">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap shadow-sm">
                    <th className="p-4 md:p-5 sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md z-40 border-r border-gray-200 dark:border-neutral-800 shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.2)]">Personnel</th>
                    <th className="p-4 md:p-5 text-right">Fixed Salary</th>
                    <th className="p-4 md:p-5 text-center text-blue-500 bg-blue-50/95 dark:bg-blue-900/20 border-x border-blue-200 dark:border-blue-900/50">Verified Duty (Click)</th>
                    <th className="p-4 md:p-5 text-right">Gross Earned</th>
                    <th className="p-4 md:p-5 text-right text-orange-500/80">Advances</th>
                    <th className="p-4 md:p-5 text-right text-orange-500/80">Shop Bills</th>
                    <th className="p-4 md:p-5 text-right text-red-500/80">Deductions</th>
                    <th className="p-4 md:p-5 text-right text-emerald-500/80">Repayments</th>
                    <th className="p-4 md:p-5 text-left text-gray-400">Remarks</th>
                    <th className="p-4 md:p-5 text-right bg-emerald-50/95 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-500 border-x border-emerald-200 dark:border-emerald-900/50">Net Payable</th>
                    <th className="p-4 md:p-5 text-center">Clearance</th>
                    <th className="p-4 md:p-5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                  {filteredRows.map((row) => {
                    const c = calcRow(row, daysInMonth);
                    const combinedAdvances = c.preAdvance + c.finalAdvance + c.shopAdvance;
                    const isPaid = row.status === 'paid' || row.ledger_status === 'paid';

                    return (
                      <tr key={row.id} className={`hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors group ${isPaid ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                        
                        <td className="p-4 md:p-5 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/50 dark:group-hover:bg-[#111] z-20 border-r border-gray-100 dark:border-neutral-900 shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.2)] transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-black text-sm md:text-base text-gray-900 dark:text-white whitespace-nowrap mb-0.5 truncate">{row.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest truncate">{row.department} • {row.role}</p>
                                {c.isNegative && (
                                  <span title="Deductions exceed earned salary" className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => setBreakdownModal({ staff: row, math: c, daysInMonth })} className="p-2 bg-gray-50 dark:bg-neutral-900 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-500 rounded-lg transition-colors shrink-0">
                              <Info size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                        
                        <td className="p-4 md:p-5 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400">₹{c.salary.toLocaleString("en-IN")}</td>
                        
                        <td className="p-0 bg-blue-50/10 dark:bg-blue-900/5 border-x border-blue-100 dark:border-blue-900/30">
                          <button onClick={() => openMiniLedger(row)} className="w-full h-full p-4 flex flex-col items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group/btn min-h-[64px]">
                            <div className="flex items-center justify-center gap-1.5 font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                              {c.paidDuty} <span className="text-[10px] text-blue-400/50">/ {daysInMonth}</span>
                            </div>
                            <span className="text-[9px] font-bold text-blue-500/70 uppercase tracking-widest mt-0.5 group-hover/btn:underline flex items-center gap-1">Verify <ChevronRight size={10}/></span>
                          </button>
                        </td>
                        
                        <td className="p-4 md:p-5 text-right font-mono font-bold text-sm text-gray-600 dark:text-neutral-400">₹{c.gross.toLocaleString("en-IN")}</td>

                        <td className="p-4 md:p-5 text-right">
                          {combinedAdvances > 0 ? (
                            <button onClick={() => openHistoryModal(row, ["pre_advance", "final_advance", "shop_advance"], "Advances")} className="font-mono text-sm font-black hover:underline text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 rounded-lg transition-colors">
                              ₹{combinedAdvances.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-300 dark:text-neutral-700">—</span>}
                        </td>

                        <td className="p-4 md:p-5 text-right">
                          {c.shopBill > 0 ? (
                            <button onClick={() => openHistoryModal(row, ["shop_bill"], "Shop Bills")} className="font-mono text-sm font-black hover:underline text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 rounded-lg transition-colors">
                              ₹{c.shopBill.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-300 dark:text-neutral-700">—</span>}
                        </td>

                        <td className="p-4 md:p-5 text-right">
                          {c.deduction > 0 ? (
                            <button onClick={() => openHistoryModal(row, ["fine", "other"], "Deductions")} className="font-mono text-sm font-black hover:underline text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2.5 py-1 rounded-lg transition-colors">
                              ₹{c.deduction.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-300 dark:text-neutral-700">—</span>}
                        </td>

                        <td className="p-4 md:p-5 text-right">
                          {c.repayment > 0 ? (
                            <button onClick={() => openHistoryModal(row, ["repayment"], "Repayments")} className="font-mono text-sm font-black hover:underline text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg transition-colors">
                              +₹{c.repayment.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-300 dark:text-neutral-700">—</span>}
                        </td>

                        <td className="p-4 md:p-5 text-xs font-bold text-gray-500 dark:text-neutral-400 truncate max-w-[150px]">
                          {row.remarks || "—"}
                        </td>

                        <td className="p-4 md:p-5 text-right bg-emerald-50/50 dark:bg-emerald-900/10 border-x border-emerald-100 dark:border-emerald-900/30">
                          <span className={`font-mono font-black text-lg ${c.isNegative ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {c.isNegative ? `-₹${Math.abs(c.theoreticalNet).toLocaleString("en-IN")}` : `₹${c.salaryToPay.toLocaleString("en-IN")}`}
                          </span>
                        </td>

                        <td className="p-4 md:p-5 text-center">
                          {isPaid ? (
                             <div className="flex flex-col items-center">
                               <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
                                 <CheckCircle2 size={12} strokeWidth={3} /> Cleared
                               </span>
                               <span className="text-[8px] font-bold text-gray-400 mt-1">{new Date(row.processed_at).toLocaleDateString()}</span>
                             </div>
                          ) : c.isNegative ? (
                             <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-[10px] font-black uppercase tracking-wider rounded-lg">
                               <AlertTriangle size={12} strokeWidth={3} /> Alert
                             </span>
                          ) : (
                            <button 
                              onClick={() => {
                                setPaymentTarget({ ...row, c });
                                setPaymentForm({ amount: c.salaryToPay, remarks: row.remarks || "" });
                              }}
                              disabled={c.salaryToPay <= 0} 
                              className="inline-flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 whitespace-nowrap"
                            >
                              Mark Paid
                            </button>
                          )}
                        </td>

                        <td className="p-4 md:p-5 text-center">
                          <button onClick={() => handleDownloadSlip(row)} disabled={downloadingId === row.id} className="inline-flex items-center justify-center w-10 h-10 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 hover:border-emerald-500 hover:text-emerald-500 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400 rounded-xl transition-all disabled:opacity-50 shrink-0">
                            {downloadingId === row.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={2.5} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                
                <tfoot className="sticky bottom-0 z-30">
                  <tr className="border-t-2 border-gray-200 dark:border-neutral-800 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md font-black shadow-[0_-4px_12px_rgba(0,0,0,0.02)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
                    <td className="p-4 md:p-5 sticky left-0 z-40 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md border-r border-gray-200 dark:border-neutral-800 shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.2)]">Grand Total</td>
                    <td className="p-4 md:p-5 text-right font-mono">₹{Math.round(totals.salary).toLocaleString("en-IN")}</td>
                    <td className="p-4 md:p-5 text-center bg-blue-50/95 dark:bg-blue-900/20 border-x border-blue-200 dark:border-blue-900/50">—</td>
                    <td className="p-4 md:p-5 text-right font-mono text-gray-500">₹{Math.round(totals.gross).toLocaleString("en-IN")}</td>
                    <td className="p-4 md:p-5 text-right font-mono text-orange-500">—</td>
                    <td className="p-4 md:p-5 text-right font-mono text-orange-500">—</td>
                    <td className="p-4 md:p-5 text-right font-mono text-red-500">—</td>
                    <td className="p-4 md:p-5 text-right font-mono text-emerald-500">—</td>
                    <td className="p-4 md:p-5 text-center">—</td>
                    <td className="p-4 md:p-5 text-right font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50/95 dark:bg-emerald-900/20 border-x border-emerald-200 dark:border-emerald-900/50">
                      ₹{Math.round(totals.salaryToPay).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 md:p-5 text-center">—</td>
                    <td className="p-4 md:p-5 text-center">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: DOUBLE CONFIRMATION PAYMENT GATE
      ══════════════════════════════════════════════════════════════════ */}
      {paymentTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-emerald-200 dark:border-emerald-900/50 w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] rounded-t-3xl shrink-0">
              <h2 className="text-base font-black flex items-center gap-2 text-gray-900 dark:text-white"><ShieldAlert size={18} className="text-emerald-500" /> Confirm Salary Disbursement</h2>
              <button onClick={() => setPaymentTarget(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><X size={16} /></button>
            </div>
            
            <form onSubmit={handleProcessPayment} className="p-5 md:p-6 space-y-6 pb-safe">
              <div className="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-2xl flex flex-col gap-2 border border-gray-100 dark:border-neutral-800">
                 <div className="flex justify-between items-center">
                   <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Recipient</p>
                   <p className="text-sm font-black text-gray-900 dark:text-white">{paymentTarget.name}</p>
                 </div>
                 <div className="flex justify-between items-center">
                   <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gross Earned</p>
                   <p className="font-mono font-bold text-gray-600 dark:text-neutral-400">{formatCurrency(paymentTarget.c.gross)}</p>
                 </div>
                 <div className="flex justify-between items-center">
                   <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Advances Deducted</p>
                   <p className="font-mono font-bold text-orange-600 dark:text-orange-400">-{formatCurrency(paymentTarget.c.totalAdvance)}</p>
                 </div>
                 <div className="flex justify-between items-center">
                   <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Fines & Deductions</p>
                   <p className="font-mono font-bold text-red-600 dark:text-red-400">-{formatCurrency(paymentTarget.c.deduction)}</p>
                 </div>
                 <div className="flex justify-between items-center">
                   <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Repayments</p>
                   <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(paymentTarget.c.repayment)}</p>
                 </div>
                 <div className="h-px bg-gray-200 dark:bg-neutral-800 my-1"></div>
                 <div className="flex justify-between items-center">
                   <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Final Net Payable</p>
                   <p className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400">{formatCurrency(paymentTarget.c.salaryToPay)}</p>
                 </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Final Amount Being Paid</label>
                  <input type="number" required value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl px-4 py-3 text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Payment Remarks / Ref No. (Optional)</label>
                  <textarea value={paymentForm.remarks} onChange={e => setPaymentForm({...paymentForm, remarks: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none h-16 custom-scrollbar" placeholder="e.g. Paid via NEFT Ref 123456..." />
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-red-700 dark:text-red-400 leading-snug">
                  By confirming, you authorize this exact amount to be recorded as fully settled in the firm's central financial ledger. This action is irreversible.
                </p>
              </div>

              <button type="submit" disabled={paymentSubmitting} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50">
                {paymentSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} strokeWidth={2.5} />} 
                Confirm & Record Payout
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SLIDE-OUT MINI-LEDGER VERIFICATION
      ══════════════════════════════════════════════════════════════════ */}
      {inspectedUser && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] transition-opacity" onClick={() => setInspectedUser(null)}></div>
          <div className="fixed top-0 right-0 bottom-0 w-full md:w-[450px] bg-white dark:bg-[#050505] shadow-[-10px_0_40px_rgba(0,0,0,0.1)] z-[110] flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-200 dark:border-neutral-800">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#0a0a0a] shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                    {inspectedUser.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight">{inspectedUser.name}</h2>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Verification Ledger</p>
                  </div>
                </div>
                <button onClick={() => setInspectedUser(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors"><X size={16} className="text-gray-600 dark:text-neutral-300" /></button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 p-2.5 rounded-xl text-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Present</p>
                  <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">{inspectedUser.present || inspectedUser.total_duty || 0} Days</p>
                </div>
                <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 p-2.5 rounded-xl text-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Paid Leaves</p>
                  <p className="font-mono font-black text-blue-600 dark:text-blue-400">{calcPaidLeaves(parseFloat(inspectedUser.present || inspectedUser.total_duty || 0), parseInt(inspectedUser.max_paid_leaves_cap || 4))}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-2.5 rounded-xl text-center">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Total Duty</p>
                  <p className="font-mono font-black text-blue-700 dark:text-blue-400">{parseFloat(inspectedUser.present || inspectedUser.total_duty || 0) + calcPaidLeaves(parseFloat(inspectedUser.present || inspectedUser.total_duty || 0), parseInt(inspectedUser.max_paid_leaves_cap || 4))} Days</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-white dark:bg-[#050505]">
              {inspectorLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
              ) : inspectorData.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-bold text-sm">No punches logged this month.</div>
              ) : (
                <div className="space-y-3 pb-safe">
                  {inspectorData.map((day, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 p-3.5 rounded-2xl">
                      <div>
                        <p className="text-xs font-black text-gray-900 dark:text-white mb-0.5">{new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                           {day.status === 'F' ? <span className="text-emerald-500">Full Day</span> : 
                            day.status === 'H' ? <span className="text-yellow-600">Half Day</span> : 
                            day.status === 'L' ? <span className="text-blue-500">Leave</span> : 
                            <span className="text-red-500">Absent</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-black text-xs text-gray-700 dark:text-neutral-300">
                          {day.first_in ? new Date(day.first_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"} to {day.last_out ? new Date(day.last_out).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </p>
                        <p className="text-[10px] font-bold text-gray-500 font-mono mt-0.5">{day.hours_worked}h Worked</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: SALARY BREAKDOWN 
      ══════════════════════════════════════════════════════════════════ */}
      {breakdownModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
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
                
                {breakdownModal.math.totalAdvance > 0 && <div className="flex justify-between text-orange-500 font-bold pt-3 border-t border-dashed border-gray-200 dark:border-neutral-800"><span>Advances & Bills</span><span>−₹{breakdownModal.math.totalAdvance.toFixed(0)}</span></div>}
                {breakdownModal.math.deduction > 0 && <div className="flex justify-between text-red-500 font-bold"><span>Fines & Deductions</span><span>−₹{breakdownModal.math.deduction.toFixed(0)}</span></div>}
                {breakdownModal.math.repayment > 0 && <div className="flex justify-between text-emerald-500 font-bold"><span>Repayments</span><span>+₹{breakdownModal.math.repayment.toFixed(0)}</span></div>}
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
          MODAL: UNIFIED HISTORY (Upgraded for Arrays)
      ══════════════════════════════════════════════════════════════════ */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md max-h-[85dvh] flex flex-col rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2"><History size={16} className="text-blue-500" /> {historyModal.label} History</h2>
              <button onClick={() => setHistoryModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors"><X size={16} /></button>
            </div>
            
            <div className="p-6 bg-gray-50 dark:bg-[#111] border-b border-gray-100 dark:border-neutral-900 shrink-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Entity Profile</p>
              <p className="font-black text-gray-900 dark:text-white text-lg">{historyModal.user.name}</p>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 pb-safe space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-100 dark:border-neutral-900 pb-2">Records for Selected Month</p>
              
              {historyModal.loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
              ) : historyModal.data.length === 0 ? (
                <div className="text-center text-gray-400 font-bold py-10 text-sm">No transactions found for this query.</div>
              ) : (
                <div className="space-y-4">
                  {historyModal.data.map(txn => {
                    const T = TYPE_MAP[txn.type] || TYPE_MAP.other;
                    return (
                      <div key={txn.id} className="border border-gray-100 dark:border-neutral-800 rounded-2xl p-4 bg-white dark:bg-black shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${T.bg} ${T.color} border-current opacity-80 mb-1`}>{T.label}</span>
                            <p className={`font-mono font-black text-lg leading-none ${T.color}`}>₹{parseFloat(txn.amount).toLocaleString("en-IN")}</p>
                          </div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{formatDateTime(txn.created_at)}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-neutral-300 font-medium mb-3 leading-snug">{txn.remarks || "No remarks logged"}</p>
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-50 dark:border-neutral-900">
                          <div className="w-5 h-5 rounded-md bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-[9px] font-black text-gray-500">{txn.logged_by_name?.charAt(0) || "?"}</div>
                          <span className="text-[10px] font-bold text-gray-400">Logged by <span className="text-gray-700 dark:text-neutral-300">{txn.logged_by_name || "System"}</span></span>
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