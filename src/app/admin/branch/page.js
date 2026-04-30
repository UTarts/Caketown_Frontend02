"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Building2, Users, ArrowLeft, Loader2, Plus, Shield, Banknote,
  Clock, CheckSquare, Calendar, Edit2, Trash2, X, Save,
  TrendingUp, AlertCircle, Info, ChevronDown, FileText,
  DollarSign, Minus, RefreshCw, UserCheck, UserX, Moon, Sun
} from "lucide-react";

// ─── helpers ───────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0h 0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function elapsedSince(isoString) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
}

// Tiered paid-holiday engine (matches the two images exactly)
function calcPaidHolidays(daysPresent, cap) {
  if (cap >= 4) {
    if (daysPresent >= 24) return 4;
    if (daysPresent >= 20) return 3;
    if (daysPresent >= 14) return 2;
    if (daysPresent >= 10) return 1;
    return 0;
  }
  // cap = 2
  if (daysPresent >= 24) return 2;
  if (daysPresent >= 14) return 1;
  return 0;
}

function calcNetPay(staff, daysInMonth) {
  const base = parseFloat(staff.monthly_fixed_salary) || 0;
  if (base === 0) return { net: 0, perDay: 0, paidHolidays: 0, totalPaidDays: 0, gross: 0 };
  const perDay = base / daysInMonth;
  const cap = parseInt(staff.max_paid_leaves) || 4;
  const daysPresent = parseInt(staff.days_worked) || 0;
  const paidHolidays = calcPaidHolidays(daysPresent, cap);
  const totalPaidDays = daysPresent + paidHolidays;
  const gross = perDay * totalPaidDays;
  const preAdv = parseFloat(staff.pre_advance) || 0;
  const finalAdv = parseFloat(staff.final_advance) || 0;
  const shopAdv = parseFloat(staff.shop_advance) || 0;
  const shopBill = parseFloat(staff.shop_bill) || 0;
  const deduction = parseFloat(staff.deduction) || 0;
  const totalAdv = preAdv + finalAdv + shopAdv + shopBill + deduction;
  const net = Math.max(0, gross - totalAdv);
  return { net: net.toFixed(0), perDay: perDay.toFixed(2), paidHolidays, totalPaidDays, gross: gross.toFixed(0), totalAdv: totalAdv.toFixed(0) };
}

// ─── sub-components ────────────────────────────────────────────────────────

function LiveTimer({ punchTime }) {
  const [secs, setSecs] = useState(elapsedSince(punchTime));
  useEffect(() => {
    const id = setInterval(() => setSecs(elapsedSince(punchTime)), 1000);
    return () => clearInterval(id);
  }, [punchTime]);
  return (
    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
      {pad(Math.floor(secs / 3600))}:{pad(Math.floor((secs % 3600) / 60))}:{pad(secs % 60)}
    </span>
  );
}

