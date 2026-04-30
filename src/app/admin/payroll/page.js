"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { callApi } from "@/lib/apiClient";
import {
  Banknote,
  Building2,
  Calendar,
  ChevronDown,
  Download,
  FileText,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
  CheckCircle2,
  Clock3,
  IndianRupee,
} from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");

function calcPaidHolidays(daysPresent, cap) {
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
  const leaveCap = parseInt(row.max_paid_leaves || row.paid_leaves || 4);
  const paidLeaves = calcPaidHolidays(totalDuty, leaveCap);
  const paidDuty = totalDuty + paidLeaves;
  const perDay = daysInMonth > 0 ? salary / daysInMonth : 0;

  const preAdvance = parseFloat(row.pre_advance || 0);
  const finalAdvance = parseFloat(row.final_advance || 0);
  const shopAdvance = parseFloat(row.shop_advance || 0);
  const shopBill = parseFloat(row.shop_bill || 0);
  const deduction = parseFloat(row.deduction || 0);
  const paid = parseFloat(row.paid || 0);

  const totalAdvance = preAdvance + finalAdvance + shopAdvance + shopBill;
  const salaryToPay = Math.max(0, perDay * paidDuty - totalAdvance - deduction);
  const advanceDue = paid - salaryToPay;

  return {
    salary,
    totalDuty,
    leaveCap,
    paidLeaves,
    paidDuty,
    perDay,
    preAdvance,
    finalAdvance,
    shopAdvance,
    shopBill,
    totalAdvance,
    deduction,
    salaryToPay,
    paid,
    advanceDue,
  };
}

