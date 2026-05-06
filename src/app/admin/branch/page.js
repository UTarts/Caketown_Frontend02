"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Building2, Users, ArrowLeft, Loader2, Plus, Shield, Banknote,
  Clock, Calendar, Edit2, Trash2, X, Save, Search, Check, FileText,
  Info, DollarSign, RefreshCw, UserCheck, Activity, History, ChevronDown,
  ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Coffee, Clock3, AlertCircle, Download
} from "lucide-react";

// ─── HELPERS ───────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const formatDateTime = (isoStr) => {
  if (!isoStr) return "Unknown Date";
  const d = new Date(isoStr);
  return d.toLocaleString("en-IN", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true
  });
};

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

function calcNetPay(staff, daysInMonth) {
  const base = parseFloat(staff.monthly_fixed_salary || staff.salary || staff.base_salary) || 0;
  if (base === 0) return { net: 0, perDay: 0, paidHolidays: 0, totalPaidDays: 0, gross: 0, totalAdv: 0, daysPresent: 0 };
  
  const perDay = base / daysInMonth;
  const cap = parseInt(staff.max_paid_leaves || staff.leave_cap || staff.max_paid_leaves_cap || 4);
  const daysPresent = parseFloat(staff.days_worked || staff.total_duty || staff.present || 0);
  
  const paidHolidays = calcPaidHolidays(daysPresent, cap);
  const totalPaidDays = daysPresent + paidHolidays;
  const gross = perDay * totalPaidDays;
  
  const preAdv = parseFloat(staff.pre_advance || 0);
  const finalAdv = parseFloat(staff.final_advance || 0);
  const shopAdv = parseFloat(staff.shop_advance || 0);
  const shopBill = parseFloat(staff.shop_bill || 0);
  const deduction = parseFloat(staff.deduction || 0);
  
  const totalAdv = preAdv + finalAdv + shopAdv + shopBill + deduction;
  const net = Math.max(0, gross - totalAdv);
  
  return { net: net.toFixed(0), perDay: perDay.toFixed(2), paidHolidays, totalPaidDays, gross: gross.toFixed(0), totalAdv: totalAdv.toFixed(0), daysPresent };
}

// ─── FULL PERMISSIONS LIST ─────────────────────────
const ALL_PERMISSIONS = [
  { category: "Attendance", items: [
    { id: "view_live_attendance", label: "View Live Floor Status", read: true, write: false },
    { id: "view_attendance_history", label: "View Attendance History", read: true, write: false },
    { id: "edit_attendance", label: "Override / Edit Attendance", read: true, write: true },
    { id: "manage_terminal", label: "Manage Biometric Terminal", read: false, write: true },
    { id: "register_face", label: "Register Employee Face", read: false, write: true },
  ]},
  { category: "Payroll & Finance", items: [
    { id: "view_payroll", label: "View Payroll Data", read: true, write: false },
    { id: "edit_payroll", label: "Edit / Finalize Payroll", read: false, write: true },
    { id: "log_advance", label: "Log Advance / Pre-Advance", read: false, write: true },
    { id: "log_shop_bill", label: "Log Shop Bills", read: false, write: true },
    { id: "log_shop_advance", label: "Log Shop Advance", read: false, write: true },
    { id: "view_financial_history", label: "View Financial History", read: true, write: false },
    { id: "download_salary_slip", label: "Download Salary Slip", read: true, write: false },
  ]},
  { category: "Staff Management", items: [
    { id: "view_staff_list", label: "View Staff List", read: true, write: false },
    { id: "edit_staff", label: "Edit Staff Details", read: false, write: true },
  ]},
];

// ─── SMART COMPONENTS ──────────────────────────────────────────────────────

