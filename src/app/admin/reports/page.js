"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { callApi } from "@/lib/apiClient";
import {
  FileText, Building2, Calendar, ChevronDown, 
  Search, Download, Loader2, Printer, UserCircle,
  FileSpreadsheet, Activity, Briefcase, Banknote, History
} from "lucide-react";

const formatCurrency = (val) => `₹${parseFloat(val || 0).toLocaleString("en-IN")}`;

const TYPE_MAP = {
  pre_advance: "Pre-Advance", final_advance: "Final Advance", shop_advance: "Shop Adv",
  shop_bill: "Shop Bill", fine: "Fine/Penalty", repayment: "Repayment", other: "Other"
};

export default function MasterReportsEngine() {
  const now = new Date();
  const [finMonth, setFinMonth] = useState(now.getMonth() + 1);
  const [finYear, setFinYear] = useState(now.getFullYear());
  
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [branchFilter, setBranchFilter] = useState("all");
  const [reportType, setReportType] = useState("payroll");
  const [targetUser, setTargetUser] = useState("");
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadGlobals = useCallback(async () => {
    const [bRes, uRes] = await Promise.all([callApi("get_branches"), callApi("get_users")]);
    if (bRes.status === "success") setBranches(bRes.data || []);
    if (uRes.status === "success") setUsers((uRes.data || []).filter(u => u.status === 'active' && u.role !== 'admin'));
  }, []);

  useEffect(() => { loadGlobals(); }, [loadGlobals]);

  const generateReport = async () => {
    if (reportType === 'employee_dossier' && !targetUser) return alert("Select an employee first.");
    
    setLoading(true);
    setReportData(null); // Clear previous
    const res = await callApi("get_master_report", {
      report_type: reportType,
      branch_id: branchFilter,
      month: finMonth,
      year: finYear,
      target_user_id: targetUser
    });
    
    if (res.status === "success") {
      setReportData(res.data);
    } else {
      alert(res.message || "Failed to generate report.");
    }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  // For array-based reports
  const filteredData = useMemo(() => {
    if (!Array.isArray(reportData) || !searchQuery) return reportData || [];
    const q = searchQuery.toLowerCase();
    return reportData.filter(r => 
      r.name?.toLowerCase().includes(q) || r.department?.toLowerCase().includes(q) || r.branch_name?.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  const totals = useMemo(() => {
    if (!Array.isArray(filteredData)) return 0;
    if (reportType === 'payroll') return filteredData.reduce((acc, r) => acc + parseFloat(r.paid_amount || 0), 0);
    if (reportType === 'finance') return filteredData.reduce((acc, r) => acc + parseFloat(r.amount || 0), 0);
    if (reportType === 'finance_summary') return filteredData.reduce((acc, r) => acc + parseFloat(r.total_amount || 0), 0);
    return 0;
  }, [filteredData, reportType]);

  const isDossier = reportType === 'employee_dossier';

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-2rem)] gap-4 md:gap-5 animate-in fade-in duration-500 text-gray-900 dark:text-neutral-200 font-sans w-full min-w-0 max-w-full print:h-auto print:bg-white print:text-black">
      
      {/* ── INTERACTIVE UI HEADER (HIDDEN ON PRINT) ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-4 md:p-5 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm w-full shrink-0 print:hidden">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-500 mb-1">
            <FileSpreadsheet size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Master Audit Engine</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">Report Generation Hub</h1>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
            <button onClick={handlePrint} disabled={!reportData || (Array.isArray(reportData) && reportData.length === 0)} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 whitespace-nowrap">
              <Printer size={14} strokeWidth={2.5} /> Save / Print PDF
            </button>
        </div>
      </div>

      {/* ── FILTER COMMAND CENTER (HIDDEN ON PRINT) ── */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-4 md:p-5 shadow-sm space-y-4 shrink-0 w-full min-w-0 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          <div className="relative">
            <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <select value={reportType} onChange={(e) => { setReportType(e.target.value); setReportData(null); }} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer">
              <option value="payroll">Payroll Disbursement Register</option>
              <option value="finance">Financial Transaction Ledger</option>
              <option value="finance_summary">Financial Aggregation Summary</option>
              <option value="leave_utilization">Leave & Absence Utilization</option>
              <option value="attendance">Attendance Exceptions Audit</option>
              <option value="employee_dossier">Employee Master Dossier</option>
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {!isDossier ? (
            <div className="relative">
              <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer">
                <option value="all">All Branches (Global)</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          ) : (
            <div className="relative">
              <UserCircle size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className="w-full bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-indigo-900 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer">
                <option value="">Select Employee...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}

          <div className="flex gap-2">
            {!isDossier && (
              <div className="relative flex-1">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select value={finMonth} onChange={(e) => setFinMonth(parseInt(e.target.value))} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-9 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer">
                  {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "short" })}</option>)}
                </select>
              </div>
            )}
            <div className="relative flex-1">
              <select value={finYear} onChange={(e) => setFinYear(parseInt(e.target.value))} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-4 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y} {isDossier && " (YTD)"}</option>)}
              </select>
            </div>
          </div>

          <button onClick={generateReport} disabled={loading} className="w-full py-3 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} strokeWidth={3} />}
            Generate
          </button>
        </div>
      </div>

      {/* ── REPORT PREVIEW & PDF CONTAINER ── */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm flex flex-col flex-1 w-full min-w-0 relative print:border-none print:shadow-none print:rounded-none">
        
        {/* PDF Document Header */}
        <div className="hidden print:block p-8 border-b-2 border-black mb-6">
           <h1 className="text-3xl font-black uppercase tracking-widest text-center text-black">
             {isDossier ? 'Employee Master Dossier' : 'Master System Report'}
           </h1>
           <p className="text-center font-bold mt-2 text-gray-700">
             Type: {reportType.toUpperCase()} | {isDossier ? `Year: ${finYear}` : `Period: ${new Date(finYear, finMonth - 1).toLocaleString('en-IN', {month:'long', year:'numeric'})}`}
           </p>
           <p className="text-center text-xs font-mono mt-1 text-gray-500">Generated on: {new Date().toLocaleString()}</p>
        </div>

        {/* Local Search */}
        {!isDossier && Array.isArray(reportData) && reportData.length > 0 && (
          <div className="p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#050505]/50 shrink-0 print:hidden">
            <div className="relative w-full max-w-sm">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter results..." className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl py-2 pl-10 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm" />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!reportData && !loading ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center print:hidden">
            <FileText size={40} className="text-gray-300 dark:text-neutral-700 mb-4" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">Awaiting Generation</h3>
            <p className="text-sm font-bold text-gray-500">Select parameters and generate to view report.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center flex-1"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
        ) : (
          <div className="flex-1 w-full overflow-auto custom-scrollbar relative print:overflow-visible print:text-black">
            
            {/* --- ARCHETYPE 1: EMPLOYEE DOSSIER --- */}
            {isDossier && reportData.profile ? (
              <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
                {/* Profile Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 dark:border-neutral-800 pb-6 print:border-black print:pb-4">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white print:text-black">{reportData.profile.name}</h2>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 print:text-gray-700 tracking-widest uppercase mt-1">{reportData.profile.role} • {reportData.profile.department}</p>
                    <p className="text-sm text-gray-500 mt-2">Branch: <span className="font-bold text-gray-800 dark:text-neutral-200 print:text-black">{reportData.profile.branch_name || 'Unassigned'}</span></p>
                  </div>
                  <div className="mt-4 md:mt-0 text-left md:text-right bg-gray-50 dark:bg-[#111] p-4 rounded-2xl border border-gray-200 dark:border-neutral-800 print:border-gray-400 print:bg-white">
                     <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fixed Monthly Salary</p>
                     <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 print:text-black">{formatCurrency(reportData.profile.monthly_fixed_salary)}</p>
                  </div>
                </div>

                {/* YTD Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                   {/* YTD Attendance */}
                   <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 print:border-black print:bg-white">
                      <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2"><Calendar size={14}/> YTD Attendance ({finYear})</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div><p className="text-[10px] uppercase text-gray-500 font-bold">Full Days Logged</p><p className="text-xl font-black font-mono text-gray-900 dark:text-white print:text-black">{reportData.attendance.F || 0}</p></div>
                        <div><p className="text-[10px] uppercase text-gray-500 font-bold">Absences</p><p className="text-xl font-black font-mono text-red-500 print:text-black">{reportData.attendance.A || 0}</p></div>
                        <div><p className="text-[10px] uppercase text-gray-500 font-bold">Leaves Taken</p><p className="text-xl font-black font-mono text-orange-500 print:text-black">{reportData.attendance.L || 0} <span className="text-xs text-gray-400">/ {reportData.profile.max_paid_leaves_cap * 12} Cap</span></p></div>
                        <div><p className="text-[10px] uppercase text-gray-500 font-bold">Half Days</p><p className="text-xl font-black font-mono text-yellow-600 print:text-black">{reportData.attendance.H || 0}</p></div>
                      </div>
                   </div>

                   {/* YTD Finance */}
                   <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl p-5 print:border-black print:bg-white">
                      <h3 className="text-xs font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-4 flex items-center gap-2"><Banknote size={14}/> YTD Financials ({finYear})</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="flex justify-between items-center border-b border-orange-200/50 pb-2 print:border-gray-300">
                          <p className="text-xs uppercase text-gray-600 font-bold">Total Advances & Bills</p>
                          <p className="text-lg font-black font-mono text-orange-600 print:text-black">{formatCurrency(reportData.finance.advances)}</p>
                        </div>
                        <div className="flex justify-between items-center border-b border-orange-200/50 pb-2 print:border-gray-300">
                          <p className="text-xs uppercase text-gray-600 font-bold">Total Fines & Deductions</p>
                          <p className="text-lg font-black font-mono text-red-500 print:text-black">{formatCurrency(reportData.finance.fines)}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs uppercase text-gray-600 font-bold">Total Repayments</p>
                          <p className="text-lg font-black font-mono text-emerald-500 print:text-black">{formatCurrency(reportData.finance.repayments)}</p>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Payroll History Log */}
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white print:text-black mb-4 flex items-center gap-2"><History size={16}/> Payroll Disbursement History</h3>
                  <table className="w-full border-collapse border border-gray-200 dark:border-neutral-800 print:border-black text-left text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-[#111] print:bg-gray-200">
                        <th className="p-3 border border-gray-200 dark:border-neutral-800 print:border-black uppercase tracking-widest text-[10px] text-gray-500 print:text-black font-black">Month</th>
                        <th className="p-3 border border-gray-200 dark:border-neutral-800 print:border-black uppercase tracking-widest text-[10px] text-gray-500 print:text-black font-black text-right">Disbursed Amount</th>
                        <th className="p-3 border border-gray-200 dark:border-neutral-800 print:border-black uppercase tracking-widest text-[10px] text-gray-500 print:text-black font-black text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.payroll.length === 0 ? (
                        <tr><td colSpan="3" className="p-4 text-center font-bold text-gray-400">No payroll processed this year.</td></tr>
                      ) : (
                        reportData.payroll.map((p, i) => (
                          <tr key={i} className="print:border-b print:border-black">
                            <td className="p-3 border border-gray-200 dark:border-neutral-800 print:border-black font-bold">{new Date(finYear, p.payroll_month - 1).toLocaleString('en-IN', {month:'long'})}</td>
                            <td className="p-3 border border-gray-200 dark:border-neutral-800 print:border-black text-right font-mono font-black text-emerald-600 dark:text-emerald-400 print:text-black">{formatCurrency(p.paid_amount)}</td>
                            <td className="p-3 border border-gray-200 dark:border-neutral-800 print:border-black text-center text-[10px] uppercase font-black text-blue-500 print:text-black">{p.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            ) : 

            /* --- ARCHETYPE 2: STANDARD TABULAR REPORTS --- */
            (
              <table className="w-full text-left border-collapse min-w-[800px] print:min-w-full">
                <thead className="sticky top-0 z-30 print:static">
                  <tr className="bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest print:bg-gray-100 print:text-black print:border-b-2 print:border-black">
                    
                    {reportType === 'finance_summary' ? (
                      <>
                        <th className="p-3 md:p-4 border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Financial Classification</th>
                        <th className="p-3 md:p-4 text-center border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Log Count</th>
                        <th className="p-3 md:p-4 text-right border-gray-200 dark:border-neutral-800 print:border-gray-400">Total Aggregated Amount</th>
                      </>
                    ) : reportType === 'leave_utilization' ? (
                      <>
                        <th className="p-3 md:p-4 border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Personnel</th>
                        <th className="p-3 md:p-4 border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Branch</th>
                        <th className="p-3 md:p-4 text-center border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Yearly Allowed Cap</th>
                        <th className="p-3 md:p-4 text-center border-r border-gray-200 dark:border-neutral-800 print:border-gray-400 text-orange-500">Taken This Month</th>
                        <th className="p-3 md:p-4 text-center border-gray-200 dark:border-neutral-800 print:border-gray-400 text-red-500">Taken YTD Total</th>
                      </>
                    ) : (
                      <th className="p-3 md:p-4 border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Personnel / Dept</th>
                    )}
                    
                    {reportType === 'payroll' && (
                      <>
                        <th className="p-3 md:p-4 border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Branch</th>
                        <th className="p-3 md:p-4 text-right border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Disbursed Amt</th>
                        <th className="p-3 md:p-4 text-center border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Status</th>
                        <th className="p-3 md:p-4">Remarks / Ref</th>
                      </>
                    )}

                    {reportType === 'finance' && (
                      <>
                        <th className="p-3 md:p-4 border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Type</th>
                        <th className="p-3 md:p-4 text-right border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Amount</th>
                        <th className="p-3 md:p-4 border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Date Logged</th>
                        <th className="p-3 md:p-4">Remarks</th>
                      </>
                    )}

                    {reportType === 'attendance' && (
                      <>
                        <th className="p-3 md:p-4 border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Date</th>
                        <th className="p-3 md:p-4 text-center border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Exception</th>
                        <th className="p-3 md:p-4 border-r border-gray-200 dark:border-neutral-800 print:border-gray-400">Authorized By</th>
                        <th className="p-3 md:p-4">Reason</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-900 print:divide-gray-300">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors print:break-inside-avoid print:text-black">
                      
                      {reportType === 'finance_summary' ? (
                        <>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 font-black text-sm uppercase text-gray-700 dark:text-gray-300 print:text-black">{TYPE_MAP[row.type] || row.type}</td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-center font-bold text-gray-500 print:text-black">{row.txn_count} entries</td>
                          <td className="p-3 md:p-4 text-right font-mono font-black text-lg text-gray-900 dark:text-white print:text-black">{formatCurrency(row.total_amount)}</td>
                        </>
                      ) : reportType === 'leave_utilization' ? (
                        <>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300">
                            <p className="font-black text-sm text-gray-900 dark:text-white print:text-black">{row.name}</p>
                            <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">{row.department}</p>
                          </td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-xs font-bold text-gray-600 print:text-black">{row.branch_name}</td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-center font-mono font-black text-gray-900 print:text-black">{row.max_paid_leaves_cap * 12} / yr</td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-center font-mono font-black text-orange-500 print:text-black">{row.taken_this_month}</td>
                          <td className="p-3 md:p-4 text-center font-mono font-black text-red-500 print:text-black">{row.taken_ytd}</td>
                        </>
                      ) : (
                        <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300">
                          <p className="font-black text-sm text-gray-900 dark:text-white print:text-black">{row.name}</p>
                          <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">{row.department} • {row.role}</p>
                        </td>
                      )}

                      {reportType === 'payroll' && (
                        <>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-xs font-bold text-gray-600 dark:text-neutral-400 print:text-black">{row.branch_name || "Head Office"}</td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 print:text-black">{formatCurrency(row.paid_amount)}</td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-center text-[10px] font-black uppercase text-emerald-500 print:text-black">{row.status}</td>
                          <td className="p-3 md:p-4 text-xs font-bold text-gray-600 dark:text-neutral-400 print:text-black">{row.remarks || "—"}</td>
                        </>
                      )}

                      {reportType === 'finance' && (
                        <>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-[10px] font-black uppercase text-gray-600 dark:text-neutral-400 print:text-black">{TYPE_MAP[row.type] || row.type}</td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-right font-mono font-black text-orange-600 dark:text-orange-400 print:text-black">{formatCurrency(row.amount)}</td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-xs font-mono font-bold text-gray-600 dark:text-neutral-400 print:text-black">{new Date(row.created_at).toLocaleDateString()}</td>
                          <td className="p-3 md:p-4 text-xs font-bold text-gray-600 dark:text-neutral-400 print:text-black">{row.remarks}</td>
                        </>
                      )}

                      {reportType === 'attendance' && (
                        <>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-sm font-mono font-black text-gray-900 dark:text-white print:text-black">{new Date(row.date).toLocaleDateString()}</td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-center text-[10px] font-black uppercase tracking-widest text-red-500 print:text-black">{row.override_status === 'L' ? 'Leave' : row.override_status === 'A' ? 'Absent' : row.override_status === 'H' ? 'Half Day' : row.override_status}</td>
                          <td className="p-3 md:p-4 border-r border-gray-100 dark:border-neutral-900 print:border-gray-300 text-xs font-bold text-gray-500 print:text-black">{row.overridden_by_name || 'System'}</td>
                          <td className="p-3 md:p-4 text-xs font-bold text-gray-600 dark:text-neutral-400 print:text-black">{row.reason || "—"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                
                {/* Grand Total Footer */}
                {(reportType === 'payroll' || reportType === 'finance' || reportType === 'finance_summary') && (
                  <tfoot className="sticky bottom-0 z-30 print:static">
                    <tr className="bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-md border-t-2 border-gray-200 dark:border-neutral-800 print:bg-white print:border-t-2 print:border-black">
                      <td colSpan={reportType === 'finance_summary' ? 2 : reportType === 'payroll' ? 2 : 2} className="p-4 md:p-5 text-right font-black uppercase tracking-widest text-gray-900 dark:text-white print:text-black">Grand Total:</td>
                      <td className="p-4 md:p-5 text-right font-mono font-black text-lg text-emerald-600 dark:text-emerald-400 print:text-black">{formatCurrency(totals)}</td>
                      <td colSpan={reportType === 'finance_summary' ? 0 : 2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}