function MoneyCell({ value, timestamps = [], label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const amount = parseFloat(value || 0);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!amount) {
    return <span className="text-gray-300 dark:text-neutral-700">—</span>;
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-mono font-bold hover:underline underline-offset-2"
        title={`View ${label} history`}
      >
        ₹{amount.toLocaleString("en-IN")}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 z-50 w-72 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xl p-4 text-left">
          <p className="text-sm font-black text-black dark:text-white mb-3">
            {label} History
          </p>

          {timestamps?.length ? (
            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
              {timestamps.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-100 dark:border-neutral-900 bg-gray-50 dark:bg-black p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      ₹{parseFloat(item.amount || 0).toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {item.type || "entry"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {item.logged_by_name || "System"} •{" "}
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString("en-IN")
                      : "No timestamp"}
                  </p>
                  {item.remarks ? (
                    <p className="text-[11px] text-gray-400 mt-1">{item.remarks}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No timestamped entries available.</p>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownTooltip({ row, daysInMonth }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const c = calcRow(row, daysInMonth);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-mono font-black text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
      >
        ₹{c.salaryToPay.toFixed(0)}
        <Info size={13} className="text-emerald-500" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 z-50 w-80 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xl p-4">
          <p className="font-black text-sm text-black dark:text-white mb-3">
            Formula Breakdown
          </p>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between text-gray-500">
              <span>Monthly Salary</span>
              <span>₹{c.salary.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Days in Month</span>
              <span>{daysInMonth}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-gray-200 dark:border-neutral-800 pt-2">
              <span>Per Day Rate</span>
              <span>₹{c.perDay.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Duty</span>
              <span>{c.totalDuty}</span>
            </div>
            <div className="flex justify-between text-blue-600 dark:text-blue-400">
              <span>Paid Leaves</span>
              <span>+{c.paidLeaves}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Paid Duty</span>
              <span>{c.paidDuty}</span>
            </div>
            <div className="flex justify-between border-t border-dashed border-gray-200 dark:border-neutral-800 pt-2">
              <span>Gross Salary</span>
              <span>₹{(c.perDay * c.paidDuty).toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>Total Advance</span>
              <span>−₹{c.totalAdvance.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>Deduction</span>
              <span>−₹{c.deduction.toFixed(0)}</span>
            </div>
            <div className="flex justify-between font-black text-sm text-emerald-700 dark:text-emerald-400 border-t border-gray-200 dark:border-neutral-800 pt-2">
              <span>Salary To Pay</span>
              <span>₹{c.salaryToPay.toFixed(0)}</span>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 mt-3">
            Formula: (Monthly Salary ÷ Total Days) × (Total Duty + Paid Leaves) −
            Advances − Deductions
          </p>
        </div>
      )}
    </div>
  );
}

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

  const daysInMonth = new Date(year, month, 0).getDate();

  const fetchAll = async () => {
    setLoading(true);

    const [branchesRes, payrollRes] = await Promise.all([
      callApi("get_branches"),
      callApi("get_global_payroll_data", {
        month,
        year,
        branch_id: branchId === "all" ? "" : branchId,
      }),
    ]);

    if (branchesRes.status === "success") setBranches(branchesRes.data || []);
    if (payrollRes.status === "success") setRows(payrollRes.data || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [month, year, branchId]);

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
        acc.totalAdvance += c.totalAdvance;
        acc.deduction += c.deduction;
        acc.salaryToPay += c.salaryToPay;
        acc.paid += c.paid;
        return acc;
      },
      { salary: 0, totalAdvance: 0, deduction: 0, salaryToPay: 0, paid: 0 }
    );
  }, [filteredRows, daysInMonth]);

  const handleMarkPaid = async (row) => {
    setMarkingPaidId(row.id);
    const c = calcRow(row, daysInMonth);

    const res = await callApi("mark_salary_paid", {
      user_id: row.id,
      month,
      year,
      amount: c.salaryToPay,
      branch_id: row.branch_id,
    });

    if (res.status === "success") {
      fetchAll();
    } else {
      alert(res.message || "Failed to mark salary as paid.");
    }

    setMarkingPaidId(null);
  };

  const handleDownloadSlip = async (row) => {
    setDownloadingId(row.id);

    const res = await callApi("download_salary_slip", {
      user_id: row.id,
      month,
      year,
    });

    if (res.status === "success" && res.url) {
      window.open(res.url, "_blank");
    } else {
      alert(res.message || "Failed to generate salary slip PDF.");
    }

    setDownloadingId(null);
  };

  return (
    <div className="text-gray-900 dark:text-neutral-200 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="border-b border-gray-200 dark:border-neutral-800 pb-6">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-500 mb-2">
            <Banknote size={20} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase">
              Global Payroll Engine
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-black dark:text-white tracking-tight">
            Payroll & Finance Master Sheet
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-neutral-500 max-w-4xl mt-2">
            This is the central salary engine for all branches. It mirrors your Excel
            logic and calculates salary payable from attendance, paid leave slabs,
            advances, bills, deductions, and payout status.
          </p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {[
            { label: "Salary Base", value: totals.salary, color: "text-blue-600 dark:text-blue-400", icon: IndianRupee },
            { label: "Total Advance", value: totals.totalAdvance, color: "text-orange-600 dark:text-orange-400", icon: Wallet },
            { label: "Deductions", value: totals.deduction, color: "text-red-500", icon: Clock3 },
            { label: "Salary To Pay", value: totals.salaryToPay, color: "text-emerald-600 dark:text-emerald-400", icon: Banknote },
            { label: "Already Paid", value: totals.paid, color: "text-purple-600 dark:text-purple-400", icon: CheckCircle2 },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {card.label}
                </p>
                <card.icon size={16} className="text-gray-400" />
              </div>
              <p className={`text-2xl md:text-3xl font-black tabular-nums ${card.color}`}>
                ₹{Math.round(card.value).toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-neutral-400">
            <Filter size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">
              Filters & Scope
            </span>
            <button
              onClick={fetchAll}
              className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee, branch, role..."
                className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="relative">
              <Building2
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full appearance-none bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-10 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="all">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <Calendar
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full appearance-none bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-10 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-sm">
          <p className="font-bold text-blue-700 dark:text-blue-300">
            Formula Applied
          </p>
          <p className="text-blue-600 dark:text-blue-400 font-mono text-xs mt-1">
            (Monthly Salary ÷ {daysInMonth}) × (Total Duty + Paid Leaves) − Pre Advance − Final Advance − Shop Advance − Shop Bill − Deduction
          </p>
        </div>

        <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={30} className="animate-spin text-emerald-500" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FileText size={32} className="mb-3 opacity-40" />
              <p className="font-bold">No payroll data found for this filter.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[2200px] text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="p-4 sticky left-0 z-20 bg-gray-50 dark:bg-[#0a0a0a]">Employee</th>
                    <th className="p-4">Branch</th>
                    <th className="p-4 text-right">Salary</th>
                    <th className="p-4 text-right">Pre Advance</th>
                    <th className="p-4 text-right">Final Advance</th>
                    <th className="p-4 text-right">Shop Advance</th>
                    <th className="p-4 text-right">Shop Bill</th>
                    <th className="p-4 text-center">Paid Leaves</th>
                    <th className="p-4 text-center">Total Duty</th>
                    <th className="p-4 text-center">Paid Duty</th>
                    <th className="p-4 text-right">Total Advance</th>
                    <th className="p-4 text-right">Deduction</th>
                    <th className="p-4 text-right bg-emerald-50 dark:bg-emerald-900/10">Salary To Pay</th>
                    <th className="p-4 text-right">Paid</th>
                    <th className="p-4 text-right">Advance / Due</th>
                    <th className="p-4 text-center">Mark Paid</th>
                    <th className="p-4 text-center">PDF</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                  {filteredRows.map((row) => {
                    const c = calcRow(row, daysInMonth);

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/60 transition-colors"
                      >
                        <td className="p-4 sticky left-0 z-10 bg-white dark:bg-black">
                          <p className="font-bold text-sm text-black dark:text-white">
                            {row.name}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                            {row.role}
                          </p>
                        </td>

                        <td className="p-4 text-sm font-medium text-gray-600 dark:text-neutral-400">
                          {row.branch_name || "—"}
                        </td>

                        <td className="p-4 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                          ₹{c.salary.toLocaleString("en-IN")}
                        </td>

                        <td className="p-4 text-right font-mono text-red-500">
                          <MoneyCell value={c.preAdvance} timestamps={row.pre_advance_history} label="Pre Advance" />
                        </td>

                        <td className="p-4 text-right font-mono text-red-500">
                          <MoneyCell value={c.finalAdvance} timestamps={row.final_advance_history} label="Final Advance" />
                        </td>

                        <td className="p-4 text-right font-mono text-orange-500">
                          <MoneyCell value={c.shopAdvance} timestamps={row.shop_advance_history} label="Shop Advance" />
                        </td>

                        <td className="p-4 text-right font-mono text-orange-500">
                          <MoneyCell value={c.shopBill} timestamps={row.shop_bill_history} label="Shop Bill" />
                        </td>

                        <td className="p-4 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                          {c.paidLeaves}
                        </td>

                        <td className="p-4 text-center font-mono font-black text-black dark:text-white">
                          {c.totalDuty}
                        </td>

                        <td className="p-4 text-center font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {c.paidDuty}
                        </td>

                        <td className="p-4 text-right font-mono font-black text-orange-600 dark:text-orange-400">
                          ₹{c.totalAdvance.toFixed(0)}
                        </td>

                        <td className="p-4 text-right font-mono font-black text-red-500">
                          <MoneyCell value={c.deduction} timestamps={row.deduction_history} label="Deduction" />
                        </td>

                        <td className="p-4 text-right bg-emerald-50 dark:bg-emerald-900/10">
                          <BreakdownTooltip row={row} daysInMonth={daysInMonth} />
                        </td>

                        <td className="p-4 text-right font-mono font-black text-purple-600 dark:text-purple-400">
                          ₹{c.paid.toFixed(0)}
                        </td>

                        <td className="p-4 text-right font-mono font-black">
                          <span
                            className={
                              c.advanceDue > 0
                                ? "text-red-500"
                                : c.advanceDue < 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-gray-400"
                            }
                          >
                            ₹{Math.abs(c.advanceDue).toFixed(0)}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleMarkPaid(row)}
                            disabled={markingPaidId === row.id}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                          >
                            {markingPaidId === row.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            Paid
                          </button>
                        </td>

                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDownloadSlip(row)}
                            disabled={downloadingId === row.id}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 hover:border-emerald-500 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                          >
                            {downloadingId === row.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} />
                            )}
                            PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#0a0a0a] font-black">
                    <td className="p-4 sticky left-0 z-10 bg-gray-50 dark:bg-[#0a0a0a]">
                      Grand Total
                    </td>
                    <td className="p-4">—</td>
                    <td className="p-4 text-right font-mono">₹{Math.round(totals.salary).toLocaleString("en-IN")}</td>
                    <td className="p-4 text-right">—</td>
                    <td className="p-4 text-right">—</td>
                    <td className="p-4 text-right">—</td>
                    <td className="p-4 text-right">—</td>
                    <td className="p-4 text-center">—</td>
                    <td className="p-4 text-center">—</td>
                    <td className="p-4 text-center">—</td>
                    <td className="p-4 text-right font-mono text-orange-600 dark:text-orange-400">
                      ₹{Math.round(totals.totalAdvance).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right font-mono text-red-500">
                      ₹{Math.round(totals.deduction).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10">
                      ₹{Math.round(totals.salaryToPay).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right font-mono text-purple-600 dark:text-purple-400">
                      ₹{Math.round(totals.paid).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right">—</td>
                    <td className="p-4 text-center">—</td>
                    <td className="p-4 text-center">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