// UPGRADED: Dynamic Time Presenter & Analyzer
function PremiumPunchTimeline({ punches, isActive }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 60000); 
    return () => clearInterval(interval);
  }, [isActive]);

  if (!punches || punches.length === 0) return <div className="text-gray-400 font-bold text-sm h-full flex items-center justify-center py-6 bg-gray-50 dark:bg-neutral-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-neutral-800">No punches recorded for this date.</div>;

  const renderPunches = [...punches].map(p => new Date(p).getTime());
  if (isActive) renderPunches.push(now);

  let workMs = 0;
  let breakMs = 0;
  const workSessions = [];
  const breakSessions = [];

  for (let i = 0; i < renderPunches.length - 1; i++) {
    const isWork = i % 2 === 0;
    const duration = renderPunches[i+1] - renderPunches[i];
    const session = {
      start: renderPunches[i],
      end: renderPunches[i+1],
      duration,
      isLive: isActive && i === renderPunches.length - 2
    };
    if (isWork) { workSessions.push(session); workMs += duration; }
    else { breakSessions.push(session); breakMs += duration; }
  }

  const startTime = renderPunches[0];
  const endTime = renderPunches[renderPunches.length - 1];
  const totalDurationMs = Math.max(endTime - startTime, 60000);

  const formatHm = (ms) => {
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full flex flex-col gap-5 mt-2">
      
      {/* Smart Metrics Dashboard */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 dark:bg-neutral-900/50 p-3 rounded-2xl border border-gray-100 dark:border-neutral-800 flex flex-col justify-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Shift</p>
          <p className="font-mono font-black text-lg text-gray-900 dark:text-white leading-none">{formatHm(totalDurationMs)}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-center relative overflow-hidden">
          {isActive && <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>}
          <p className="text-[10px] font-black text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-widest mb-1">Work Time</p>
          <p className="font-mono font-black text-lg text-emerald-700 dark:text-emerald-400 leading-none">{formatHm(workMs)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-2xl border border-red-100 dark:border-red-900/30 flex flex-col justify-center relative overflow-hidden">
          {isActive && breakSessions.length > 0 && breakSessions[breakSessions.length-1]?.isLive && <div className="absolute top-0 right-0 w-8 h-8 bg-red-500/20 rounded-full blur-xl animate-pulse"></div>}
          <p className="text-[10px] font-black text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Break Time</p>
          <p className="font-mono font-black text-lg text-red-700 dark:text-red-400 leading-none">{formatHm(breakMs)}</p>
        </div>
      </div>

      {/* Contiguous Timeline Bar */}
      <div>
        <div className="flex w-full h-2.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          {renderPunches.slice(0, -1).map((_, idx) => {
            const isWork = idx % 2 === 0;
            const duration = renderPunches[idx+1] - renderPunches[idx];
            return (
              <div key={idx} style={{ width: `${(duration / totalDurationMs) * 100}%` }} className={`h-full ${isWork ? 'bg-emerald-500' : 'bg-red-400'}`} />
            );
          })}
        </div>
        <div className="flex justify-between items-center mt-2 px-0.5">
          <span className="text-[10px] font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest">{formatTime(startTime)}</span>
          <span className="text-[10px] font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest">{isActive ? "Now" : formatTime(endTime)}</span>
        </div>
      </div>

      {/* Structured Session Log */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Work Sessions */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest border-b border-emerald-100 dark:border-emerald-900/30 pb-1.5 flex items-center gap-1.5"><Activity size={12}/> Work Logs</p>
          {workSessions.map((seg, idx) => (
            <div key={idx} className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full bg-emerald-500 ${seg.isLive ? 'animate-pulse' : ''}`}></span>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100">{formatTime(seg.start)} - {seg.isLive ? 'Now' : formatTime(seg.end)}</span>
              </div>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatHm(seg.duration)}</span>
            </div>
          ))}
        </div>

        {/* Break Sessions */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest border-b border-red-100 dark:border-red-900/30 pb-1.5 flex items-center gap-1.5"><Coffee size={12}/> Break Logs</p>
          {breakSessions.length === 0 ? (
            <p className="text-xs font-bold text-gray-400 dark:text-neutral-500 italic py-2">No breaks taken.</p>
          ) : (
            breakSessions.map((seg, idx) => (
              <div key={idx} className="flex items-center justify-between bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-900/30 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full bg-red-500 ${seg.isLive ? 'animate-pulse' : ''}`}></span>
                  <span className="text-xs font-bold text-red-900 dark:text-red-100">{formatTime(seg.start)} - {seg.isLive ? 'Now' : formatTime(seg.end)}</span>
                </div>
                <span className="text-xs font-black text-red-600 dark:text-red-400">{formatHm(seg.duration)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AttendanceMarker({ status }) {
  const map = {
    F:  { label: "P",  bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400" },
    P:  { label: "P",  bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400" },
    H:  { label: "H",  bg: "bg-yellow-100 dark:bg-yellow-500/20",   text: "text-yellow-700 dark:text-yellow-400" },
    A:  { label: "A",  bg: "bg-red-100 dark:bg-red-500/20",         text: "text-red-700 dark:text-red-400" },
    "-":{ label: "–",  bg: "bg-transparent",                        text: "text-gray-300 dark:text-neutral-700" },
  };
  const m = map[status] || map["-"];
  return <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-[10px] font-black transition-colors ${m.bg} ${m.text}`}>{m.label}</span>;
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────
function AdminBranchHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branch_id = searchParams.get("id");
  const initialTab = searchParams.get("tab") || "overview";

  const [session, setSession] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [branchLogs, setBranchLogs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState(initialTab);
  
  const [viewDate, setViewDate] = useState(getLocalDate());
  const now = new Date();
  const [finMonth, setFinMonth] = useState(now.getMonth() + 1);
  const [finYear,  setFinYear]  = useState(now.getFullYear());
  const daysInMonth = new Date(finYear, finMonth, 0).getDate();

  const [payrollData, setPayrollData] = useState([]);
  const [attendanceGrid, setAttendanceGrid] = useState([]);
  const [isSubLoading, setIsSubLoading] = useState(false);

  // Smart Filters
  const [staffSearch, setStaffSearch] = useState("");

  // Modals
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [advTarget, setAdvTarget] = useState(null);
  const [advForm, setAdvForm] = useState({ type: "pre_advance", amount: "", remarks: "" });
  const [advSubmitting, setAdvSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const blankForm = { role: "staff", name: "", mobile_number: "", password: "", salary: "", paid_leaves: 4, max_paid_leaves: 4, shift_hours: 10, permissions: {} };
  const [formData, setFormData] = useState(blankForm);

  // God Mode specific modals
  const [overrideTarget, setOverrideTarget] = useState(null); 
  const [overrideForm, setOverrideForm] = useState({ status: "P", reason: "" }); 
  const [overridePunches, setOverridePunches] = useState(null);
  const [overridePunchesLoading, setOverridePunchesLoading] = useState(false);
  const [overridePersonStatus, setOverridePersonStatus] = useState("off_duty");

  const [salaryBreakdownUser, setSalaryBreakdownUser] = useState(null);
  const [transactionHistoryModal, setTransactionHistoryModal] = useState(null); 

  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState("attendance");
  const [reportStartDate, setReportStartDate] = useState(getLocalDate());
  const [reportEndDate, setReportEndDate] = useState(getLocalDate());
  const [reportGenerating, setReportGenerating] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("caketown_session");
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || parsed.role !== "admin") { router.push("/"); return; }
      setSession(parsed);
    } catch {
      router.push("/");
    }
  }, [router]);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!branch_id) return;
    if (!isSilent) setLoading(true); else setSyncing(true);

    try {
      const [masterRes, liveRes, logsRes] = await Promise.all([
        callApi("get_branch_master", { branch_id }),
        callApi("get_live_attendance", { branch_id, date: viewDate }),
        callApi("get_system_logs", { branch_id, per_page: 150 })
      ]);
      if (masterRes.status === "success") setMasterData(masterRes.data);
      if (liveRes.status === "success") setLiveData(liveRes.data);
      if (logsRes.status === "success") setBranchLogs(logsRes.data || []);
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false); setSyncing(false);
    }
  }, [branch_id, viewDate]);

  useEffect(() => {
    if (session && branch_id) {
      fetchDashboardData();
      if (viewDate === getLocalDate()) {
        const interval = setInterval(() => fetchDashboardData(true), 30000);
        return () => clearInterval(interval);
      }
    }
  }, [session, branch_id, viewDate, fetchDashboardData]);

  useEffect(() => {
    if (tab === "payroll") loadPayroll();
    if (tab === "attendance") loadAttendance();
  }, [tab, finMonth, finYear]);

  // Fetch Contextual Punches when Override Modal Opens
  useEffect(() => {
    if (!overrideTarget) {
      setOverridePunches(null);
      return;
    }
    const getPunches = async () => {
      setOverridePunchesLoading(true);
      const res = await callApi("get_live_attendance", { branch_id, date: overrideTarget.date });
      if (res.status === "success") {
        const person = res.data.all_people?.find(p => String(p.id) === String(overrideTarget.user.id));
        setOverridePunches(person?.punches || []);
        setOverridePersonStatus(person?.status || "off_duty");
      }
      setOverridePunchesLoading(false);
    };
    getPunches();
  }, [overrideTarget, branch_id]);

  const loadPayroll = async () => {
    setIsSubLoading(true);
    const res = await callApi("get_payroll_data", { branch_id, month: finMonth, year: finYear });
    if (res.status === "success") setPayrollData(res.data);
    setIsSubLoading(false);
  };

  const loadAttendance = async () => {
    setIsSubLoading(true);
    const res = await callApi("get_monthly_attendance", { branch_id, month: finMonth, year: finYear });
    if (res.status === "success") setAttendanceGrid(res.data);
    setIsSubLoading(false);
  };

  // ─── API HANDLERS ────────────────────────────────────────────────────────
  const openEdit = (user) => {
    setEditTarget(user);
    setEditForm({
      name: user.name, 
      mobile_number: user.mobile_number,
      role: user.role, 
      salary: user.monthly_fixed_salary,
      paid_leaves: user.paid_leaves, 
      max_paid_leaves: user.max_paid_leaves_cap || 4,
      shift_hours: user.standard_shift_hours,
      permissions: typeof user.feature_permissions === "string"
        ? JSON.parse(user.feature_permissions) : (user.feature_permissions || {}),
    });
  };

  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    if (!advTarget) return;
    setAdvSubmitting(true);
    const res = await callApi("log_advance", {
      user_id: advTarget.id, branch_id,
      type: advForm.type, amount: advForm.amount, remarks: advForm.remarks, admin_id: session.id,
    });
    if (res.status === "success") {
      setAdvTarget(null); setAdvForm({ type: "pre_advance", amount: "", remarks: "" });
      fetchDashboardData(true); 
    } else alert(res.message);
    setAdvSubmitting(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    const res = await callApi("update_user", { user_id: editTarget.id, ...editForm, admin_id: session.id });
    if (res.status === "success") { setEditTarget(null); fetchDashboardData(true); } else alert(res.message);
    setEditSubmitting(false);
  };

  const handleDelete = async () => {
    setDeleteSubmitting(true);
    const res = await callApi("delete_user", { user_id: deleteTarget.id, admin_id: session.id });
    if (res.status === "success") { setDeleteTarget(null); fetchDashboardData(true); } else alert(res.message);
    setDeleteSubmitting(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await callApi("create_user", { ...formData, branch_id, admin_id: session.id });
    if (res.status === "success") { setIsModalOpen(false); setFormData(blankForm); fetchDashboardData(true); } else alert(res.message);
    setIsSubmitting(false);
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    const res = await callApi("set_attendance_override", {
      user_id: overrideTarget.user.id, date: overrideTarget.date, status: overrideForm.status, reason: overrideForm.reason, admin_id: session.id
    });
    if (res.status === "success") { setOverrideTarget(null); loadAttendance(); } else alert(res.message);
  };

  const handleMarkPaid = async (user, amount) => {
    if(!confirm(`Mark salary as paid for ${user.name}?`)) return;
    const res = await callApi("mark_salary_paid", {
      user_id: user.id, branch_id, month: finMonth, year: finYear, amount, admin_id: session.id
    });
    if (res.status === "success") loadPayroll(); else alert(res.message);
  };

  const openTransactionHistory = async (user, type, label) => {
    setTransactionHistoryModal({ user, type, label, data: [], loading: true });
    const res = await callApi("get_advance_history", { user_id: user.id, month: finMonth, year: finYear });
    if (res.status === "success") {
      setTransactionHistoryModal({ user, type, label, data: res.data.filter(t => t.type === type), loading: false });
    } else setTransactionHistoryModal({ user, type, label, data: [], loading: false });
  };

  const togglePerm = (permId, mode, isEdit = false) => {
    if (isEdit) {
      setEditForm(prev => ({ ...prev, permissions: { ...prev.permissions, [permId]: { ...(prev.permissions[permId] || {}), [mode]: !(prev.permissions[permId]?.[mode]) } } }));
    } else {
      setFormData(prev => ({ ...prev, permissions: { ...prev.permissions, [permId]: { ...(prev.permissions[permId] || {}), [mode]: !(prev.permissions[permId]?.[mode]) } } }));
    }
  };

  // CORRECT REPORT API CALL
  const handleDownloadReport = async () => {
    if (!reportStartDate || !reportEndDate) { alert("Please select both dates."); return; }
    setReportGenerating(true);
    
    // Exact mapping to standard action endpoint
    const res = await callApi("download_branch_report", { 
      branch_id, type: reportType, start_date: reportStartDate, end_date: reportEndDate, admin_id: session.id 
    });
    
    if (res.status === "success" && res.url) {
      window.open(res.url, "_blank");
      setReportModalOpen(false);
    } else {
      alert(res.message || "Failed to generate PDF Report.");
    }
    setReportGenerating(false);
  };

  if (loading || !masterData) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Initializing God Mode...</p>
      </div>
    );
  }

  const { branch, staff } = masterData;
  const allPeople = liveData?.all_people || [];
  const onFloorCount = allPeople.filter(p => p.status === 'working').length;
  const onBreakCount = allPeople.filter(p => p.status === 'on_break').length;

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) || 
    s.mobile_number.includes(staffSearch) ||
    s.role.toLowerCase().includes(staffSearch.toLowerCase())
  );

  const groupedBranchLogs = groupLogsByDate(branchLogs);
  const financeLogs = branchLogs.filter(log => log.action_type.includes("ADVANCE") || log.action_type.includes("SALARY") || log.action_type.includes("BILL") || log.action_type.includes("PAYROLL"));
  const groupedFinanceLogs = groupLogsByDate(financeLogs);

  const TABS = [
    { id: "overview", label: "Live Floor" },
    { id: "personnel", label: "Personnel" },
    { id: "attendance", label: "Attendance Ledger" },
    { id: "payroll", label: "Payroll Engine" },
    { id: "finance", label: "Finance & Logs" },
  ];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 w-full overflow-x-hidden text-gray-900 dark:text-neutral-200">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mx-3 md:mx-0 mt-3 md:mt-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/admin/branches")} className="p-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all shadow-sm shrink-0 text-gray-900 dark:text-white">
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
              <Building2 size={12} className="shrink-0" />
              <span className="text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase truncate">Superadmin Mode Access</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight truncate">
              {branch.branch_name}
            </h1>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button onClick={() => fetchDashboardData(false)} className="w-full sm:w-auto flex items-center justify-center p-3 md:px-5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl hover:text-emerald-500 text-gray-900 dark:text-white text-sm font-bold shadow-sm transition-all shrink-0 gap-2">
            <RefreshCw size={16} className={syncing ? "animate-spin text-emerald-500" : ""} /> <span className="hidden md:inline">Sync Data</span>
          </button>
          <button onClick={() => setReportModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center p-3 md:px-5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg shadow-blue-500/20 transition-all shrink-0 gap-2 active:scale-95">
            <Download size={16} strokeWidth={3} /> Generate Report
          </button>
        </div>
      </div>

      {/* ── GRADIENT STAT CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 px-3 md:px-0">
        {[
          { label: "Branch Staff", value: staff.length, icon: Users, gradient: "from-blue-500 to-indigo-600", shadow: "shadow-blue-500/20" },
          { label: "On Floor Now", value: onFloorCount, icon: CheckCircle2, gradient: "from-emerald-400 to-teal-600", shadow: "shadow-emerald-500/20" },
          { label: "On Break", value: onBreakCount, icon: Coffee, gradient: "from-yellow-400 to-orange-500", shadow: "shadow-orange-500/20" },
          { label: "Off Duty", value: staff.length - onFloorCount - onBreakCount, icon: Clock3, gradient: "from-gray-500 to-slate-600", shadow: "shadow-gray-500/20" },
        ].map((card) => (
          <div key={card.label} className={`relative overflow-hidden bg-gradient-to-br ${card.gradient} rounded-3xl p-5 md:p-6 shadow-lg ${card.shadow} text-white group`}>
            <div className="absolute -right-4 -top-4 opacity-20 transform group-hover:scale-110 transition-transform duration-500"><card.icon size={100} /></div>
            <div className="relative z-10 flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-white/80">{card.label}</p>
            </div>
            <p className="relative z-10 text-3xl md:text-4xl font-black tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── TABS ───────────────────────────────────────────────────────── */}
      <div className="sticky top-14 md:top-0 z-30 bg-[#F8FAFC]/90 dark:bg-[#050505]/90 backdrop-blur-xl pt-2 pb-4 px-3 md:px-0">
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 snap-x">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); router.push(`/admin/branch?id=${branch_id}&tab=${item.id}`); }}
              className={`snap-start shrink-0 px-6 py-3 rounded-2xl text-sm font-black whitespace-nowrap transition-all duration-300 ${
                tab === item.id ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-400/50" : "bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: LIVE FLOOR
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 px-3 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="xl:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-3 md:p-4 shadow-sm w-full gap-3">
              <div className="flex items-center w-full sm:w-auto justify-between sm:justify-start gap-2">
                <button onClick={() => { const d = new Date(viewDate); d.setDate(d.getDate() - 1); setViewDate(d.toISOString().split('T')[0]); }} className="p-3 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors shrink-0"><ChevronLeft size={20} className="text-gray-500" /></button>
                <div className="flex items-center gap-2.5 px-4 bg-gray-50 dark:bg-neutral-900 rounded-xl py-3 flex-1 sm:flex-none justify-center">
                  <CalendarDays size={18} className="text-emerald-500" />
                  <input type="date" value={viewDate} max={getLocalDate()} onChange={(e) => setViewDate(e.target.value)} className="bg-transparent text-sm font-black text-gray-900 dark:text-white outline-none cursor-pointer w-32" />
                </div>
                <button onClick={() => { if(viewDate === getLocalDate()) return; const d = new Date(viewDate); d.setDate(d.getDate() + 1); setViewDate(d.toISOString().split('T')[0]); }} disabled={viewDate === getLocalDate()} className="p-3 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-xl transition-colors shrink-0 disabled:opacity-30"><ChevronRight size={20} className="text-gray-500"/></button>
              </div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                {viewDate === getLocalDate() ? <><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span> Live Floor</> : <><Clock size={16} className="text-gray-400" /> Past Record</>}
              </h3>
            </div>

            {allPeople.length === 0 ? (
              <div className="rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-12 text-center text-gray-400">No staff members found on this date.</div>
            ) : (
              <div className="space-y-4">
                {allPeople.map((person) => {
                  const isWorkingRightNow = viewDate === getLocalDate() && person.status === 'working';
                  return (
                    <div key={person.id} className="flex flex-col bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-6 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-colors group">
                      <div className="w-full flex justify-between items-center mb-2">
                        <div>
                          <h3 className="font-black text-lg md:text-xl text-gray-900 dark:text-white truncate">{person.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{person.role}</p>
                            {isWorkingRightNow && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                            {(viewDate === getLocalDate() && person.status === 'on_break') && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>}
                          </div>
                        </div>
                      </div>
                      <PremiumPunchTimeline punches={person.punches} isActive={isWorkingRightNow} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="xl:col-span-1 space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
              <History size={16} className="text-blue-500" /> Branch Feed
            </h3>
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden h-[700px]">
              <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                {Object.keys(groupedBranchLogs).length === 0 ? (
                  <div className="text-center text-gray-400 font-bold mt-20 text-sm">No activity recorded.</div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(groupedBranchLogs).map(([dateLabel, logs]) => (
                      <div key={dateLabel}>
                        <div className="flex items-center gap-4 mb-5 sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm z-10 py-1 -mt-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 dark:bg-neutral-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-800">{dateLabel}</span>
                          <div className="h-px bg-gray-100 dark:bg-neutral-800 flex-1"></div>
                        </div>
                        <div className="relative pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6">
                          {logs.map((log) => {
                            let colorClass = "bg-gray-100 dark:bg-neutral-800 ring-white dark:ring-[#0a0a0a]";
                            if (log.action_type.includes("LOGIN")) colorClass = "bg-blue-500 ring-white dark:ring-[#0a0a0a]";
                            if (log.action_type.includes("ATTENDANCE") || log.action_type.includes("PUNCH")) colorClass = "bg-purple-500 ring-white dark:ring-[#0a0a0a]";
                            if (log.action_type.includes("ADVANCE") || log.action_type.includes("SALARY")) colorClass = "bg-orange-500 ring-white dark:ring-[#0a0a0a]";
                            
                            const cleanDesc = log.description.replace(/ at branch ID \d+/gi, '');

                            return (
                              <div key={log.id} className="relative group">
                                <div className={`absolute -left-[19px] md:-left-[23px] top-1 w-3 h-3 rounded-full ring-4 ${colorClass}`} />
                                <div className="pl-2">
                                  <p className="text-xs font-medium text-gray-800 dark:text-neutral-200 leading-snug">{cleanDesc}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 tabular-nums">{new Date(log.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}</span>
                                    {log.actor_name && <span className="text-[10px] font-bold text-blue-500 truncate max-w-[120px]">· {log.actor_name}</span>}
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
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: PERSONNEL (With Smart Search)
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "personnel" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 px-3 md:px-0">
          <div className="flex flex-col md:flex-row md:justify-between items-center gap-4 bg-white dark:bg-[#0a0a0a] p-3 rounded-3xl border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div className="relative w-full md:max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={staffSearch} 
                onChange={(e) => setStaffSearch(e.target.value)} 
                placeholder="Search by name, role, or phone..." 
                className="w-full bg-gray-50 dark:bg-neutral-900 border-none rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
              />
            </div>
            <button onClick={() => { setIsModalOpen(true); setFormData(blankForm); }} className="w-full md:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 text-sm active:scale-95">
              <Plus size={18} strokeWidth={3} /> Add Employee
            </button>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="p-4 md:p-5 sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-sm z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.2)] text-gray-500 dark:text-neutral-400">Employee</th>
                    <th className="p-4 md:p-5 text-gray-500 dark:text-neutral-400">Mobile</th>
                    <th className="p-4 md:p-5 text-right text-gray-500 dark:text-neutral-400">Fixed Salary</th>
                    <th className="p-4 md:p-5 text-center text-gray-500 dark:text-neutral-400">Leave Cap</th>
                    <th className="p-4 md:p-5 text-center text-gray-500 dark:text-neutral-400">Shift Target</th>
                    <th className="p-4 md:p-5 text-right text-gray-500 dark:text-neutral-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                  {filteredStaff.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-gray-400 font-bold text-sm">No matching personnel.</td></tr>}
                  {filteredStaff.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                      <td className="p-4 md:p-5 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50 dark:group-hover:bg-[#111] z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)] transition-colors">
                        <p className="font-black text-sm text-gray-900 dark:text-white mb-0.5">{user.name}</p>
                        <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${user.role === "manager" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"}`}>{user.role}</span>
                      </td>
                      <td className="p-4 md:p-5 font-mono text-xs font-bold text-gray-500 dark:text-neutral-400">{user.mobile_number}</td>
                      <td className="p-4 md:p-5 text-right font-mono font-black text-sm text-gray-900 dark:text-white">₹{parseFloat(user.monthly_fixed_salary).toLocaleString("en-IN")}</td>
                      <td className="p-4 md:p-5 text-center font-mono font-black text-sm text-gray-600 dark:text-neutral-300">{user.max_paid_leaves ?? user.paid_leaves}</td>
                      <td className="p-4 md:p-5 text-center text-sm font-black text-gray-600 dark:text-neutral-300">{user.standard_shift_hours}h</td>
                      <td className="p-4 md:p-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(user)} className="p-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 text-gray-400 rounded-xl transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => setDeleteTarget(user)} className="p-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 text-gray-400 rounded-xl transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: ATTENDANCE LEDGER (Strict Logic - No Weekoffs)
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "attendance" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 px-3 md:px-0">
          <div className="flex flex-wrap gap-2.5 items-center bg-white dark:bg-[#0a0a0a] p-2.5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm w-fit mx-1">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2">
              <Calendar size={14} className="text-emerald-500" />
              <select value={finMonth} onChange={e => setFinMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
              </select>
            </div>
            <select value={finYear} onChange={e => setFinYear(parseInt(e.target.value))} className="bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2 text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={loadAttendance} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-black rounded-xl hover:bg-gray-800 active:scale-95 transition-all">Load</button>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#050505]/50">
              <div className="flex flex-wrap gap-4">
                {[
                  { marker: "F", label: "Full Day", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
                  { marker: "H", label: "Half Day", bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400" },
                  { marker: "A", label: "Absent",   bg: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
                ].map(l => (
                  <div key={l.marker} className="flex items-center gap-2">
                    <span className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-black ${l.bg}`}>{l.marker}</span>
                    <span className="text-xs font-bold text-gray-600 dark:text-neutral-400">{l.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 md:mt-0">Click any status cell to override</p>
            </div>

            {isSubLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : attendanceGrid.length === 0 ? (
              <div className="p-10 text-center text-gray-400 font-bold text-sm">No attendance records found.</div>
            ) : (
              <div className="w-full overflow-x-auto custom-scrollbar pb-1">
                <table className="w-full text-left border-collapse" style={{ minWidth: `${140 + daysInMonth * 40}px` }}>
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-200 dark:border-neutral-800">
                      <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-sm z-20 border-r border-gray-200 dark:border-neutral-800 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">Personnel</th>
                      {[...Array(daysInMonth)].map((_, i) => {
                        const d = new Date(finYear, finMonth - 1, i + 1);
                        return (
                          <th key={i} className="p-1.5 text-center min-w-[40px] border-r border-gray-100 dark:border-neutral-900">
                            <div className="text-[8px] font-black uppercase mb-0.5 text-gray-400">{d.toLocaleDateString("en-IN", { weekday: "short" }).charAt(0)}</div>
                            <div className="text-xs font-black text-gray-900 dark:text-white">{i + 1}</div>
                          </th>
                        );
                      })}
                      {["F", "H", "A"].map(h => <th key={h} className="p-2 text-center text-[9px] font-black text-gray-400 uppercase min-w-[30px]">{h}</th>)}
                      <th className="p-2 text-center text-[9px] font-black text-blue-500 uppercase min-w-[50px] bg-blue-50/30 dark:bg-blue-900/10 border-l border-blue-100 dark:border-blue-900/30">Earned<br/>Leaves</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                    {attendanceGrid.map((row, idx) => {
                      let totF = 0, totH = 0, totA = 0;
                      const todayStr = getLocalDate();
                      
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 group">
                          <td className="p-3 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/50 dark:group-hover:bg-[#111] z-10 border-r border-gray-200 dark:border-neutral-800 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">
                            <p className="font-black text-xs text-gray-900 dark:text-white whitespace-nowrap">{row.name}</p>
                          </td>
                          {[...Array(daysInMonth)].map((_, i) => {
                            const dateStr = `${finYear}-${pad(finMonth)}-${pad(i + 1)}`;
                            let status = row.days?.[dateStr]?.status || row.days?.[dateStr] || "-";
                            
                            // 1. Future Dates remain Blank
                            if (dateStr > todayStr) status = "-";
                            
                            // 2. Map Backend 'P' to UI 'F'
                            if (status === "P" || status === "F") { totF++; status = "F"; }
                            else if (status === "H") { totH++; }
                            else if (status === "A") { totA++; }

                            return (
                              <td 
                                key={i} 
                                onClick={() => {
                                  if (dateStr > todayStr) return; // Prevent overriding future
                                  setOverrideTarget({ user: row, date: dateStr });
                                  setOverrideForm({ status: "P", reason: "" }); // Backend expects P
                                }}
                                className={`p-1 text-center border-r border-gray-100 dark:border-neutral-900 transition-colors ${dateStr <= todayStr ? 'cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'opacity-50'}`}
                              >
                                <AttendanceMarker status={status} />
                              </td>
                            );
                          })}
                          <td className="p-2 text-center font-mono font-black text-xs text-emerald-600">{totF}</td>
                          <td className="p-2 text-center font-mono font-black text-xs text-yellow-600">{totH}</td>
                          <td className="p-2 text-center font-mono font-black text-xs text-red-500">{totA}</td>
                          <td className="p-2 text-center font-mono font-black text-xs text-blue-600 bg-blue-50/30 dark:bg-blue-900/10 border-l border-blue-100 dark:border-blue-900/30">
                            {calcPaidHolidays(totF + (totH * 0.5), row.max_paid_leaves_cap || 4)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: PAYROLL ENGINE (With Data Recovery Logic)
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "payroll" && (
        <div className="space-y-4 px-3 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-wrap gap-2.5 items-center bg-white dark:bg-[#0a0a0a] p-2.5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm w-fit mx-1">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2">
              <Calendar size={14} className="text-emerald-500" />
              <select value={finMonth} onChange={e => setFinMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
              </select>
            </div>
            <select value={finYear} onChange={e => setFinYear(parseInt(e.target.value))} className="bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2 text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={loadPayroll} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-black rounded-xl hover:bg-gray-800 active:scale-95 transition-all">Load</button>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
            {isSubLoading ? (
              <div className="flex justify-center py-24"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : payrollData.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-bold text-sm">No payroll data calculated.</div>
            ) : (
              <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-200 dark:border-neutral-800 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                      <th className="p-4 sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-sm z-20 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">Personnel</th>
                      <th className="p-4 text-right">Fixed Salary</th>
                      <th className="p-4 text-center">Duty</th>
                      <th className="p-4 text-right text-red-400">Pre Adv</th>
                      <th className="p-4 text-right text-red-400">Final Adv</th>
                      <th className="p-4 text-right text-orange-400">Shop Adv</th>
                      <th className="p-4 text-right text-red-400">Deduct</th>
                      <th className="p-4 text-right bg-emerald-50/80 dark:bg-emerald-900/10 text-emerald-700">Net Pay</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                    {payrollData.map((row) => {
                      const { paidHolidays, totalPaidDays, net, daysPresent } = calcNetPay(row, daysInMonth);
                      return (
                        <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 group">
                          <td className="p-4 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/50 dark:group-hover:bg-[#111] z-10 border-r border-gray-100 dark:border-neutral-900 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">
                            <p className="font-black text-xs md:text-sm text-gray-900 dark:text-white whitespace-nowrap">{row.name}</p>
                            <button onClick={() => setSalaryBreakdownUser({ staff: row, daysInMonth })} className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline mt-0.5">View Formula</button>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-xs text-gray-900 dark:text-white">₹{parseFloat(row.monthly_fixed_salary || row.base_salary || row.salary || 0).toLocaleString("en-IN")}</td>
                          <td className="p-4 text-center">
                            <span className="font-mono font-black text-xs text-emerald-600" title="Days Worked">{daysPresent}</span>
                            <span className="text-gray-400 mx-1">+</span>
                            <span className="font-mono font-black text-xs text-blue-500" title="Paid Leaves">{paidHolidays}</span>
                            <span className="text-gray-400 mx-1">=</span>
                            <span className="font-mono font-black text-xs text-gray-900 dark:text-white" title="Total Paid Duty">{totalPaidDays}</span>
                          </td>
                          {["pre_advance", "final_advance", "shop_advance", "deduction"].map(col => {
                            const val = parseFloat(row[col] || 0);
                            return (
                              <td key={col} className="p-4 text-right">
                                {val > 0 ? (
                                  <button onClick={() => openTransactionHistory(row, col, col.replace("_", " ").toUpperCase())} className="font-mono text-xs font-bold hover:underline text-red-600 dark:text-red-400">
                                    ₹{val.toLocaleString("en-IN")}
                                  </button>
                                ) : <span className="font-mono text-xs text-gray-300 dark:text-neutral-700">—</span>}
                              </td>
                            );
                          })}
                          <td className="p-4 text-right bg-emerald-50/50 dark:bg-emerald-900/10 border-l border-emerald-100 dark:border-emerald-900/30">
                            <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">₹{parseFloat(net).toLocaleString("en-IN")}</span>
                          </td>
                          <td className="p-4 text-center">
                            {row.ledger_status === 'paid' ? (
                               <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-lg">Paid</span>
                            ) : (
                              <button onClick={() => handleMarkPaid(row, net)} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg transition-colors">
                                Mark Paid
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: FINANCE (Log Transaction & History)
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "finance" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 px-3 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          <div className="xl:col-span-2 space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
              <Banknote size={16} className="text-emerald-500" /> Log Transaction
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {staff.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => setAdvTarget(employee)}
                  className="text-left rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] hover:border-emerald-500/50 p-6 shadow-sm transition-all group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-black text-lg text-gray-900 dark:text-white mb-0.5 group-hover:text-emerald-600 transition-colors">{employee.name}</p>
                      <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">{employee.role}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-neutral-900 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                      <Plus size={16} className="text-gray-400 group-hover:text-emerald-500" strokeWidth={3} />
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-900 flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-500 dark:text-neutral-400">Fixed Salary</span>
                    <span className="font-mono font-black text-gray-900 dark:text-white">₹{parseFloat(employee.monthly_fixed_salary || 0).toLocaleString("en-IN")}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="xl:col-span-1 space-y-4">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
              <History size={16} className="text-orange-500" /> Smart Finance History
            </h3>
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden h-[700px] flex flex-col">
              <div className="overflow-y-auto custom-scrollbar pr-2 pb-8">
                {Object.keys(groupedFinanceLogs).length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center mt-20">
                    <Wallet size={32} className="text-gray-300 dark:text-neutral-700 mb-3" />
                    <p className="font-bold text-sm text-gray-400">No financial transactions logged.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedFinanceLogs).map(([dateLabel, logs]) => (
                      <div key={dateLabel}>
                        <div className="flex items-center gap-4 mb-4 sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm z-10 py-1 -mt-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-900/30">{dateLabel}</span>
                          <div className="h-px bg-gray-100 dark:bg-neutral-800 flex-1"></div>
                        </div>
                        <div className="space-y-3">
                          {logs.map((log) => (
                            <div key={log.id} className="bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-neutral-800 rounded-2xl p-4 hover:border-orange-200 transition-colors">
                              <p className="font-bold text-sm text-gray-900 dark:text-white leading-snug">{log.description}</p>
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-neutral-800">
                                <span className="text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest">{formatDateTime(log.created_at)}</span>
                                <span className="text-[10px] font-bold text-gray-500 dark:text-neutral-400">By <span className="text-blue-500">{log.actor_name || "System"}</span></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          GOD OVERRIDE MODAL (With Contextual Punch Display)
      ══════════════════════════════════════════════════════════════════ */}
      {overrideTarget && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-xl max-h-[90dvh] rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl shrink-0">
              <h2 className="text-base font-black flex items-center gap-2 text-gray-900 dark:text-white"><Edit2 size={18} className="text-emerald-500" /> Override Attendance</h2>
              <button onClick={() => setOverrideTarget(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-500 dark:text-neutral-400"><X size={16} /></button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar p-5 md:p-6 pb-safe">
              <div className="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-neutral-800 mb-6">
                 <div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Employee</p>
                   <p className="text-sm font-black text-gray-900 dark:text-white">{overrideTarget.user.name}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</p>
                   <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">{overrideTarget.date}</p>
                 </div>
              </div>

              {/* Contextual Timeline Verification */}
              <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 mb-6">
                <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Clock3 size={14} /> Recorded Punches for this date</h3>
                {overridePunchesLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
                ) : (
                  <PremiumPunchTimeline punches={overridePunches} isActive={overrideTarget.date === getLocalDate() && overridePersonStatus === 'working'} />
                )}
              </div>

              {/* Override Form */}
              <form onSubmit={handleOverrideSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">New System Status</label>
                  <div className="relative">
                    <select value={overrideForm.status} onChange={e => setOverrideForm({...overrideForm, status: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer">
                      <option value="P">Full Day (F)</option>
                      <option value="H">Half Day (H)</option>
                      <option value="A">Absent (A)</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Reason (Required for Audit)</label>
                  <textarea required value={overrideForm.reason} onChange={e => setOverrideForm({...overrideForm, reason: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none h-20 custom-scrollbar" placeholder="e.g. Approved late entry, system glitch..." />
                </div>

                <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all">
                  <Check size={18} strokeWidth={2.5} /> Confirm Override
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: REPORT GENERATOR (FIXED API ACTION)
      ══════════════════════════════════════════════════════════════════ */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/10 rounded-t-3xl">
              <h2 className="text-base font-black flex items-center gap-2 text-blue-900 dark:text-blue-100"><FileText size={18} className="text-blue-500" /> Generate Branch Report</h2>
              <button onClick={() => setReportModalOpen(false)} className="p-2 bg-gray-100 dark:bg-neutral-900 text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors"><X size={16} /></button>
            </div>
            
            <div className="p-5 md:p-6 space-y-5 pb-safe">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Report Category</label>
                <div className="relative">
                  <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer">
                    <option value="attendance">Attendance Report</option>
                    <option value="finance">Financial & Ledger Report</option>
                    <option value="payroll">Payroll Summary Report</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Start Date</label>
                  <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} max={reportEndDate || getLocalDate()} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">End Date</label>
                  <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} min={reportStartDate} max={getLocalDate()} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
              </div>

              <button onClick={handleDownloadReport} disabled={reportGenerating} className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 mt-2 transition-all">
                {reportGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} strokeWidth={2.5} />} 
                {reportGenerating ? "Generating PDF..." : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ADD EMPLOYEE (God Mode - Create Manager)
      ══════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-3xl max-h-[90dvh] overflow-y-auto custom-scrollbar rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300">
            <div className="sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center z-20">
              <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><Shield size={16} strokeWidth={2.5} /></div>
                Create Personnel
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-neutral-900 rounded-full"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreate} className="p-5 md:p-8 space-y-8 pb-safe">
              <section>
                <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Identity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Full Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" required placeholder="John Doe" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Mobile</label>
                    <input type="tel" value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold font-mono text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" required placeholder="9876543210" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Password</label>
                    <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold font-mono text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" required placeholder="••••••••" />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Role</label>
                    <div className="relative">
                      <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none">
                        <option value="staff">Staff / Floor Worker</option>
                        <option value="manager">Branch Manager</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-t border-gray-100 dark:border-neutral-900 pt-8">
                <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Financial Contract</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-5">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Monthly Salary (₹)</label>
                    <input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} className="w-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-2xl px-4 py-3.5 text-base font-black font-mono text-blue-700 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/50" required placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Leave Cap</label>
                    <div className="relative">
                      <select value={formData.max_paid_leaves} onChange={e => setFormData({...formData, max_paid_leaves: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none">
                        <option value={4}>4 (Tier-A)</option>
                        <option value={2}>2 (Tier-B)</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Shift Hours</label>
                    <input type="number" step="0.5" value={formData.shift_hours} onChange={e => setFormData({...formData, shift_hours: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-3 py-3 text-sm font-bold font-mono text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                </div>
              </section>

              <section className="border-t border-gray-100 dark:border-neutral-900 pt-8 pb-4">
                <h3 className="text-[11px] font-black text-purple-600 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Manager Dashboard Permissions</h3>
                <div className="space-y-6">
                  {ALL_PERMISSIONS.map(cat => (
                    <div key={cat.category} className="bg-gray-50/50 dark:bg-[#111]/50 p-4 rounded-3xl border border-gray-100 dark:border-neutral-900">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 pl-2">{cat.category}</p>
                      <div className="space-y-2">
                        {cat.items.map(perm => {
                          const cur = formData.permissions[perm.id] || { read: false, write: false };
                          return (
                            <div key={perm.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${cur.read || cur.write ? "bg-white dark:bg-black border-purple-200 dark:border-purple-800 shadow-sm" : "bg-transparent border-transparent"}`}>
                              <span className={`text-xs font-bold ${cur.read || cur.write ? "text-purple-900 dark:text-purple-300" : "text-gray-600 dark:text-neutral-400"}`}>{perm.label}</span>
                              <div className="flex items-center gap-4 bg-gray-100 dark:bg-neutral-900 p-1.5 rounded-xl w-fit">
                                {perm.read && (
                                  <label className={`flex items-center gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${cur.read ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500 dark:text-neutral-400"}`}>
                                    <input type="checkbox" className="hidden" checked={cur.read} onChange={() => togglePerm(perm.id, "read")} /> Read
                                  </label>
                                )}
                                {perm.write && (
                                  <label className={`flex items-center gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${cur.write ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500 dark:text-neutral-400"}`}>
                                    <input type="checkbox" className="hidden" checked={cur.write} onChange={() => togglePerm(perm.id, "write")} /> Write
                                  </label>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="pt-4 sticky bottom-0 bg-white dark:bg-[#0a0a0a] pb-safe z-10">
                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-[0.98] transition-all">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={18} strokeWidth={3} /> Establish Personnel</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: EDIT EMPLOYEE
      ══════════════════════════════════════════════════════════════════ */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-3xl max-h-[90dvh] overflow-y-auto custom-scrollbar rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300">
            <div className="sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center z-20">
              <h2 className="text-lg font-black flex items-center gap-2 text-gray-900 dark:text-white"><Edit2 size={16} className="text-blue-500" /> Edit Details</h2>
              <button onClick={() => setEditTarget(null)} className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-5 md:p-8 space-y-6 pb-safe">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Full Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Mobile No.</label>
                  <input type="tel" value={editForm.mobile_number} onChange={e => setEditForm({...editForm, mobile_number: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold font-mono text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">System Role</label>
                  <div className="relative">
                    <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer">
                      <option value="staff">Staff / Floor Worker</option>
                      <option value="manager">Branch Manager</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Salary (₹)</label>
                  <input type="number" value={editForm.salary} onChange={e => setEditForm({...editForm, salary: e.target.value})} className="w-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-2xl px-4 py-3.5 text-sm font-black font-mono text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Leave Cap</label>
                  <div className="relative">
                    <select value={editForm.max_paid_leaves} onChange={e => setEditForm({...editForm, max_paid_leaves: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer">
                      <option value={4}>4 (Tier-A)</option>
                      <option value={2}>2 (Tier-B)</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <section className="border-t border-gray-100 dark:border-neutral-900 pt-6 pb-4">
                <div className="space-y-4">
                  {ALL_PERMISSIONS.map(cat => (
                    <div key={cat.category} className="bg-gray-50/50 dark:bg-[#111]/50 p-3.5 rounded-2xl border border-gray-100 dark:border-neutral-900">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">{cat.category}</p>
                      <div className="space-y-1.5">
                        {cat.items.map(perm => {
                          const cur = editForm.permissions?.[perm.id] || { read: false, write: false };
                          return (
                            <div key={perm.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border transition-all ${cur.read || cur.write ? "bg-white dark:bg-black border-purple-200 dark:border-purple-800 shadow-sm" : "bg-transparent border-transparent"}`}>
                              <span className={`text-[11px] font-bold ${cur.read || cur.write ? "text-purple-900 dark:text-purple-300" : "text-gray-600 dark:text-neutral-400"}`}>{perm.label}</span>
                              <div className="flex gap-2 bg-gray-100 dark:bg-neutral-900 p-1 rounded-lg w-fit">
                                {perm.read && <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-bold uppercase px-3 py-1.5 rounded-md ${cur.read ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500 dark:text-neutral-400"}`}><input type="checkbox" className="hidden" checked={cur.read}  onChange={() => togglePerm(perm.id, "read", true)}  /> Read</label>}
                                {perm.write && <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-bold uppercase px-3 py-1.5 rounded-md ${cur.write ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500 dark:text-neutral-400"}`}><input type="checkbox" className="hidden" checked={cur.write} onChange={() => togglePerm(perm.id, "write", true)} /> Write</label>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="pt-2 sticky bottom-0 bg-white dark:bg-[#0a0a0a] pb-safe z-10">
                <button type="submit" disabled={editSubmitting} className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-[0.98]">
                  {editSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} strokeWidth={2.5} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: LOG ADVANCE (Admin Mode)
      ══════════════════════════════════════════════════════════════════ */}
      {advTarget && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center sm:p-4">
          <div className="w-full md:max-w-md rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl">
              <h2 className="text-base font-black flex items-center gap-2 text-gray-900 dark:text-white"><DollarSign size={18} className="text-orange-500" /> Log Transaction</h2>
              <button onClick={() => {setAdvTarget(null); setAdvForm({ type: "pre_advance", amount: "", remarks: "" });}} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={16} /></button>
            </div>
            
            <form onSubmit={handleAdvanceSubmit} className="p-5 md:p-6 space-y-5 pb-safe">
              <div className="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-neutral-800">
                 <div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Employee</p>
                   <p className="text-sm font-black text-gray-900 dark:text-white">{advTarget.name}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fixed Salary</p>
                   <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">₹{parseFloat(advTarget?.monthly_fixed_salary || 0).toLocaleString("en-IN")}</p>
                 </div>
              </div>

              {/* Admin Warning 30% Logic */}
              {(() => {
                const salary = parseFloat(advTarget?.monthly_fixed_salary || 0);
                const maxAdvAllowed = salary * 0.30;
                const totalTaken = parseFloat(advTarget?.pre_advance_balance || 0) + parseFloat(advTarget?.final_advance_balance || 0);
                const remainingAdv = Math.max(0, maxAdvAllowed - totalTaken);
                const isAdvanceType = ["pre_advance", "final_advance", "shop_advance"].includes(advForm.type);
                const amountNum = parseFloat(advForm.amount || 0);
                const exceedsLimit = isAdvanceType && (amountNum > remainingAdv);

                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-3 rounded-xl">
                        <p className="text-[9px] font-bold text-orange-600/70 dark:text-orange-400/70 uppercase tracking-widest mb-1">Max Limit (30%)</p>
                        <p className="font-mono font-black text-orange-700 dark:text-orange-400 text-sm">₹{maxAdvAllowed.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3 rounded-xl">
                        <p className="text-[9px] font-bold text-red-600/70 dark:text-red-400/70 uppercase tracking-widest mb-1">Currently Taken</p>
                        <p className="font-mono font-black text-red-700 dark:text-red-400 text-sm">₹{totalTaken.toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                    {exceedsLimit && (
                      <div className="p-3.5 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-900/50 rounded-xl flex items-start gap-3">
                        <AlertCircle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400">Amount exceeds the standard 30% limit. As Admin, you may proceed, but verify records.</p>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Transaction Type</label>
                <div className="relative">
                  <select value={advForm.type} onChange={e => setAdvForm({...advForm, type: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 transition-all appearance-none cursor-pointer">
                    <option value="pre_advance">Pre Advance</option>
                    <option value="final_advance">Final Advance</option>
                    <option value="shop_advance">Shop Advance</option>
                    <option value="shop_bill">Shop Bill</option>
                    <option value="deduction">Deduction / Fine</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Amount (₹)</label>
                <input type="number" min="1" value={advForm.amount} onChange={e => setAdvForm({...advForm, amount: e.target.value})} className="w-full rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10 px-4 py-3.5 text-base font-black font-mono text-orange-600 dark:text-orange-400 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-orange-300" required placeholder="0.00" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Remarks</label>
                <textarea value={advForm.remarks} onChange={e => setAdvForm({...advForm, remarks: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 transition-all resize-none h-20 custom-scrollbar" placeholder="Optional note for records..." />
              </div>

              <button type="submit" disabled={advSubmitting} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-[0.98]">
                {advSubmitting ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} strokeWidth={2.5} /> Log Transaction</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: SALARY BREAKDOWN (Mobile fix for Tooltip)
      ══════════════════════════════════════════════════════════════════ */}
      {salaryBreakdownUser && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-sm rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl">
              <h2 className="text-sm font-black flex items-center gap-2 text-gray-900 dark:text-white"><Banknote size={16} className="text-emerald-500" /> Salary Breakdown</h2>
              <button onClick={() => setSalaryBreakdownUser(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <div className="p-6">
              <p className="font-black text-gray-900 dark:text-white mb-4">{salaryBreakdownUser.staff.name}</p>
              <div className="space-y-3 font-mono text-xs">
                {(() => {
                  const { net, perDay, paidHolidays, totalPaidDays, gross, totalAdv, daysPresent } = calcNetPay(salaryBreakdownUser.staff, salaryBreakdownUser.daysInMonth);
                  return (
                    <>
                      <div className="flex justify-between text-gray-500 dark:text-neutral-400"><span>Fixed Salary</span><span className="font-bold text-gray-900 dark:text-white">₹{parseFloat(salaryBreakdownUser.staff.monthly_fixed_salary || salaryBreakdownUser.staff.salary || salaryBreakdownUser.staff.base_salary || 0).toLocaleString("en-IN")}</span></div>
                      <div className="flex justify-between text-gray-500 dark:text-neutral-400"><span>Days in Month</span><span className="font-bold text-gray-900 dark:text-white">{salaryBreakdownUser.daysInMonth}</span></div>
                      <div className="flex justify-between text-gray-500 dark:text-neutral-400 border-t border-dashed border-gray-200 dark:border-neutral-800 pt-2"><span>Per-Day Rate</span><span className="font-bold text-gray-900 dark:text-white">₹{perDay}</span></div>
                      <div className="flex justify-between text-gray-600 dark:text-neutral-400"><span>Days Present</span><span className="font-bold text-emerald-600">{daysPresent}</span></div>
                      <div className="flex justify-between text-gray-600 dark:text-neutral-400"><span>Paid Leaves (Cap {salaryBreakdownUser.staff.max_paid_leaves || salaryBreakdownUser.staff.leave_cap || 4})</span><span className="font-bold text-blue-600">+{paidHolidays}</span></div>
                      <div className="flex justify-between font-bold text-gray-800 dark:text-neutral-200 border-t border-dashed border-gray-200 dark:border-neutral-800 pt-2"><span>Total Paid Duty</span><span>{totalPaidDays}</span></div>
                      <div className="flex justify-between font-bold text-gray-800 dark:text-neutral-200"><span>Gross Earned</span><span>₹{parseFloat(gross).toLocaleString("en-IN")}</span></div>
                      {parseFloat(totalAdv) > 0 && <div className="flex justify-between text-red-500 font-bold"><span>Total Deductions</span><span>−₹{parseFloat(totalAdv).toLocaleString("en-IN")}</span></div>}
                      <div className="flex justify-between font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-3 rounded-xl mt-3 text-sm"><span>Net Payable</span><span>₹{parseFloat(net).toLocaleString("en-IN")}</span></div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: TRANSACTION HISTORY (Triggered from Payroll table)
      ══════════════════════════════════════════════════════════════════ */}
      {transactionHistoryModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[120] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md max-h-[80dvh] flex flex-col rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2 text-gray-900 dark:text-white"><History size={16} className="text-orange-500" /> {transactionHistoryModal.label} History</h2>
              <button onClick={() => setTransactionHistoryModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors"><X size={16} /></button>
            </div>
            <div className="p-5 bg-gray-50 dark:bg-[#111] border-b border-gray-100 dark:border-neutral-900 shrink-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Employee</p>
              <p className="font-black text-gray-900 dark:text-white text-base">{transactionHistoryModal.user.name}</p>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 pb-safe">
              {transactionHistoryModal.loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-orange-500" size={24} /></div>
              ) : transactionHistoryModal.data.length === 0 ? (
                <div className="text-center text-gray-400 font-bold py-10 text-sm">No transactions of this type found for this month.</div>
              ) : (
                <div className="space-y-4">
                  {transactionHistoryModal.data.map(txn => (
                    <div key={txn.id} className="border border-gray-100 dark:border-neutral-800 rounded-2xl p-4 bg-white dark:bg-[#111]">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-lg">₹{parseFloat(txn.amount).toLocaleString("en-IN")}</span>
                        <span className="text-[10px] font-bold text-gray-400 text-right max-w-[120px] uppercase tracking-widest">{formatDateTime(txn.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-neutral-300 font-medium mb-2">{txn.remarks || "No remarks"}</p>
                      <div className="flex items-center gap-1.5 pt-2 border-t border-gray-50 dark:border-neutral-800/50">
                        <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-[8px] font-black text-gray-500">{txn.logged_by_name?.charAt(0) || "?"}</div>
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

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: DELETE CONFIRM
      ══════════════════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-900/50 w-full max-w-sm rounded-3xl shadow-2xl p-6 md:p-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-2 text-red-500 border-4 border-red-100 dark:border-red-900/30">
              <Trash2 size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">Remove {deleteTarget.name}?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 leading-relaxed">
              This action is <strong className="text-red-500">irreversible</strong>. Login access will be instantly revoked.
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleteSubmitting} className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-all shadow-lg active:scale-95 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminBranchHub() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Initializing Superadmin Mode...</p>
      </div>
    }>
      <AdminBranchHubContent />
    </Suspense>
  );
}