function AttendanceMarker({ status }) {
  const map = {
    P:  { label: "P",  bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", title: "Present" },
    H:  { label: "H",  bg: "bg-yellow-100 dark:bg-yellow-900/30",   text: "text-yellow-700 dark:text-yellow-300",   title: "Half Day" },
    N:  { label: "N",  bg: "bg-blue-100 dark:bg-blue-900/30",       text: "text-blue-700 dark:text-blue-300",       title: "Night Shift" },
    A:  { label: "A",  bg: "bg-red-100 dark:bg-red-900/30",         text: "text-red-700 dark:text-red-300",         title: "Absent" },
    WO: { label: "W",  bg: "bg-gray-100 dark:bg-neutral-800",       text: "text-gray-500",                          title: "Week Off" },
    "-":{ label: "–",  bg: "",                                        text: "text-gray-300 dark:text-neutral-700",   title: "" },
  };
  const m = map[status] || map["-"];
  return (
    <span title={m.title} className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-black ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

function FormulaTooltip({ staff, daysInMonth }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { net, perDay, paidHolidays, totalPaidDays, gross, totalAdv } = calcNetPay(staff, daysInMonth);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-mono font-black text-base hover:underline"
      >
        ₹{parseFloat(net).toLocaleString("en-IN")}
        <Info size={14} className="text-emerald-500" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-72 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 p-4 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150">
          <p className="font-black text-sm text-black dark:text-white mb-3">Salary Breakdown</p>
          <div className="space-y-1.5 font-mono">
            <div className="flex justify-between text-gray-500">
              <span>Fixed Salary</span><span>₹{parseFloat(staff.monthly_fixed_salary).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Days in Month</span><span>{daysInMonth}</span>
            </div>
            <div className="flex justify-between text-gray-500 border-t border-dashed border-gray-200 dark:border-neutral-800 pt-1.5">
              <span>Per-Day Rate</span><span>₹{perDay}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-neutral-300">
              <span>Days Present</span><span className="text-emerald-600">{staff.days_worked}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-neutral-300">
              <span>Paid Holidays (cap {staff.max_paid_leaves})</span><span className="text-blue-600">+{paidHolidays}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-800 dark:text-white border-t border-dashed border-gray-200 dark:border-neutral-800 pt-1.5">
              <span>Total Paid Days</span><span>{totalPaidDays}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-800 dark:text-white">
              <span>Gross (rate × days)</span><span>₹{parseFloat(gross).toLocaleString("en-IN")}</span>
            </div>
            {parseFloat(totalAdv) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Total Deductions</span><span>−₹{parseFloat(totalAdv).toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-emerald-700 dark:text-emerald-400 border-t border-gray-200 dark:border-neutral-800 pt-1.5 text-sm">
              <span>Net Payable</span><span>₹{parseFloat(net).toLocaleString("en-IN")}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 pt-1">(salary ÷ days) × (present + paid holidays) − advances</p>
        </div>
      )}
    </div>
  );
}

// ─── FULL PERMISSIONS LIST ─────────────────────────────────────────────────
const ALL_PERMISSIONS = [
  { category: "Attendance", items: [
    { id: "view_live_attendance",    label: "View Live Floor Status",    read: true,  write: false },
    { id: "view_attendance_history", label: "View Attendance History",   read: true,  write: false },
    { id: "edit_attendance",         label: "Override / Edit Attendance",read: true,  write: true  },
    { id: "manage_terminal",         label: "Manage Biometric Terminal", read: false, write: true  },
    { id: "register_face",           label: "Register Employee Face",    read: false, write: true  },
  ]},
  { category: "Payroll & Finance", items: [
    { id: "view_payroll",            label: "View Payroll Data",         read: true,  write: false },
    { id: "edit_payroll",            label: "Edit / Finalize Payroll",   read: false, write: true  },
    { id: "log_advance",             label: "Log Advance / Pre-Advance", read: false, write: true  },
    { id: "log_shop_bill",           label: "Log Shop Bills",            read: false, write: true  },
    { id: "log_shop_advance",        label: "Log Shop Advance",          read: false, write: true  },
    { id: "view_financial_history",  label: "View Financial History",    read: true,  write: false },
    { id: "download_salary_slip",    label: "Download Salary Slip",      read: true,  write: false },
  ]},
  { category: "Reports", items: [
    { id: "download_attendance_report", label: "Download Attendance Report", read: true, write: false },
    { id: "download_financial_report",  label: "Download Financial Report",  read: true, write: false },
    { id: "download_full_report",       label: "Download Full Monthly Report",read: true, write: false },
  ]},
  { category: "Staff Management", items: [
    { id: "view_staff_list",   label: "View Staff List",          read: true,  write: false },
    { id: "edit_staff",        label: "Edit Staff Details",       read: false, write: true  },
    { id: "view_staff_profile",label: "View Own Profile",         read: true,  write: false },
  ]},
];

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
function CommandRoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const branch_id = searchParams.get("id");

  const [masterData, setMasterData]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState("overview");
  const [ticker, setTicker]           = useState(0);

  // month/year picker for ledger + payroll
  const now = new Date();
  const [finMonth, setFinMonth] = useState(now.getMonth() + 1);
  const [finYear,  setFinYear]  = useState(now.getFullYear());
  const daysInMonth = new Date(finYear, finMonth, 0).getDate();

  // sub-data
  const [payrollData,    setPayrollData]    = useState([]);
  const [attendanceGrid, setAttendanceGrid] = useState([]);
  const [isSubLoading,   setIsSubLoading]   = useState(false);

  // edit employee
  const [editTarget,  setEditTarget]  = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // advance modal
  const [advTarget,  setAdvTarget]  = useState(null);
  const [advForm,    setAdvForm]    = useState({ type: "pre_advance", amount: "", remarks: "" });
  const [advSubmitting, setAdvSubmitting] = useState(false);

  // create employee
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const blankForm = {
    role: "staff", name: "", mobile_number: "", password: "",
    salary: "", paid_leaves: 4, max_paid_leaves: 4, shift_hours: 10, permissions: {},
  };
  const [formData, setFormData] = useState(blankForm);

  // live auto-refresh every 30 s when on overview
  useEffect(() => {
    if (activeTab !== "overview") return;
    const id = setInterval(() => setTicker(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [activeTab]);

  useEffect(() => { if (branch_id) fetchBranchMaster(); }, [branch_id, ticker]);

  useEffect(() => {
    if (activeTab === "payroll")    loadPayroll();
    if (activeTab === "attendance") loadAttendance();
  }, [activeTab, finMonth, finYear]);

  const fetchBranchMaster = useCallback(async () => {
    const res = await callApi("get_branch_master", { branch_id });
    if (res.status === "success") { setMasterData(res.data); setLoading(false); }
    else { alert("Failed to load branch."); router.push("/admin/branches"); }
  }, [branch_id]);

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

  // ── Edit employee ────────────────────────────────────────────────────────
  const openEdit = (user) => {
    setEditTarget(user);
    setEditForm({
      name: user.name, mobile_number: user.mobile_number,
      role: user.role, salary: user.monthly_fixed_salary,
      paid_leaves: user.paid_leaves, max_paid_leaves: user.max_paid_leaves || 4,
      shift_hours: user.standard_shift_hours,
      permissions: typeof user.feature_permissions === "string"
        ? JSON.parse(user.feature_permissions) : (user.feature_permissions || {}),
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    const res = await callApi("update_user", { user_id: editTarget.id, ...editForm });
    if (res.status === "success") { setEditTarget(null); fetchBranchMaster(); }
    else alert(res.message);
    setEditSubmitting(false);
  };

  // ── Delete employee ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleteSubmitting(true);
    const res = await callApi("delete_user", { user_id: deleteTarget.id });
    if (res.status === "success") { setDeleteTarget(null); fetchBranchMaster(); }
    else alert(res.message);
    setDeleteSubmitting(false);
  };

  // ── Log advance ──────────────────────────────────────────────────────────
  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    setAdvSubmitting(true);
    const res = await callApi("log_advance", {
      user_id: advTarget.id, branch_id,
      type: advForm.type, amount: advForm.amount,
      remarks: advForm.remarks, month: finMonth, year: finYear,
    });
    if (res.status === "success") {
      setAdvTarget(null);
      setAdvForm({ type: "pre_advance", amount: "", remarks: "" });
      if (activeTab === "payroll") loadPayroll();
    } else alert(res.message);
    setAdvSubmitting(false);
  };

  // ── Create employee ──────────────────────────────────────────────────────
  const togglePerm = (permId, mode) => {
    setFormData(prev => {
      const cur = prev.permissions[permId] || { read: false, write: false };
      return { ...prev, permissions: { ...prev.permissions, [permId]: { ...cur, [mode]: !cur[mode] } } };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await callApi("create_user", { ...formData, branch_id });
    if (res.status === "success") { setIsModalOpen(false); setFormData(blankForm); fetchBranchMaster(); }
    else alert(res.message);
    setIsSubmitting(false);
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────
  if (loading || !masterData) return (
    <div className="h-full flex items-center justify-center py-40">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
    </div>
  );

  const { branch, staff, live_punches } = masterData;

  const TABS = [
    { id: "overview",   label: "Live Floor" },
    { id: "personnel",  label: "Personnel" },
    { id: "attendance", label: "Attendance Ledger" },
    { id: "payroll",    label: "Payroll Engine" },
  ];

  return (
    <div className="text-gray-900 dark:text-neutral-200 font-sans pb-24">
      <div className="max-w-[1440px] mx-auto space-y-6 px-2 md:px-0">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/branches")}
            className="p-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
              <Building2 size={14} />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Isolated Branch Environment</span>
            </div>
            <h1 className="text-3xl font-black text-black dark:text-white leading-none">{branch.branch_name}</h1>
          </div>
          <button onClick={() => { setLoading(true); fetchBranchMaster(); }} className="ml-auto p-2 text-gray-400 hover:text-emerald-500 transition-colors" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex overflow-x-auto custom-scrollbar gap-2 border-b border-gray-200 dark:border-neutral-800 pb-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAB: LIVE FLOOR
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Quick stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Staff",   value: staff.length,                                       color: "text-black dark:text-white" },
                { label: "On Floor Now",  value: live_punches?.filter(p => p.is_active).length ?? 0, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "On Break",      value: live_punches?.filter(p => p.on_break).length ?? 0,  color: "text-yellow-600 dark:text-yellow-400" },
                { label: "Off Duty",      value: (staff.length) - (live_punches?.filter(p => p.is_active).length ?? 0), color: "text-gray-400" },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-3xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Live punch cards */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Floor Activity
              </h3>
              {(!live_punches || live_punches.length === 0) ? (
                <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-10 text-center text-gray-400">
                  <UserX size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold">No one has punched in today.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {live_punches.map((punch, i) => (
                    <div key={i} className={`bg-white dark:bg-black border rounded-2xl p-5 shadow-sm transition-all ${
                      punch.is_active
                        ? "border-emerald-300 dark:border-emerald-700 shadow-emerald-100 dark:shadow-emerald-900/20"
                        : "border-gray-200 dark:border-neutral-800 opacity-70"
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-black text-sm text-black dark:text-white">{punch.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{punch.role}</p>
                        </div>
                        {punch.is_active
                          ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full"><UserCheck size={10}/> Active</span>
                          : <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-neutral-900 px-2 py-1 rounded-full">Off</span>
                        }
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400 font-bold">First In</span>
                          <span className="font-mono font-bold">{punch.first_punch ? new Date(punch.first_punch).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                        </div>
                        {punch.is_active && punch.last_punch && (
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-bold">Session Running</span>
                            <LiveTimer punchTime={punch.last_punch} />
                          </div>
                        )}
                        <div className="flex justify-between border-t border-gray-100 dark:border-neutral-900 pt-2">
                          <span className="text-gray-400 font-bold">Total Today</span>
                          <span className="font-mono font-black text-black dark:text-white">{formatDuration(punch.total_seconds)}</span>
                        </div>
                        {parseFloat(punch.break_seconds) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-yellow-500 font-bold">Break Time</span>
                            <span className="font-mono font-bold text-yellow-600 dark:text-yellow-400">{formatDuration(punch.break_seconds)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: PERSONNEL
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "personnel" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-end">
              <button
                onClick={() => { setIsModalOpen(true); setFormData(blankForm); }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 text-sm"
              >
                <Plus size={16} /> Add Employee
              </button>
            </div>

            <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="p-4">Name</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Mobile</th>
                    <th className="p-4 text-right">Salary</th>
                    <th className="p-4 text-center">Leave Cap</th>
                    <th className="p-4 text-center">Shift</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                  {staff.length === 0 && (
                    <tr><td colSpan={7} className="p-10 text-center text-gray-400 font-bold">No personnel in this branch yet.</td></tr>
                  )}
                  {staff.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/60 transition-colors">
                      <td className="p-4 font-bold text-sm text-black dark:text-white">{user.name}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                          user.role === "manager"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                            : "bg-gray-100 text-gray-600 dark:bg-neutral-900 dark:text-neutral-400"
                        }`}>{user.role}</span>
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-500">{user.mobile_number}</td>
                      <td className="p-4 text-right font-mono font-black text-sm">₹{parseFloat(user.monthly_fixed_salary).toLocaleString("en-IN")}</td>
                      <td className="p-4 text-center font-mono font-bold text-sm">{user.max_paid_leaves ?? user.paid_leaves}</td>
                      <td className="p-4 text-center text-sm font-bold">{user.standard_shift_hours}h</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit(user)} title="Edit" className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 rounded-lg transition-colors">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => setAdvTarget(user)} title="Log Advance" className="p-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 rounded-lg transition-colors">
                            <DollarSign size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(user)} title="Delete" className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-lg transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Month/Year picker for Attendance & Payroll ──────────────── */}
        {(activeTab === "attendance" || activeTab === "payroll") && (
          <div className="flex flex-wrap gap-3 items-center animate-in fade-in duration-300">
            <div className="flex items-center gap-2 bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2">
              <Calendar size={14} className="text-gray-400" />
              <select value={finMonth} onChange={e => setFinMonth(parseInt(e.target.value))} className="bg-transparent text-sm font-bold outline-none">
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("default", { month: "long" })}</option>
                ))}
              </select>
            </div>
            <select value={finYear} onChange={e => setFinYear(parseInt(e.target.value))} className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm font-bold outline-none">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => activeTab === "attendance" ? loadAttendance() : loadPayroll()} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 transition-colors">
              <RefreshCw size={14} /> Load
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: ATTENDANCE LEDGER
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "attendance" && (
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Legend */}
            <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100 dark:border-neutral-900 text-xs">
              {[
                { marker: "P", label: "Present",   bg: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
                { marker: "H", label: "Half Day",  bg: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" },
                { marker: "N", label: "Night",     bg: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
                { marker: "A", label: "Absent",    bg: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" },
                { marker: "W", label: "Week Off",  bg: "bg-gray-100 dark:bg-neutral-800 text-gray-500" },
              ].map(l => (
                <div key={l.marker} className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-black ${l.bg}`}>{l.marker}</span>
                  <span className="text-gray-500 font-bold">{l.label}</span>
                </div>
              ))}
            </div>

            {isSubLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
            ) : attendanceGrid.length === 0 ? (
              <div className="p-10 text-center text-gray-400 font-bold">No attendance data for this period.</div>
            ) : (
              <div className="w-full overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse" style={{ minWidth: `${60 + daysInMonth * 52}px` }}>
                  <thead>
                    <tr className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-neutral-800">
                      <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-50 dark:bg-[#0a0a0a] z-10 border-r border-gray-200 dark:border-neutral-800 min-w-[140px]">
                        Personnel
                      </th>
                      {[...Array(daysInMonth)].map((_, i) => {
                        const d = new Date(finYear, finMonth - 1, i + 1);
                        const dayName = d.toLocaleDateString("en-IN", { weekday: "short" }).charAt(0);
                        const isSun = d.getDay() === 0;
                        return (
                          <th key={i} className={`p-2 text-center min-w-[48px] border-r border-gray-100 dark:border-neutral-900 ${isSun ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                            <div className={`text-[9px] font-bold uppercase ${isSun ? "text-red-400" : "text-gray-400"}`}>{dayName}</div>
                            <div className={`text-xs font-black ${isSun ? "text-red-500" : "text-gray-600 dark:text-neutral-300"}`}>{i + 1}</div>
                          </th>
                        );
                      })}
                      {["P", "H", "N", "A"].map(h => (
                        <th key={h} className="p-3 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest min-w-[44px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                    {attendanceGrid.map((row, idx) => {
                      let totP = 0, totH = 0, totN = 0, totA = 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/60 transition-colors">
                          <td className="p-4 sticky left-0 bg-white dark:bg-black z-10 border-r border-gray-200 dark:border-neutral-800 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)]">
                            <p className="font-bold text-sm text-black dark:text-white whitespace-nowrap">{row.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{row.role}</p>
                          </td>
                          {[...Array(daysInMonth)].map((_, i) => {
                            const dateStr = `${finYear}-${pad(finMonth)}-${pad(i + 1)}`;
                            const status = row.days?.[dateStr] || "-";
                            if (status === "P")  totP++;
                            if (status === "H")  totH++;
                            if (status === "N")  totN++;
                            if (status === "A")  totA++;
                            return (
                              <td key={i} className="p-2 text-center border-r border-gray-100 dark:border-neutral-900">
                                <AttendanceMarker status={status} />
                              </td>
                            );
                          })}
                          <td className="p-3 text-center font-mono font-black text-sm text-emerald-600">{totP}</td>
                          <td className="p-3 text-center font-mono font-black text-sm text-yellow-600">{totH}</td>
                          <td className="p-3 text-center font-mono font-black text-sm text-blue-600">{totN}</td>
                          <td className="p-3 text-center font-mono font-black text-sm text-red-500">{totA}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: PAYROLL ENGINE
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "payroll" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* formula reminder banner */}
            <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-sm">
              <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-800 dark:text-blue-300">Formula Applied</p>
                <p className="text-blue-600 dark:text-blue-400 font-mono text-xs mt-0.5">
                  Net = (Salary ÷ {daysInMonth} days) × (Present + Paid Holidays) − Pre-Advance − Final Advance − Shop Advance − Shop Bill − Deductions
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
              {isSubLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
              ) : payrollData.length === 0 ? (
                <div className="p-10 text-center text-gray-400 font-bold">No payroll data for this period.</div>
              ) : (
                <div className="w-full overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <th className="p-4 sticky left-0 bg-gray-50 dark:bg-[#0a0a0a] z-10">Personnel</th>
                        <th className="p-4 text-right">Salary</th>
                        <th className="p-4 text-center">Present</th>
                        <th className="p-4 text-center">Holidays</th>
                        <th className="p-4 text-center">Paid Days</th>
                        <th className="p-4 text-right text-red-400">Pre Adv</th>
                        <th className="p-4 text-right text-red-400">Final Adv</th>
                        <th className="p-4 text-right text-orange-400">Shop Adv</th>
                        <th className="p-4 text-right text-orange-400">Shop Bill</th>
                        <th className="p-4 text-right text-red-400">Deduction</th>
                        <th className="p-4 text-right bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400">Net Pay ▼</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                      {payrollData.map((row) => {
                        const { paidHolidays, totalPaidDays } = calcNetPay(row, daysInMonth);
                        return (
                          <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/60 transition-colors">
                            <td className="p-4 sticky left-0 bg-white dark:bg-black z-10">
                              <p className="font-bold text-sm text-black dark:text-white">{row.name}</p>
                              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{row.role}</p>
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-sm">₹{parseFloat(row.monthly_fixed_salary).toLocaleString("en-IN")}</td>
                            <td className="p-4 text-center font-mono font-black text-emerald-600 dark:text-emerald-400">{row.days_worked}</td>
                            <td className="p-4 text-center font-mono font-black text-blue-600 dark:text-blue-400">+{paidHolidays}</td>
                            <td className="p-4 text-center font-mono font-black text-gray-700 dark:text-neutral-200">{totalPaidDays}</td>
                            <td className="p-4 text-right font-mono text-sm text-red-600 dark:text-red-400">{parseFloat(row.pre_advance) > 0 ? `₹${parseFloat(row.pre_advance).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="p-4 text-right font-mono text-sm text-red-600 dark:text-red-400">{parseFloat(row.final_advance) > 0 ? `₹${parseFloat(row.final_advance).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="p-4 text-right font-mono text-sm text-orange-600 dark:text-orange-400">{parseFloat(row.shop_advance) > 0 ? `₹${parseFloat(row.shop_advance).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="p-4 text-right font-mono text-sm text-orange-600 dark:text-orange-400">{parseFloat(row.shop_bill) > 0 ? `₹${parseFloat(row.shop_bill).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="p-4 text-right font-mono text-sm text-red-600 dark:text-red-400">{parseFloat(row.deduction) > 0 ? `₹${parseFloat(row.deduction).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="p-4 text-right bg-emerald-50 dark:bg-emerald-900/10">
                              <FormulaTooltip staff={row} daysInMonth={daysInMonth} />
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
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ADD EMPLOYEE
      ══════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-2xl max-h-[92dvh] overflow-y-auto custom-scrollbar rounded-t-3xl md:rounded-3xl shadow-2xl">
            <div className="sticky top-0 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md p-6 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center z-10">
              <h2 className="text-lg font-black flex items-center gap-2"><Shield size={18} className="text-emerald-500" /> Add Employee</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-xl transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-8">

              {/* Identity */}
              <section>
                <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4">Identity & Access</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Full Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors" required placeholder="Full Name" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mobile No.</label>
                    <input type="tel" value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono outline-none focus:border-emerald-500 transition-colors" required placeholder="9876543210" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Password</label>
                    <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono outline-none focus:border-emerald-500 transition-colors" required placeholder="••••••••" />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Role</label>
                    <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors">
                      <option value="staff">Staff / Floor Worker</option>
                      <option value="manager">Branch Manager</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Finance */}
              <section className="border-t border-gray-100 dark:border-neutral-900 pt-6">
                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Banknote size={14} /> Financial Contract</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Monthly Salary (₹)</label>
                    <input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 transition-colors" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Max Paid Leaves</label>
                    <select value={formData.max_paid_leaves} onChange={e => setFormData({...formData, max_paid_leaves: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500">
                      <option value={4}>4 (Tier-A)</option>
                      <option value={2}>2 (Tier-B)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Shift Hours</label>
                    <input type="number" step="0.5" value={formData.shift_hours} onChange={e => setFormData({...formData, shift_hours: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-3 text-sm font-bold font-mono outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  Max advance eligible = 30% of salary = <span className="font-bold text-orange-500">₹{(formData.salary * 0.3).toFixed(0)}</span>
                </p>
              </section>

              {/* Permissions */}
              <section className="border-t border-gray-100 dark:border-neutral-900 pt-6">
                <h3 className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-4 flex items-center gap-2"><CheckSquare size={14} /> Permissions</h3>
                <div className="space-y-6">
                  {ALL_PERMISSIONS.map(cat => (
                    <div key={cat.category}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{cat.category}</p>
                      <div className="space-y-2">
                        {cat.items.map(perm => {
                          const cur = formData.permissions[perm.id] || { read: false, write: false };
                          return (
                            <div key={perm.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${(cur.read || cur.write) ? "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800" : "bg-gray-50 dark:bg-neutral-950 border-gray-200 dark:border-neutral-800"}`}>
                              <span className={`text-xs font-bold ${(cur.read || cur.write) ? "text-purple-800 dark:text-purple-300" : "text-gray-600 dark:text-neutral-400"}`}>{perm.label}</span>
                              <div className="flex items-center gap-3">
                                {perm.read && (
                                  <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-gray-500">
                                    <input type="checkbox" className="accent-purple-500" checked={cur.read} onChange={() => togglePerm(perm.id, "read")} /> Read
                                  </label>
                                )}
                                {perm.write && (
                                  <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-gray-500">
                                    <input type="checkbox" className="accent-purple-500" checked={cur.write} onChange={() => togglePerm(perm.id, "write")} /> Write
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

              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-[0.98]">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={18} /> Create Employee</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: EDIT EMPLOYEE
      ══════════════════════════════════════════════════════════════════ */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-2xl max-h-[92dvh] overflow-y-auto custom-scrollbar rounded-t-3xl md:rounded-3xl shadow-2xl">
            <div className="sticky top-0 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md p-6 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center z-10">
              <h2 className="text-lg font-black flex items-center gap-2"><Edit2 size={18} className="text-blue-500" /> Edit — {editTarget.name}</h2>
              <button onClick={() => setEditTarget(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-xl transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Full Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-colors" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Mobile</label>
                  <input type="tel" value={editForm.mobile_number} onChange={e => setEditForm({...editForm, mobile_number: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono outline-none focus:border-blue-500 transition-colors" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Role</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Salary (₹)</label>
                  <input type="number" value={editForm.salary} onChange={e => setEditForm({...editForm, salary: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono text-blue-600 outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Max Paid Leaves</label>
                  <select value={editForm.max_paid_leaves} onChange={e => setEditForm({...editForm, max_paid_leaves: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                    <option value={4}>4 (Tier-A)</option>
                    <option value={2}>2 (Tier-B)</option>
                  </select>
                </div>
              </div>

              {/* Permissions in edit mode */}
              <div className="border-t border-gray-100 dark:border-neutral-900 pt-6">
                <p className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-4">Permissions</p>
                <div className="space-y-4">
                  {ALL_PERMISSIONS.map(cat => (
                    <div key={cat.category}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{cat.category}</p>
                      <div className="space-y-1.5">
                        {cat.items.map(perm => {
                          const cur = editForm.permissions?.[perm.id] || { read: false, write: false };
                          const toggleEdit = (mode) => setEditForm(prev => ({
                            ...prev,
                            permissions: { ...prev.permissions, [perm.id]: { ...cur, [mode]: !cur[mode] } }
                          }));
                          return (
                            <div key={perm.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${(cur.read || cur.write) ? "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800" : "bg-gray-50 dark:bg-neutral-950 border-gray-200 dark:border-neutral-800"}`}>
                              <span className="text-xs font-bold text-gray-600 dark:text-neutral-400">{perm.label}</span>
                              <div className="flex items-center gap-3">
                                {perm.read  && <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-gray-500"><input type="checkbox" className="accent-purple-500" checked={cur.read}  onChange={() => toggleEdit("read")}  /> Read</label>}
                                {perm.write && <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-gray-500"><input type="checkbox" className="accent-purple-500" checked={cur.write} onChange={() => toggleEdit("write")} /> Write</label>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={editSubmitting} className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl disabled:opacity-50 active:scale-[0.98]">
                {editSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> Save Changes</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: LOG ADVANCE
      ══════════════════════════════════════════════════════════════════ */}
      {advTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
              <h2 className="text-lg font-black flex items-center gap-2"><DollarSign size={18} className="text-orange-500" /> Log Transaction</h2>
              <button onClick={() => setAdvTarget(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdvanceSubmit} className="p-6 space-y-4">
              <p className="text-sm font-bold text-gray-500">Employee: <span className="text-black dark:text-white">{advTarget.name}</span></p>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Transaction Type</label>
                <select value={advForm.type} onChange={e => setAdvForm({...advForm, type: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-orange-500 transition-colors">
                  <option value="pre_advance">Pre Advance</option>
                  <option value="final_advance">Final Advance</option>
                  <option value="shop_advance">Shop Advance</option>
                  <option value="shop_bill">Shop Bill</option>
                  <option value="deduction">Deduction / Fine</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Amount (₹)</label>
                <input type="number" min="1" value={advForm.amount} onChange={e => setAdvForm({...advForm, amount: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono text-orange-600 outline-none focus:border-orange-500 transition-colors" required placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Remarks</label>
                <textarea value={advForm.remarks} onChange={e => setAdvForm({...advForm, remarks: e.target.value})} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 transition-colors resize-none h-20" placeholder="Optional note..." />
              </div>
              <button type="submit" disabled={advSubmitting} className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-[0.98]">
                {advSubmitting ? <Loader2 className="animate-spin" size={18} /> : <><Save size={16} /> Log Transaction</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: DELETE CONFIRM
      ══════════════════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-500" size={24} />
            </div>
            <h3 className="text-lg font-black">Delete {deleteTarget.name}?</h3>
            <p className="text-sm text-gray-500">This action is <span className="font-bold text-red-500">irreversible</span>. All attendance and financial records will remain, but login access will be permanently removed.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 bg-gray-100 dark:bg-neutral-900 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleteSubmitting} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BranchCommandRoom() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center py-40"><Loader2 className="animate-spin text-emerald-500" size={40} /></div>}>
      <CommandRoomContent />
    </Suspense>
  );
}
