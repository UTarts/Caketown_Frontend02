"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Banknote, Calendar, Download, FileText, Search, Wallet, CheckCircle2, 
  AlertTriangle, X, History, ChevronRight, IndianRupee, Info, Loader2, RefreshCw, Gift, Package, ArrowDownRight, Check
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
  other: { label: "Other", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800" },
};

function calcPaidLeaves(daysPresent, cap) {
  if (cap === 0) return 0;
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

function getTimeSince(dateString) {
  if (!dateString) return "Unknown";
  const start = new Date(dateString);
  const now = new Date();
  if (start > now) return "0 days";
  
  let months = (now.getFullYear() - start.getFullYear()) * 12;
  months -= start.getMonth();
  months += now.getMonth();
  
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  const parts = [];
  if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (parts.length === 0) return "Today";
  return parts.join(', ');
}

function calcRow(row, daysInMonth) {
  const salary = parseFloat(row.monthly_fixed_salary ?? row.salary ?? 0);
  const totalDuty = parseFloat(row.total_duty ?? row.days_worked ?? row.present ?? 0);
  const leaveCap = parseInt(row.max_paid_leaves_cap ?? row.max_paid_leaves ?? 4);
  
  const paidLeaves = calcPaidLeaves(totalDuty, leaveCap);
  const paidDuty = totalDuty + paidLeaves; 
  const perDay = daysInMonth > 0 ? salary / daysInMonth : 0;

  const preAdvance = parseFloat(row.pre_advance || 0);
  const finalAdvance = parseFloat(row.final_advance || 0);
  const shopAdvance = parseFloat(row.shop_advance || 0);
  const shopBill = parseFloat(row.shop_bill || 0);
  const fine = parseFloat(row.fine || 0);
  const other = parseFloat(row.other || 0);
  const bonus = parseFloat(row.bonus || 0); 
  
  const surplusCredit = parseFloat(row.surplus_credit || 0); 
  const overpaymentDebt = parseFloat(row.overpayment_debt || 0); 

  const totalAdvance = preAdvance + finalAdvance + shopAdvance + shopBill;
  const deduction = fine + other;
  
  const gross = Math.round(perDay * paidDuty);
  const theoreticalNet = Math.round(gross + bonus - totalAdvance - deduction + surplusCredit - overpaymentDebt);
  const salaryToPay = Math.max(0, theoreticalNet);
  const isNegative = theoreticalNet < 0;

  return {
    salary, totalDuty, leaveCap, paidLeaves, paidDuty, perDay,
    preAdvance, finalAdvance, shopAdvance, shopBill, totalAdvance,
    fine, other, deduction, bonus, salaryToPay, gross, isNegative, theoreticalNet, surplusCredit, overpaymentDebt,
    paidAmount: parseFloat(row.paid_amount || row.paid || 0),
    carryForwardType: row.carry_forward_type || 'none',
    carryForwardAmount: parseFloat(row.carry_forward_amount || 0),
    paymentMode: row.payment_mode || "Cash",
    processedAt: row.processed_at || null,
    pendingAssets: row.pending_assets || [],
    assetCount: parseInt(row.asset_count || 0) 
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
  const urlBranchId = searchParams.get("branch_id") || "all";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [session, setSession] = useState(null);
  const [branchId, setBranchId] = useState(urlBranchId);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState("active");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [downloadingId, setDownloadingId] = useState(null);

  // General Modals
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", remarks: "", payment_mode: "Cash" });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [paidDetailModal, setPaidDetailModal] = useState(null);
  const [inspectedUser, setInspectedUser] = useState(null);
  const [inspectorData, setInspectorData] = useState([]);
  const [breakdownModal, setBreakdownModal] = useState(null); 
  const [historyModal, setHistoryModal] = useState(null);

  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ adjustment_type: "credit", amount: "", reason: "", payment_mode: "Cash" });
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // New Modals (Bonus & Assets)
  const [bonusModal, setBonusModal] = useState(null);
  const [bonusSubmitting, setBonusSubmitting] = useState(false);
  const [assetModal, setAssetModal] = useState(null);
  const [assetSubmitting, setAssetSubmitting] = useState(false);
  const [globalInventory, setGlobalInventory] = useState([]);

  const daysInMonth = new Date(year, month, 0).getDate();

  useEffect(() => {
    if (urlBranchId !== branchId) setBranchId(urlBranchId);
  }, [urlBranchId]);

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) return;
    try { setSession(JSON.parse(raw)); } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [payrollRes, invRes] = await Promise.all([
      callApi("get_monthly_attendance", { month, year, branch_id: branchId === "all" ? "" : branchId, include_inactive: viewMode === "deactivated" ? "1" : "0" }),
      callApi("get_inventory_items")
    ]);
    if (payrollRes.status === "success") setRows(payrollRes.data || []);
    if (invRes?.status === "success") setGlobalInventory(invRes.data || []);
    setLoading(false);
  }, [month, year, branchId, viewMode]);

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
        acc.bonus += c.bonus;
        acc.totalAdvance += c.totalAdvance;
        acc.deduction += c.deduction;
        acc.salaryToPay += c.salaryToPay;
        
        if (row.status === 'paid' || row.ledger_status === 'paid') {
            acc.paid += c.paidAmount;
            acc.clearedCount += 1;
            const mode = c.paymentMode || 'Cash';
            acc.paymentStats[mode] = (acc.paymentStats[mode] || 0) + c.paidAmount;
        }

        return acc;
      },
      { salary: 0, gross: 0, bonus: 0, totalAdvance: 0, deduction: 0, salaryToPay: 0, paid: 0, clearedCount: 0, paymentStats: {} }
    );
  }, [filteredRows, daysInMonth]);

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    setPaymentSubmitting(true);
    const res = await callApi("mark_salary_paid", {
      user_id: paymentTarget.user_id || paymentTarget.id,
      branch_id: paymentTarget.branch_id,
      month, year,
      amount: paymentForm.amount !== "" ? parseFloat(paymentForm.amount) : parseFloat(calcRow(paymentTarget, daysInMonth).salaryToPay),
      remarks: paymentForm.remarks,
      payment_mode: paymentForm.payment_mode,
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

  const openMiniLedger = (user) => {
    setInspectedUser(user);
    if (user.days) {
      const daysArray = Object.entries(user.days)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      setInspectorData(daysArray);
    } else {
      setInspectorData([]);
    }
  };

  const handleDownloadSlip = async (row) => {
    setDownloadingId(row.id);
    const res = await callApi("download_salary_slip", { user_id: row.id, month, year });
    if (res.status === "success" && res.url) window.open(res.url, "_blank");
    else alert(res.message || "Failed to generate salary slip PDF.");
    setDownloadingId(null);
  };

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

  const openAdjustModal = async (user) => {
    setAdjustForm({ adjustment_type: "credit", amount: "", reason: "", payment_mode: "Cash" });
    setAdjustModal({ user, adjustments: [], loading: true });
    const res = await callApi("get_post_pay_adjustments", {
      user_id: user.id || user.user_id, month, year,
    });
    setAdjustModal({ user, adjustments: res.status === "success" ? res.data : [], loading: false });
  };

  const handlePostPayAdjust = async (e) => {
    e.preventDefault();
    setAdjustSubmitting(true);
    const res = await callApi("post_pay_adjustment", {
      user_id: adjustModal.user.id || adjustModal.user.user_id,
      branch_id: adjustModal.user.branch_id,
      month, year,
      adjustment_type: adjustForm.adjustment_type,
      amount: parseFloat(adjustForm.amount),
      reason: adjustForm.reason,
      payment_mode: adjustForm.payment_mode,
      admin_id: session?.id,
    });
    setAdjustSubmitting(false);
    if (res.status === "success") {
      await openAdjustModal(adjustModal.user);
      setAdjustForm({ adjustment_type: "credit", amount: "", reason: "", payment_mode: "Cash" });
      fetchAll();
    } else {
      alert(res.message || "Adjustment failed.");
    }
  };

  const handleLogBonus = async (e) => {
    e.preventDefault();
    setBonusSubmitting(true);
    const res = await callApi("log_bonus", {
      user_id: bonusModal.user.id || bonusModal.user.user_id, branch_id: bonusModal.user.branch_id,
      month, year, amount: parseFloat(bonusModal.amount), remarks: bonusModal.remarks, admin_id: session?.id
    });
    setBonusSubmitting(false);
    if (res.status === "success") {
      setBonusModal(null); fetchAll();
    } else alert(res.message || "Failed to log bonus.");
  };

  const openAssetModal = async (user) => {
    setAssetModal({ user, assets: [], assignForm: { item_id: "", cost: "", remarks: "", assigned_date: new Date().toISOString().split('T')[0] }, loading: true });
    const res = await callApi("get_employee_assets", { user_id: user.id || user.user_id });
    setAssetModal(prev => ({ ...prev, assets: res.status === "success" ? res.data : [], loading: false }));
  };

  const handleAssignAsset = async (e) => {
    e.preventDefault();
    setAssetSubmitting(true);
    const res = await callApi("assign_asset", {
      user_id: assetModal.user.id || assetModal.user.user_id, branch_id: assetModal.user.branch_id,
      item_id: assetModal.assignForm.item_id, cost: parseFloat(assetModal.assignForm.cost),
      remarks: assetModal.assignForm.remarks, admin_id: session?.id, assigned_date: assetModal.assignForm.assigned_date
    });
    setAssetSubmitting(false);
    if (res.status === "success") openAssetModal(assetModal.user);
    else alert(res.message || "Failed to assign asset.");
  };

  const handleResolveAsset = async (asset_log_id, resolution, user_id) => {
    if (resolution === 'deducted' && !confirm("This will permanently deduct the asset cost from the employee's current salary as a fine. Proceed?")) return;
    if (resolution === 'waived' && !confirm("This will permanently waive off the asset cost for this employee. Proceed?")) return;
    
    setAssetSubmitting(true);
    const res = await callApi("resolve_asset", { asset_log_id, resolution, admin_id: session?.id, month, year });
    setAssetSubmitting(false);
    
    if (res.status === "success") {
        await fetchAll();
        if (assetModal && (assetModal.user.id === user_id || assetModal.user.user_id === user_id)) {
            setAssetModal(null);
        }
        if (paymentTarget) setPaymentTarget(null);
        if (breakdownModal) setBreakdownModal(null);
    } else alert(res.message || "Failed to resolve asset.");
  };

  // Helper UI component for rendering the side panel inside Breakdown and Payment Modals
  const renderPendingAssets = (pendingAssets, userId) => (
    <div className="space-y-3 mt-4">
      {pendingAssets.map(asset => (
        <div key={asset.id} className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/30 p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
             <div>
                <h4 className="font-black text-sm text-purple-900 dark:text-purple-100">{asset.item_name}</h4>
                <p className="font-mono text-xs font-bold text-purple-700 dark:text-purple-400">₹{parseFloat(asset.cost).toLocaleString("en-IN")}</p>
             </div>
             <span className="bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded">
               {getTimeSince(asset.created_at)}
             </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <button onClick={() => handleResolveAsset(asset.id, 'waived', userId)} disabled={assetSubmitting} className="py-2.5 bg-white dark:bg-black text-emerald-600 hover:bg-emerald-50 text-[10px] font-black uppercase tracking-widest border border-emerald-200 rounded-lg transition-colors">Waive Off</button>
            <button onClick={() => handleResolveAsset(asset.id, 'deducted', userId)} disabled={assetSubmitting} className="py-2.5 bg-white dark:bg-black text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest border border-red-200 rounded-lg transition-colors">Deduct Fine</button>
          </div>
        </div>
      ))}
    </div>
  );

  const totalCleared = filteredRows.filter(p => p.status === 'paid' || p.ledger_status === 'paid').length;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-2rem)] gap-4 md:gap-5 animate-in fade-in duration-500 text-gray-900 dark:text-neutral-200 font-sans w-full min-w-0 max-w-full overflow-hidden">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-4 md:p-5 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm w-full shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
            <Banknote size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Payroll Management</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            Finance Ledger
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 shrink-0 w-full min-w-0">
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] md:text-[10px] uppercase tracking-widest font-black text-gray-400 truncate pr-2">Total Gross</p>
              <IndianRupee size={14} className="text-gray-400 opacity-50 shrink-0" />
            </div>
            <p className="text-xl md:text-2xl font-black tabular-nums truncate text-gray-900 dark:text-white">₹{Math.round(totals.gross).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] md:text-[10px] uppercase tracking-widest font-black text-gray-400 truncate pr-2">Total Bonus</p>
              <Gift size={14} className="text-gray-400 opacity-50 shrink-0" />
            </div>
            <p className="text-xl md:text-2xl font-black tabular-nums truncate text-emerald-500">₹{Math.round(totals.bonus).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] md:text-[10px] uppercase tracking-widest font-black text-gray-400 truncate pr-2">Debts / Fines</p>
              <Wallet size={14} className="text-gray-400 opacity-50 shrink-0" />
            </div>
            <p className="text-xl md:text-2xl font-black tabular-nums truncate text-orange-500">₹{Math.round(totals.totalAdvance + totals.deduction).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] md:text-[10px] uppercase tracking-widest font-black text-gray-400 truncate pr-2">Net Payable</p>
              <Banknote size={14} className="text-gray-400 opacity-50 shrink-0" />
            </div>
            <p className="text-xl md:text-2xl font-black tabular-nums truncate text-indigo-500">₹{Math.round(totals.salaryToPay).toLocaleString("en-IN")}</p>
        </div>
        
        {/* Payment Stats Breakdown Card */}
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-[#0a0a0a] border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] md:text-[10px] uppercase tracking-widest font-black text-emerald-600 dark:text-emerald-500 truncate pr-2">Total Disbursed ({totals.clearedCount} Paid)</p>
              <CheckCircle2 size={14} className="text-emerald-500 opacity-50 shrink-0" />
            </div>
            <p className="text-xl font-black tabular-nums truncate text-emerald-600 dark:text-emerald-400">₹{Math.round(totals.paid).toLocaleString("en-IN")}</p>
            {Object.keys(totals.paymentStats).length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-100 dark:border-emerald-900/30 flex flex-wrap gap-1.5">
                  {Object.entries(totals.paymentStats).map(([mode, amt]) => (
                    <div key={mode} className="text-[9px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/30">
                      {mode}: ₹{amt.toLocaleString("en-IN")}
                    </div>
                  ))}
                </div>
            )}
        </div>
      </div>

      {/* ── TAB SWITCHER + SEARCH ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full min-w-0">
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setViewMode("active")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${viewMode === "active" ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-400 hover:border-emerald-400"}`}
          >
            Active Staff
          </button>
          <button
            onClick={() => setViewMode("deactivated")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${viewMode === "deactivated" ? "bg-red-600 text-white shadow-md shadow-red-500/20" : "bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-400 hover:border-red-400"}`}
          >
            Deactivated
          </button>
        </div>
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, department, or role..." className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm" />
        </div>
      </div>

      {/* ── PAYROLL TABLE ─────────────────────────── */}
      <div className="flex-1 min-h-0 w-full min-w-0 flex flex-col">
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-neutral-700 rounded-3xl overflow-hidden shadow-sm flex flex-col flex-1 min-w-0 min-h-0 relative">
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
            <div className="flex-1 w-full overflow-auto custom-scrollbar relative">
              <table className="w-full text-left border-collapse min-w-[1900px]">
                <thead className="sticky top-0 z-30">
                  <tr className="bg-gray-100 dark:bg-[#050505] backdrop-blur-md text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap shadow-sm">
                    <th className="p-4 md:p-5 sticky left-0 bg-gray-100 dark:bg-[#050505] z-40 border border-gray-300 dark:border-neutral-700 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">Personnel</th>
                    <th className="p-4 md:p-5 text-right border border-gray-300 dark:border-neutral-700">Fixed Salary</th>
                    <th className="p-4 md:p-5 text-right text-blue-600 border border-gray-300 dark:border-neutral-700">Last M. Surplus</th>
                    <th className="p-4 md:p-5 text-center text-blue-600 bg-blue-50/95 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50">Verified Duty</th>
                    <th className="p-4 md:p-5 text-right border border-gray-300 dark:border-neutral-700">Gross Earned</th>
                    <th className="p-4 md:p-5 text-right text-emerald-600 border border-gray-300 dark:border-neutral-700">Bonus</th>
                    <th className="p-4 md:p-5 text-right text-orange-600 border border-gray-300 dark:border-neutral-700">Advances</th>
                    <th className="p-4 md:p-5 text-right text-orange-600 border border-gray-300 dark:border-neutral-700">Shop Bills</th>
                    <th className="p-4 md:p-5 text-right text-red-600 border border-gray-300 dark:border-neutral-700">Deductions</th>
                    <th className="p-4 md:p-5 text-center text-purple-600 border border-gray-300 dark:border-neutral-700">Assets / Extra</th>
                    <th className="p-4 md:p-5 text-left text-gray-500 border border-gray-300 dark:border-neutral-700 min-w-[200px]">Remarks</th>
                    <th className="p-4 md:p-5 text-right bg-emerald-50/95 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-500 border border-emerald-200 dark:border-emerald-900/50">Net Payable</th>
                    <th className="p-4 md:p-5 text-center border border-gray-300 dark:border-neutral-700">Clearance</th>
                    <th className="p-4 md:p-5 text-center border border-gray-300 dark:border-neutral-700">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 dark:divide-neutral-700">
                  {filteredRows.map((row) => {
                    const c = calcRow(row, daysInMonth);
                    const combinedAdvances = c.preAdvance + c.finalAdvance + c.shopAdvance;
                    const isPaid = row.status === 'paid' || row.ledger_status === 'paid';

                    return (
                      <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors group ${isPaid ? 'opacity-70 grayscale-[0.2]' : ''}`}>
                        
                        <td className="p-4 md:p-5 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50 dark:group-hover:bg-[#111] z-20 border border-gray-300 dark:border-neutral-700 shadow-[4px_0_12px_rgba(0,0,0,0.02)] transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-black text-sm md:text-base text-gray-900 dark:text-white whitespace-nowrap mb-0.5 truncate">{row.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest truncate">{row.department} • {row.role}</p>
                                {c.isNegative && (
                                  <span title="Deductions exceed earned salary" className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => setBreakdownModal({ staff: row, math: c, daysInMonth })} className="p-2 bg-gray-100 dark:bg-neutral-800 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:text-emerald-600 rounded-lg transition-colors shrink-0">
                              <Info size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                        
                        <td className="p-4 md:p-5 text-right font-mono font-bold text-sm text-gray-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700">₹{c.salary.toLocaleString("en-IN")}</td>
                        
                        <td className="p-4 md:p-5 text-right font-mono font-bold text-sm text-blue-600 dark:text-blue-400 border border-gray-300 dark:border-neutral-700">
                          {c.surplusCredit > 0 ? `+₹${c.surplusCredit.toLocaleString("en-IN")}` : "—"}
                        </td>

                        <td className="p-0 bg-blue-50/20 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/40">
                          <button onClick={() => openMiniLedger(row)} className="w-full h-full p-4 flex flex-col items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group/btn min-h-[64px]">
                            <div className="flex items-center justify-center gap-1.5 font-mono font-black text-sm text-blue-700 dark:text-blue-400">
                              {c.paidDuty} <span className="text-[10px] text-blue-500/60">/ {daysInMonth}</span>
                            </div>
                            <span className="text-[9px] font-bold text-blue-600/80 uppercase tracking-widest mt-0.5 group-hover/btn:underline flex items-center gap-1">Verify <ChevronRight size={10}/></span>
                          </button>
                        </td>
                        
                        <td className="p-4 md:p-5 text-right font-mono font-bold text-sm text-gray-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700">₹{c.gross.toLocaleString("en-IN")}</td>

                        {/* BONUS COLUMN */}
                        <td className="p-4 md:p-5 text-right border border-gray-300 dark:border-neutral-700">
                          {c.bonus > 0 ? (
                             <button onClick={() => openHistoryModal(row, ["bonus"], "Bonus")} className="font-mono text-sm font-black hover:underline text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-500/30">
                               +₹{c.bonus.toLocaleString("en-IN")}
                             </button>
                          ) : (
                             !isPaid && <button onClick={() => setBonusModal({ user: row, amount: "", remarks: "" })} className="p-1.5 bg-gray-100 dark:bg-neutral-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 rounded text-gray-400 transition-colors"><Gift size={14}/></button>
                          )}
                        </td>

                        <td className="p-4 md:p-5 text-right border border-gray-300 dark:border-neutral-700">
                          {combinedAdvances > 0 ? (
                            <button onClick={() => openHistoryModal(row, ["pre_advance", "final_advance", "shop_advance"], "Advances")} className="font-mono text-sm font-black hover:underline text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20 px-2.5 py-1 rounded-lg transition-colors border border-orange-200 dark:border-orange-500/30">
                              ₹{combinedAdvances.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-400 dark:text-neutral-600">—</span>}
                        </td>

                        <td className="p-4 md:p-5 text-right border border-gray-300 dark:border-neutral-700">
                          {c.shopBill > 0 ? (
                            <button onClick={() => openHistoryModal(row, ["shop_bill"], "Shop Bills")} className="font-mono text-sm font-black hover:underline text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20 px-2.5 py-1 rounded-lg transition-colors border border-orange-200 dark:border-orange-500/30">
                              ₹{c.shopBill.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-400 dark:text-neutral-600">—</span>}
                        </td>

                        <td className="p-4 md:p-5 text-right border border-gray-300 dark:border-neutral-700">
                          {c.deduction > 0 ? (
                            <button onClick={() => openHistoryModal(row, ["fine", "other"], "Deductions")} className="font-mono text-sm font-black hover:underline text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/20 px-2.5 py-1 rounded-lg transition-colors border border-red-200 dark:border-red-900/50">
                              ₹{c.deduction.toLocaleString("en-IN")}
                            </button>
                          ) : <span className="font-mono text-sm text-gray-400 dark:text-neutral-600">—</span>}
                        </td>

                        {/* ASSETS / EXTRAS COLUMN */}
                        <td className="p-4 md:p-5 text-center border border-gray-300 dark:border-neutral-700 relative">
                           <button onClick={() => openAssetModal(row)} className={`font-mono text-xs font-black px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 mx-auto ${c.assetCount > 0 ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600'}`}>
                             <Package size={14}/> {c.assetCount > 0 ? `${c.assetCount} Item(s)` : "Manage"}
                           </button>
                           {c.assetCount > 0 && <span className="absolute top-4 right-4 md:right-8 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
                           {c.assetCount > 0 && <span className="absolute top-4 right-4 md:right-8 w-2 h-2 bg-red-500 rounded-full"></span>}
                        </td>

                        <td className="p-4 md:p-5 text-xs font-bold text-gray-600 dark:text-neutral-400 whitespace-normal break-words min-w-[200px] border border-gray-300 dark:border-neutral-700">
                          {row.remarks || "—"}
                        </td>

                        <td className="p-4 md:p-5 text-right bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/40">
                          {isPaid ? (
                             <div 
                               onClick={() => setPaidDetailModal({ staff: row, math: c })}
                               className="flex flex-col items-end cursor-pointer group/pay hover:bg-emerald-100 dark:hover:bg-emerald-900/30 p-2 -m-2 rounded-xl transition-colors"
                               title="View Detailed Payment Receipt"
                             >
                                <span className="font-mono font-black text-lg text-emerald-700 dark:text-emerald-400 group-hover/pay:text-emerald-800 dark:group-hover/pay:text-emerald-300 transition-colors">
                                  ₹{c.paidAmount.toLocaleString("en-IN")}
                                </span>
                                {/* Carry Forward / Adjustment Indicator */}
                                {c.paidAmount !== c.salaryToPay && (
                                   <span className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded ${c.paidAmount > c.salaryToPay ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                     {c.carryForwardAmount > 0 
                                        ? `${c.carryForwardType === 'overpayment' ? 'Overpaid' : 'Underpaid'} (CF)` 
                                        : 'Adjusted'}
                                   </span>
                                )}
                             </div>
                          ) : (
                             <span className={`font-mono font-black text-lg ${c.isNegative ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                               {c.isNegative ? `-₹${Math.abs(c.theoreticalNet).toLocaleString("en-IN")}` : `₹${c.salaryToPay.toLocaleString("en-IN")}`}
                             </span>
                          )}
                        </td>

                        <td className="p-4 md:p-5 text-center border border-gray-300 dark:border-neutral-700">
                          {isPaid ? (
                             <div className="flex flex-col items-center gap-1.5">
                               <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-300 dark:border-emerald-800/60 shadow-sm">
                                 <CheckCircle2 size={12} strokeWidth={3} /> Paid
                               </span>
                               <span className="text-[8px] font-bold text-gray-500">{new Date(row.processed_at).toLocaleDateString()}</span>
                               <button
                                 onClick={() => openAdjustModal(row)}
                                 className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all border border-blue-200 dark:border-blue-500/20 mt-1"
                               >
                                 <History size={10} /> Adjust
                               </button>
                             </div>
                          ) : c.isNegative ? (
                             <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-red-200 dark:border-red-900/50">
                               <AlertTriangle size={12} strokeWidth={3} /> Debt
                             </span>
                          ) : (
                            <button 
                              onClick={() => {
                                setPaymentTarget({ ...row, c });
                                setPaymentForm({ amount: c.salaryToPay, remarks: row.remarks || "", payment_mode: "Cash" });
                              }}
                              disabled={c.salaryToPay <= 0} 
                              className="inline-flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/30 active:scale-95 disabled:opacity-50 disabled:active:scale-100 whitespace-nowrap"
                            >
                              Pay Salary
                            </button>
                          )}
                        </td>

                        <td className="p-4 md:p-5 text-center border border-gray-300 dark:border-neutral-700">
                          <button onClick={() => handleDownloadSlip(row)} disabled={downloadingId === row.id} className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 hover:border-emerald-500 hover:text-emerald-600 dark:hover:border-emerald-500/60 dark:hover:text-emerald-400 rounded-xl transition-all disabled:opacity-50 shrink-0">
                            {downloadingId === row.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={2.5} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                
                <tfoot className="sticky bottom-0 z-30">
                  <tr className="border-t-2 border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-[#050505] backdrop-blur-md font-black shadow-[0_-4px_12px_rgba(0,0,0,0.02)] text-gray-700 dark:text-neutral-300">
                    <td className="p-4 md:p-5 sticky left-0 z-40 bg-gray-100 dark:bg-[#050505] border border-gray-300 dark:border-neutral-700 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">Grand Total</td>
                    <td className="p-4 md:p-5 text-right font-mono border border-gray-300 dark:border-neutral-700">₹{Math.round(totals.salary).toLocaleString("en-IN")}</td>
                    <td className="p-4 md:p-5 text-right border border-gray-300 dark:border-neutral-700">—</td>
                    <td className="p-4 md:p-5 text-center bg-blue-100/50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-900/50">—</td>
                    <td className="p-4 md:p-5 text-right font-mono text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-neutral-700">₹{Math.round(totals.gross).toLocaleString("en-IN")}</td>
                    <td className="p-4 md:p-5 text-right font-mono text-emerald-600 border border-gray-300 dark:border-neutral-700">₹{Math.round(totals.bonus).toLocaleString("en-IN")}</td>
                    <td className="p-4 md:p-5 text-right font-mono text-orange-600 border border-gray-300 dark:border-neutral-700">—</td>
                    <td className="p-4 md:p-5 text-right font-mono text-orange-600 border border-gray-300 dark:border-neutral-700">—</td>
                    <td className="p-4 md:p-5 text-right font-mono text-red-600 border border-gray-300 dark:border-neutral-700">—</td>
                    <td className="p-4 md:p-5 text-center border border-gray-300 dark:border-neutral-700">—</td>
                    <td className="p-4 md:p-5 text-center border border-gray-300 dark:border-neutral-700">—</td>
                    <td className="p-4 md:p-5 text-right font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-900/60">
                      ₹{Math.round(totals.salaryToPay).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 md:p-5 text-center border border-gray-300 dark:border-neutral-700">—</td>
                    <td className="p-4 md:p-5 text-center border border-gray-300 dark:border-neutral-700">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: DETAILED PAID RECEIPT 
      ══════════════════════════════════════════════════════════════════ */}
      {paidDetailModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-emerald-300 dark:border-emerald-900/70 w-full max-w-md max-h-[90dvh] md:max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-[#111] shrink-0">
              <h2 className="text-base font-black flex items-center gap-2 text-gray-900 dark:text-white">
                <CheckCircle2 size={18} className="text-emerald-600" /> Payment Receipt
              </h2>
              <button onClick={() => setPaidDetailModal(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 transition-colors text-gray-700 dark:text-neutral-300"><X size={16} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Employee</span>
                <span className="font-black text-gray-900 dark:text-white">{paidDetailModal.staff.name}</span>
              </div>
              
              <div className="bg-gray-50 dark:bg-[#111] rounded-2xl p-4 border border-gray-200 dark:border-neutral-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">System Calculated Net</span>
                  <span className="font-mono font-bold text-gray-700 dark:text-neutral-300">₹{paidDetailModal.math.salaryToPay.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-neutral-700">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Actual Disbursed Amount</span>
                  <span className="font-mono font-black text-emerald-600 text-xl">₹{paidDetailModal.math.paidAmount.toLocaleString("en-IN")}</span>
                </div>
                {paidDetailModal.math.carryForwardAmount > 0 && (
                  <div className={`p-3 mt-3 rounded-xl flex items-start gap-2 border ${paidDetailModal.math.carryForwardType === 'overpayment' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50'}`}>
                    <Info size={14} className="shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold uppercase tracking-wider leading-snug">
                      {paidDetailModal.math.carryForwardType === 'overpayment' 
                        ? `Overpaid by ₹${paidDetailModal.math.carryForwardAmount.toLocaleString("en-IN")} (Recorded as advance for next month)` 
                        : `Underpaid by ₹${paidDetailModal.math.carryForwardAmount.toLocaleString("en-IN")} (Credited to next month)`}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Payment Mode</span>
                  <span className="text-sm font-black text-gray-800 dark:text-neutral-200">{paidDetailModal.math.paymentMode}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Disbursed On</span>
                  <span className="text-sm font-black text-gray-800 dark:text-neutral-200">
                    {paidDetailModal.math.processedAt ? new Date(paidDetailModal.math.processedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </span>
                </div>
              </div>

              <div>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Admin Remarks</span>
                 <div className="text-xs font-bold text-gray-700 dark:text-neutral-300 p-4 bg-gray-50 dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-neutral-800 break-words whitespace-pre-wrap leading-relaxed">
                   {paidDetailModal.staff.remarks || "No payment remarks provided."}
                 </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: PAYMENT GATEWAY
      ══════════════════════════════════════════════════════════════════ */}
      {paymentTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className={`bg-white dark:bg-[#0a0a0a] border border-emerald-300 dark:border-emerald-900/70 w-full ${paymentTarget.c.pendingAssets.length > 0 ? 'max-w-4xl' : 'max-w-md'} max-h-[90dvh] md:max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col overflow-hidden`}>
            
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-[#111] shrink-0">
              <h2 className="text-base font-black flex items-center gap-2 text-gray-900 dark:text-white">
                <Banknote size={18} className="text-emerald-600" /> Settle Salary
              </h2>
              <button onClick={() => setPaymentTarget(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 transition-colors text-gray-700 dark:text-neutral-300"><X size={16} /></button>
            </div>
            
            <div className={`flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 ${paymentTarget.c.pendingAssets.length > 0 ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-6'}`}>
              
              <form onSubmit={handleProcessPayment} className="flex flex-col min-h-0 space-y-6">
                <div className="bg-gray-50 dark:bg-neutral-900/60 p-4 rounded-2xl flex flex-col gap-2 border border-gray-200 dark:border-neutral-700">
                   <div className="flex justify-between items-center">
                     <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Employee</p>
                     <p className="text-sm font-black text-gray-900 dark:text-white">{paymentTarget.name}</p>
                   </div>
                   <div className="flex justify-between items-center">
                     <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Gross Earned</p>
                     <p className="font-mono font-bold text-gray-700 dark:text-neutral-300">{formatCurrency(paymentTarget.c.gross)}</p>
                   </div>
                   {paymentTarget.c.bonus > 0 && (
                     <div className="flex justify-between items-center">
                       <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Bonus (+)</p>
                       <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(paymentTarget.c.bonus)}</p>
                     </div>
                   )}
                   <div className="flex justify-between items-center">
                     <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Pending Advances</p>
                     <p className="font-mono font-bold text-orange-600 dark:text-orange-400">-{formatCurrency(paymentTarget.c.totalAdvance)}</p>
                   </div>
                   <div className="flex justify-between items-center">
                     <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Deductions</p>
                     <p className="font-mono font-bold text-red-600 dark:text-red-400">-{formatCurrency(paymentTarget.c.deduction)}</p>
                   </div>
                   {paymentTarget.c.surplusCredit > 0 && (
                     <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                       <p className="text-[10px] font-bold uppercase tracking-widest">Last Month Credit (+)</p>
                       <p className="font-mono font-black">+{formatCurrency(paymentTarget.c.surplusCredit)}</p>
                     </div>
                   )}
                   {paymentTarget.c.overpaymentDebt > 0 && (
                     <div className="flex justify-between items-center text-orange-600 dark:text-orange-400">
                       <p className="text-[10px] font-bold uppercase tracking-widest">Last Month Overpaid (−)</p>
                       <p className="font-mono font-black">-{formatCurrency(paymentTarget.c.overpaymentDebt)}</p>
                     </div>
                   )}
                   <div className="h-px bg-gray-300 dark:bg-neutral-700 my-1"></div>
                   <div className="flex justify-between items-center">
                     <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Net Payable</p>
                     <p className="font-mono font-black text-2xl text-emerald-700 dark:text-emerald-400">{formatCurrency(paymentTarget.c.salaryToPay)}</p>
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-widest pl-1">Amount Being Paid</label>
                    {(() => {
                      const systemCalc = parseFloat(paymentTarget.c.salaryToPay);
                      const adminEntered = parseFloat(paymentForm.amount || systemCalc);
                      const diff = parseFloat((adminEntered - systemCalc).toFixed(2));
                      return (
                        <>
                          <input
                            type="number"
                            required
                            step="0.01"
                            value={paymentForm.amount}
                            onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                            className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-800/60 rounded-2xl px-4 py-3 text-lg font-black font-mono text-emerald-800 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                          />
                          {Math.abs(diff) > 0.01 && (
                            <div className={`text-xs font-bold px-3 py-2 rounded-xl mt-1.5 ${diff > 0 ? "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400" : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"}`}>
                              {diff > 0
                                ? `⚠ Overpayment of ₹${diff.toFixed(2)} — will be recorded as advance carry-forward to next month`
                                : `ℹ Underpayment of ₹${Math.abs(diff).toFixed(2)} — surplus credit recorded for next month`
                              }
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-widest pl-1">Payment Mode</label>
                    <select
                      value={paymentForm.payment_mode}
                      onChange={e => setPaymentForm({...paymentForm, payment_mode: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-widest pl-1">Payment Reference (Optional)</label>
                    <textarea value={paymentForm.remarks} onChange={e => setPaymentForm({...paymentForm, remarks: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none h-16 custom-scrollbar" placeholder="e.g. Paid via NEFT..." />
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl p-3 flex items-start gap-3 mt-auto">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                      <p className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest mb-0.5">Payment Warning</p>
                      <p className="text-xs font-bold text-red-600 dark:text-red-300 leading-snug">
                        This will mark the salary as Paid and automatically clear all pending advances shown above. This cannot be undone.
                      </p>
                  </div>
                </div>
                
                <button type="submit" disabled={paymentSubmitting} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50">
                  {paymentSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} strokeWidth={2.5} />} 
                  Confirm Payment
                </button>
              </form>

              {paymentTarget.c.pendingAssets.length > 0 && (
                 <div className="border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-neutral-800 pt-6 lg:pt-0 lg:pl-6">
                    <h3 className="text-sm font-black flex items-center gap-2 text-purple-600"><Package size={16}/> Pending Extra Items</h3>
                    <div className="space-y-3 mt-4">
                      {paymentTarget.c.pendingAssets.map(asset => (
                        <div key={asset.id} className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/30 p-4 rounded-xl flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2">
                             <div>
                                <h4 className="font-black text-sm text-purple-900 dark:text-purple-100">{asset.item_name}</h4>
                                <p className="font-mono text-xs font-bold text-purple-700 dark:text-purple-400">₹{parseFloat(asset.cost).toLocaleString("en-IN")}</p>
                             </div>
                             <span className="bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded">
                               {getTimeSince(asset.created_at)}
                             </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <button onClick={() => handleResolveAsset(asset.id, 'waived', paymentTarget.id)} disabled={assetSubmitting} className="py-2 bg-white dark:bg-black text-emerald-600 hover:bg-emerald-50 text-[10px] font-black uppercase tracking-widest border border-emerald-200 rounded-lg transition-colors">Waive Off</button>
                            <button onClick={() => handleResolveAsset(asset.id, 'deducted', paymentTarget.id)} disabled={assetSubmitting} className="py-2 bg-white dark:bg-black text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest border border-red-200 rounded-lg transition-colors">Deduct (Fine)</button>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: SALARY BREAKDOWN 
      ══════════════════════════════════════════════════════════════════ */}
      {breakdownModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className={`bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-neutral-700 w-full ${breakdownModal.math.pendingAssets.length > 0 ? 'max-w-4xl' : 'max-w-md'} max-h-[90dvh] md:max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col overflow-hidden`}>
            
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-900/40 shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2"><Info size={16} className="text-emerald-600" /> Math Breakdown</h2>
              <button onClick={() => setBreakdownModal(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 transition-colors"><X size={16} /></button>
            </div>
            
            <div className={`flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 ${breakdownModal.math.pendingAssets.length > 0 ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'} pb-safe`}>
              <div>
                <div>
                  <p className="font-black text-xl text-gray-900 dark:text-white leading-tight">{breakdownModal.staff.name}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{breakdownModal.staff.role}</p>
                </div>

                <div className="space-y-3 font-mono text-sm bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-700 p-5 rounded-2xl mt-6">
                  <div className="flex justify-between text-gray-600 dark:text-neutral-400"><span>Fixed Salary</span><span className="font-bold text-gray-900 dark:text-white">₹{breakdownModal.math.salary.toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between text-gray-600 dark:text-neutral-400"><span>Days in Month</span><span className="font-bold text-gray-900 dark:text-white">{breakdownModal.daysInMonth}</span></div>
                  <div className="flex justify-between text-gray-600 dark:text-neutral-400 border-t border-dashed border-gray-300 dark:border-neutral-700 pt-3"><span>Per-Day Rate</span><span className="font-bold text-gray-900 dark:text-white">₹{breakdownModal.math.perDay.toFixed(2)}</span></div>
                  <div className="flex justify-between text-gray-700 dark:text-neutral-300 pt-3"><span>Total Duty</span><span className="font-bold text-emerald-700">{breakdownModal.math.totalDuty}</span></div>
                  <div className="flex justify-between text-gray-700 dark:text-neutral-300"><span>Paid Leaves <span className="text-[10px] text-gray-500">(Cap {breakdownModal.math.leaveCap})</span></span><span className="font-bold text-blue-600">+{breakdownModal.math.paidLeaves}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 dark:text-neutral-200 border-t border-dashed border-gray-300 dark:border-neutral-700 pt-3"><span>Paid Duty</span><span>{breakdownModal.math.paidDuty}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 dark:text-neutral-200"><span>Gross Earned</span><span>₹{parseFloat(breakdownModal.math.gross).toLocaleString("en-IN")}</span></div>
                  
                  {breakdownModal.math.bonus > 0 && <div className="flex justify-between text-emerald-600 font-bold pt-3 border-t border-dashed border-gray-300 dark:border-neutral-700"><span>Bonuses</span><span>+₹{breakdownModal.math.bonus.toFixed(0)}</span></div>}
                  {breakdownModal.math.totalAdvance > 0 && <div className="flex justify-between text-orange-600 font-bold"><span>Advances (Pending)</span><span>−₹{breakdownModal.math.totalAdvance.toFixed(0)}</span></div>}
                  {breakdownModal.math.deduction > 0 && <div className="flex justify-between text-red-600 font-bold"><span>Fines & Deductions</span><span>−₹{breakdownModal.math.deduction.toFixed(0)}</span></div>}
                  
                  {breakdownModal.math.surplusCredit > 0 && <div className="flex justify-between text-blue-600 font-bold pt-3 border-t border-dashed border-gray-300 dark:border-neutral-700"><span>Previous Underpayment Credit</span><span>+₹{breakdownModal.math.surplusCredit.toFixed(0)}</span></div>}
                  {breakdownModal.math.overpaymentDebt > 0 && <div className="flex justify-between text-orange-600 font-bold pt-3 border-t border-dashed border-gray-300 dark:border-neutral-700"><span>Previous Overpayment Debt</span><span>−₹{breakdownModal.math.overpaymentDebt.toFixed(0)}</span></div>}
                </div>

                <div className={`flex justify-between items-center px-5 py-4 rounded-2xl border mt-6 ${breakdownModal.math.isNegative ? 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-900/60' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-900/60'}`}>
                  <span className={`text-xs font-black uppercase tracking-widest ${breakdownModal.math.isNegative ? 'text-red-700 dark:text-red-400' : 'text-emerald-800 dark:text-emerald-400'}`}>Net Payable</span>
                  <span className={`font-mono font-black text-2xl ${breakdownModal.math.isNegative ? 'text-red-700 dark:text-red-400' : 'text-emerald-800 dark:text-emerald-400'}`}>
                    {breakdownModal.math.isNegative ? `-₹${Math.abs(breakdownModal.math.theoreticalNet).toLocaleString("en-IN")}` : `₹${parseFloat(breakdownModal.math.salaryToPay).toLocaleString("en-IN")}`}
                  </span>
                </div>
              </div>

              {breakdownModal.math.pendingAssets.length > 0 && (
                 <div className="border-t md:border-t-0 md:border-l border-gray-200 dark:border-neutral-800 pt-5 md:pt-0 md:pl-6">
                    <h3 className="text-sm font-black flex items-center gap-2 text-purple-600"><Package size={16}/> Pending Extra Items</h3>
                    <div className="space-y-3 mt-4">
                      {breakdownModal.math.pendingAssets.map(asset => (
                        <div key={asset.id} className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/30 p-4 rounded-xl flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2">
                             <div>
                                <h4 className="font-black text-sm text-purple-900 dark:text-purple-100">{asset.item_name}</h4>
                                <p className="font-mono text-xs font-bold text-purple-700 dark:text-purple-400">₹{parseFloat(asset.cost).toLocaleString("en-IN")}</p>
                             </div>
                             <span className="bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded">
                               {getTimeSince(asset.created_at)}
                             </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <button onClick={() => handleResolveAsset(asset.id, 'waived', breakdownModal.staff.id)} disabled={assetSubmitting} className="py-2 bg-white dark:bg-black text-emerald-600 hover:bg-emerald-50 text-[10px] font-black uppercase tracking-widest border border-emerald-200 rounded-lg transition-colors">Waive Off</button>
                            <button onClick={() => handleResolveAsset(asset.id, 'deducted', breakdownModal.staff.id)} disabled={assetSubmitting} className="py-2 bg-white dark:bg-black text-red-600 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest border border-red-200 rounded-lg transition-colors">Deduct (Fine)</button>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: UNIFIED HISTORY 
      ══════════════════════════════════════════════════════════════════ */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-neutral-700 w-full md:max-w-md max-h-[90dvh] md:max-h-[85vh] flex flex-col rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 overflow-hidden">
            
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-900/40 shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2"><History size={16} className="text-blue-600" /> {historyModal.label} History</h2>
              <button onClick={() => setHistoryModal(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 transition-colors"><X size={16} /></button>
            </div>
            
            <div className="p-5 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-neutral-800 shrink-0">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Employee Profile</p>
              <p className="font-black text-gray-900 dark:text-white text-lg">{historyModal.user.name}</p>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 pb-safe space-y-4">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-200 dark:border-neutral-700 pb-2">Records for Selected Month</p>
              
              {historyModal.loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
              ) : historyModal.data.length === 0 ? (
                <div className="text-center text-gray-500 font-bold py-10 text-sm">No transactions found.</div>
              ) : (
                <div className="space-y-4">
                  {historyModal.data.map(txn => {
                    const T = TYPE_MAP[txn.type] || TYPE_MAP.other;
                    const isCleared = txn.clearance_status === 'cleared';
                    return (
                      <div key={txn.id} className={`border rounded-2xl p-4 shadow-sm transition-all ${isCleared ? 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 opacity-60' : 'bg-white dark:bg-[#050505] border-gray-300 dark:border-neutral-600'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${T.bg} ${T.color} border-current opacity-80 mb-1`}>{T.label}</span>
                            <p className={`font-mono font-black text-lg leading-none ${T.color}`}>₹{parseFloat(txn.amount).toLocaleString("en-IN")}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{formatDateTime(txn.created_at)}</span>
                            {isCleared ? (
                               <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase tracking-widest">Cleared</span>
                            ) : (
                               <span className="text-[8px] font-black bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase tracking-widest animate-pulse">Pending</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-neutral-300 font-medium mb-3 leading-snug">{txn.remarks || "No remarks"}</p>
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-neutral-800">
                          <div className="w-5 h-5 rounded-md bg-gray-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-black text-gray-600">{txn.logged_by_name?.charAt(0) || "?"}</div>
                          <span className="text-[10px] font-bold text-gray-500">Logged by <span className="text-gray-800 dark:text-neutral-200">{txn.logged_by_name || "System"}</span></span>
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

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: POST-PAY ADJUSTMENT
      ══════════════════════════════════════════════════════════════════ */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-neutral-700 w-full md:max-w-lg max-h-[90dvh] md:max-h-[85vh] flex flex-col rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 overflow-hidden">
            
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-900/40 shrink-0">
              <div>
                <h2 className="text-sm font-black flex items-center gap-2 text-gray-900 dark:text-white"><History size={16} className="text-blue-600" /> Post-Pay Adjustment</h2>
                <p className="text-[10px] font-bold text-gray-500 mt-0.5">{adjustModal.user.name} • {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month-1]} {year}</p>
              </div>
              <button onClick={() => setAdjustModal(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 transition-colors"><X size={16} /></button>
            </div>

            <div className="p-5 border-b border-gray-100 dark:border-neutral-800 shrink-0">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Previous Adjustments</p>
              {adjustModal.loading ? (
                <div className="text-xs text-gray-400 animate-pulse py-2">Loading...</div>
              ) : adjustModal.adjustments.length === 0 ? (
                <div className="text-xs text-gray-400 py-2">No adjustments recorded yet for this month.</div>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                  {adjustModal.adjustments.map((adj, i) => (
                    <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold ${adj.adjustment_type === 'credit' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
                      <div className="min-w-0">
                        <span className={adj.adjustment_type === 'credit' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                          {adj.adjustment_type === 'credit' ? '+ Credit' : '− Debit'}
                        </span>
                        <span className="ml-2 text-gray-600 dark:text-neutral-400 truncate">{adj.reason || "—"}</span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className={adj.adjustment_type === 'credit' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
                          {adj.adjustment_type === 'credit' ? '+' : '-'}₹{parseFloat(adj.amount).toFixed(2)}
                        </div>
                        <div className="text-gray-400 font-normal text-[10px]">{adj.logged_by_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handlePostPayAdjust} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 pb-safe">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">New Adjustment</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setAdjustForm(f => ({ ...f, adjustment_type: "credit" }))} className={`py-2.5 rounded-xl text-sm font-black transition-all ${adjustForm.adjustment_type === "credit" ? "bg-emerald-600 text-white shadow-md" : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"}`}>
                  + Credit
                </button>
                <button type="button" onClick={() => setAdjustForm(f => ({ ...f, adjustment_type: "debit" }))} className={`py-2.5 rounded-xl text-sm font-black transition-all ${adjustForm.adjustment_type === "debit" ? "bg-red-600 text-white shadow-md" : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"}`}>
                  − Debit
                </button>
              </div>
              <input type="number" step="0.01" min="0.01" required value={adjustForm.amount} onChange={e => setAdjustForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount (₹)" className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-[#111] text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white" />
              <input type="text" required value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for adjustment (required)" className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-[#111] text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white" />
              <select value={adjustForm.payment_mode} onChange={e => setAdjustForm(f => ({ ...f, payment_mode: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-[#111] text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white">
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
              <button type="submit" disabled={adjustSubmitting} className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-sm disabled:opacity-50 active:scale-[0.98] transition-all">
                {adjustSubmitting ? "Saving..." : "Record Adjustment"}
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
          <div className="fixed top-0 right-0 bottom-0 w-full md:w-[450px] bg-white dark:bg-[#050505] shadow-[-10px_0_40px_rgba(0,0,0,0.1)] z-[110] flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-300 dark:border-neutral-700">
            
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#0a0a0a] shrink-0 pb-safe-top">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-sm">
                    {inspectedUser.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight">{inspectedUser.name}</h2>
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Verification Ledger</p>
                  </div>
                </div>
                <button onClick={() => setInspectedUser(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors"><X size={16} className="text-gray-700 dark:text-neutral-300" /></button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white dark:bg-[#111] border border-gray-300 dark:border-neutral-700 p-2.5 rounded-xl text-center">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Present</p>
                  <p className="font-mono font-black text-emerald-700 dark:text-emerald-400">{(inspectedUser.present || 0) + ((inspectedUser.half_day || 0) * 0.5)} Days</p>
                </div>
                <div className="bg-white dark:bg-[#111] border border-gray-300 dark:border-neutral-700 p-2.5 rounded-xl text-center">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Paid Leaves</p>
                  <p className="font-mono font-black text-blue-700 dark:text-blue-400">{inspectedUser.paid_leaves || 0}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 p-2.5 rounded-xl text-center">
                  <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest mb-0.5">Total Duty</p>
                  <p className="font-mono font-black text-blue-800 dark:text-blue-400">{(inspectedUser.total_duty || 0) + (inspectedUser.paid_leaves || 0)} Days</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5 bg-white dark:bg-[#050505]">
              {inspectorData.length === 0 ? (
                <div className="text-center py-20 text-gray-500 font-bold text-sm">No duty records found this month.</div>
              ) : (
                <div className="space-y-3 pb-safe">
                  {inspectorData.map((day, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-700 p-3.5 rounded-2xl">
                      <div>
                        <p className="text-xs font-black text-gray-900 dark:text-white mb-0.5">{new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                           {day.status === 'F' && <span className="text-emerald-600 font-bold text-[10px] uppercase">Full Day</span>}
                           {day.status === 'H' && <span className="text-yellow-600 font-bold text-[10px] uppercase">Half Day</span>}
                           {day.status === 'L' && <span className="text-blue-600 font-bold text-[10px] uppercase">Leave</span>}
                           {day.status === 'PH' && <span className="text-purple-600 font-bold text-[10px] uppercase">Paid Holiday</span>}
                           {(day.status === 'A' || day.status === 'M') && <span className="text-red-600 font-bold text-[10px] uppercase">Absent</span>}
                           {day.override && <span className="bg-gray-200 dark:bg-neutral-800 text-gray-500 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm">Override</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-black text-xs text-gray-800 dark:text-neutral-200">
                          {day.first_in ? new Date(day.first_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"} to {day.last_out ? new Date(day.last_out).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </p>
                        <p className="text-[10px] font-bold text-gray-500 font-mono mt-0.5">{day.hours > 0 ? `${day.hours}h Worked` : "No punches"}</p>
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
          MODAL: LOG BONUS
      ══════════════════════════════════════════════════════════════════ */}
      {bonusModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-emerald-300 dark:border-emerald-900/70 w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/20 shrink-0">
              <h2 className="text-base font-black flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Gift size={18} /> Award Bonus
              </h2>
              <button onClick={() => setBonusModal(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 transition-colors text-gray-700 dark:text-neutral-300"><X size={16} /></button>
            </div>
            
            <form onSubmit={handleLogBonus} className="p-5 md:p-6 space-y-5 pb-safe">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-widest pl-1">Bonus Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black font-mono">₹</span>
                  <input required type="number" step="0.01" min="1" value={bonusModal.amount} onChange={e => setBonusModal({...bonusModal, amount: e.target.value})} placeholder="0.00" className="w-full bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-2xl py-3.5 pl-8 pr-4 text-base font-black font-mono text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-widest pl-1">Reason for Bonus</label>
                <textarea required value={bonusModal.remarks} onChange={e => setBonusModal({...bonusModal, remarks: e.target.value})} placeholder="e.g. Excellent performance this month..." className="w-full bg-gray-50 dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded-2xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none h-20 custom-scrollbar" />
              </div>
              <button type="submit" disabled={bonusSubmitting} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50">
                {bonusSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} strokeWidth={2.5} />} 
                Add to this Month's Pay
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ASSET / EXTRA ITEM MANAGER
      ══════════════════════════════════════════════════════════════════ */}
      {assetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-purple-300 dark:border-purple-900/70 w-full max-w-2xl max-h-[90dvh] md:max-h-[85vh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col overflow-hidden">
            
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-purple-50/50 dark:bg-[#111] shrink-0">
              <div>
                <h2 className="text-base font-black flex items-center gap-2 text-purple-700 dark:text-purple-400">
                  <Package size={18} /> Company Assets & Extras
                </h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{assetModal.user.name}</p>
              </div>
              <button onClick={() => setAssetModal(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 transition-colors text-gray-700 dark:text-neutral-300"><X size={16} /></button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
              {/* Left: Active Assets List */}
              <div className="w-full md:w-3/5 p-4 md:p-6 overflow-y-auto custom-scrollbar border-b md:border-b-0 md:border-r border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#050505]">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Assigned Assets</h3>
                {assetModal.loading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-purple-500" size={24} /></div>
                ) : assetModal.assets.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                     <Package size={32} className="mx-auto text-gray-400 mb-3" />
                     <p className="text-sm font-bold text-gray-500">No items currently assigned.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assetModal.assets.map(asset => (
                      <div key={asset.id} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-black text-sm text-gray-900 dark:text-white">{asset.item_name}</p>
                          {asset.status === 'pending' ? (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-orange-100 text-orange-600 border border-orange-200">Pending</span>
                          ) : asset.status === 'waived' ? (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600 border border-emerald-200">Waived Off</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-100 text-red-600 border border-red-200">Deducted</span>
                          )}
                        </div>
                        <p className="font-mono text-xs font-bold text-gray-500 mb-3">Cost: ₹{parseFloat(asset.cost).toLocaleString("en-IN")}</p>
                        
                        {asset.status === 'pending' && (
                          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
                            <button onClick={() => handleResolveAsset(asset.id, 'waived', assetModal.user.id)} disabled={assetSubmitting} className="py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200 transition-colors disabled:opacity-50">
                              Waive Off
                            </button>
                            <button onClick={() => handleResolveAsset(asset.id, 'deducted', assetModal.user.id)} disabled={assetSubmitting || assetModal.user.isPaid} title={assetModal.user.isPaid ? 'Salary already paid' : ''} className="py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-200 transition-colors disabled:opacity-50">
                              Deduct Cost
                            </button>
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-3">
                           <p className="text-[9px] font-bold text-gray-400">Given: {new Date(asset.created_at).toLocaleDateString()}</p>
                           <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest">{getTimeSince(asset.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Assign New Form */}
              <div className="w-full md:w-2/5 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0a0a0a]">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Assign New Item</h3>
                <form onSubmit={handleAssignAsset} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-widest pl-1">Select Item</label>
                    <select
                      required
                      value={assetModal.assignForm.item_id}
                      onChange={e => {
                        const itm = globalInventory.find(i => String(i.id) === e.target.value);
                        setAssetModal(prev => ({...prev, assignForm: {...prev.assignForm, item_id: e.target.value, cost: itm ? itm.default_cost : ""}}));
                      }}
                      className="w-full bg-gray-50 dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      <option value="">-- Choose Item --</option>
                      {globalInventory.map(inv => <option key={inv.id} value={inv.id}>{inv.item_name} (₹{inv.default_cost})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-widest pl-1">Applicable Cost</label>
                    <input required type="number" step="1" min="0" value={assetModal.assignForm.cost} onChange={e => setAssetModal(p => ({...p, assignForm: {...p.assignForm, cost: e.target.value}}))} placeholder="0.00" className="w-full bg-gray-50 dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50" />
                  </div>
                  
                  {/* NEW FIELD: Historical Assignment Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-widest pl-1">Date Given</label>
                    <input 
                      required 
                      type="date" 
                      value={assetModal.assignForm.assigned_date} 
                      onChange={e => setAssetModal(p => ({...p, assignForm: {...p.assignForm, assigned_date: e.target.value}}))} 
                      max={new Date().toISOString().split('T')[0]} 
                      className="w-full bg-gray-50 dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-widest pl-1">Remarks</label>
                    <textarea value={assetModal.assignForm.remarks} onChange={e => setAssetModal(p => ({...p, assignForm: {...p.assignForm, remarks: e.target.value}}))} placeholder="Optional notes..." className="w-full bg-gray-50 dark:bg-[#111] border border-gray-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 resize-none h-16" />
                  </div>
                  <button type="submit" disabled={assetSubmitting || !assetModal.assignForm.item_id} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-2">
                    {assetSubmitting ? "Assigning..." : "Assign Item"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}