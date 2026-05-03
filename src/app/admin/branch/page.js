"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Building2, Users, ArrowLeft, Loader2, Plus, Shield, Banknote,
  Clock, CheckSquare, Calendar, Edit2, Trash2, X, Save,
  Info, DollarSign, RefreshCw, UserCheck, UserX, Activity, History, ChevronDown
} from "lucide-react";

// ─── HELPERS ───────────────────────────────────────────────────────────────
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
  const base = parseFloat(staff.monthly_fixed_salary) || 0;
  if (base === 0) return { net: 0, perDay: 0, paidHolidays: 0, totalPaidDays: 0, gross: 0, totalAdv: 0 };
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

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────
function LiveTimer({ punchTime }) {
  const [secs, setSecs] = useState(elapsedSince(punchTime));
  useEffect(() => {
    const id = setInterval(() => setSecs(elapsedSince(punchTime)), 1000);
    return () => clearInterval(id);
  }, [punchTime]);
  return (
    <span className="font-mono text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
      {pad(Math.floor(secs / 3600))}:{pad(Math.floor((secs % 3600) / 60))}:{pad(secs % 60)}
    </span>
  );
}

function AttendanceMarker({ status }) {
  const map = {
    P:  { label: "P",  bg: "bg-emerald-100 dark:bg-emerald-500/20", text: "text-emerald-700 dark:text-emerald-400", title: "Present" },
    H:  { label: "H",  bg: "bg-yellow-100 dark:bg-yellow-500/20",   text: "text-yellow-700 dark:text-yellow-400",   title: "Half Day" },
    N:  { label: "N",  bg: "bg-blue-100 dark:bg-blue-500/20",       text: "text-blue-700 dark:text-blue-400",       title: "Night Shift" },
    A:  { label: "A",  bg: "bg-red-100 dark:bg-red-500/20",         text: "text-red-700 dark:text-red-400",         title: "Absent" },
    WO: { label: "W",  bg: "bg-gray-100 dark:bg-neutral-800",       text: "text-gray-500 dark:text-neutral-400",    title: "Week Off" },
    "-":{ label: "–",  bg: "bg-transparent",                        text: "text-gray-300 dark:text-neutral-700",    title: "No Data" },
  };
  const m = map[status] || map["-"];
  return (
    <span title={m.title} className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-[10px] font-black transition-colors ${m.bg} ${m.text}`}>
      {m.label}
    </span>
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
  { category: "Staff Management", items: [
    { id: "view_staff_list",   label: "View Staff List",          read: true,  write: false },
    { id: "edit_staff",        label: "Edit Staff Details",       read: false, write: true  },
  ]},
];

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
function CommandRoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const branch_id = searchParams.get("id");

  const [masterData, setMasterData]   = useState(null);
  const [branchLogs, setBranchLogs]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState("overview");
  const [ticker, setTicker]           = useState(0);

  // Month/year picker
  const now = new Date();
  const [finMonth, setFinMonth] = useState(now.getMonth() + 1);
  const [finYear,  setFinYear]  = useState(now.getFullYear());
  const daysInMonth = new Date(finYear, finMonth, 0).getDate();

  // Sub-data
  const [payrollData,    setPayrollData]    = useState([]);
  const [attendanceGrid, setAttendanceGrid] = useState([]);
  const [isSubLoading,   setIsSubLoading]   = useState(false);

  // Modals
  const [editTarget,  setEditTarget]  = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [advTarget,  setAdvTarget]  = useState(null);
  const [advForm,    setAdvForm]    = useState({ type: "pre_advance", amount: "", remarks: "" });
  const [advSubmitting, setAdvSubmitting] = useState(false);

  // New Modals for App-Like Experience
  const [salaryBreakdownUser, setSalaryBreakdownUser] = useState(null);
  const [transactionHistoryModal, setTransactionHistoryModal] = useState(null); // { user, type, label, data, loading }

  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const blankForm = {
    role: "staff", name: "", mobile_number: "", password: "",
    salary: "", paid_leaves: 4, max_paid_leaves: 4, shift_hours: 10, permissions: {},
  };
  const [formData, setFormData] = useState(blankForm);

  useEffect(() => {
    if (activeTab !== "overview") return;
    const id = setInterval(() => setTicker(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [activeTab]);

  useEffect(() => { if (branch_id) { fetchBranchMaster(); fetchBranchLogs(); } }, [branch_id, ticker]);

  useEffect(() => {
    if (activeTab === "payroll")    loadPayroll();
    if (activeTab === "attendance") loadAttendance();
  }, [activeTab, finMonth, finYear]);

  const fetchBranchMaster = useCallback(async () => {
    const res = await callApi("get_branch_master", { branch_id });
    if (res.status === "success") { setMasterData(res.data); setLoading(false); }
    else { alert("Failed to load branch."); router.push("/admin/branches"); }
  }, [branch_id]);

  const fetchBranchLogs = async () => {
    const res = await callApi("get_system_logs", { branch_id, per_page: 20 });
    if (res.status === "success") setBranchLogs(res.data || []);
  };

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

  const openTransactionHistory = async (user, type, label) => {
    setTransactionHistoryModal({ user, type, label, data: [], loading: true });
    const res = await callApi("get_advance_history", { user_id: user.id, month: finMonth, year: finYear });
    if (res.status === "success") {
      // Filter by type if needed, or show all mapped to this column
      const filtered = res.data.filter(t => t.type === type);
      setTransactionHistoryModal({ user, type, label, data: filtered, loading: false });
    } else {
      setTransactionHistoryModal({ user, type, label, data: [], loading: false });
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
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

  const handleDelete = async () => {
    setDeleteSubmitting(true);
    const res = await callApi("delete_user", { user_id: deleteTarget.id });
    if (res.status === "success") { setDeleteTarget(null); fetchBranchMaster(); }
    else alert(res.message);
    setDeleteSubmitting(false);
  };

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

  if (loading || !masterData) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} strokeWidth={2} />
      <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Initializing Environment...</p>
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
    <div className="text-gray-900 dark:text-neutral-200 font-sans pb-32 animate-in fade-in duration-500 w-full overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto space-y-6 md:space-y-8 px-3 md:px-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 bg-white/60 dark:bg-neutral-900/40 p-4 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mt-2">
          <button
            onClick={() => router.push("/admin/branches")}
            className="p-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all shadow-sm"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
              <Building2 size={12} className="shrink-0" />
              <span className="text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase truncate">Isolated Environment</span>
            </div>
            <h1 className="text-xl md:text-3xl font-black text-gray-900 dark:text-white leading-none tracking-tight truncate">{branch.branch_name}</h1>
          </div>
          <button onClick={() => { setLoading(true); fetchBranchMaster(); fetchBranchLogs(); }} className="flex items-center justify-center p-3 md:px-4 md:py-2.5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl hover:text-emerald-500 text-sm font-bold shadow-sm transition-all shrink-0">
            <RefreshCw size={18} className="md:mr-2" /> <span className="hidden md:inline">Sync</span>
          </button>
        </div>

        {/* ── Tabs (Sticky & Mobile Scrollable) ───────────────────────────── */}
        <div className="sticky top-14 md:top-0 z-30 bg-[#F8FAFC]/90 dark:bg-[#050505]/90 backdrop-blur-xl pt-2 pb-4 -mx-3 px-3 md:mx-0 md:px-0">
          <div className="flex overflow-x-auto custom-scrollbar gap-2 pb-2 snap-x">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`snap-start shrink-0 px-5 md:px-6 py-2.5 md:py-3 rounded-2xl text-xs md:text-sm font-black whitespace-nowrap transition-all duration-300 ${
                  activeTab === tab.id
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-400/50"
                    : "bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAB: LIVE FLOOR
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            
            <div className="xl:col-span-2 space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: "Total Staff",   value: staff.length,                                       color: "text-gray-900 dark:text-white" },
                  { label: "On Floor Now",  value: live_punches?.filter(p => p.is_active).length ?? 0, color: "text-emerald-600 dark:text-emerald-400" },
                  { label: "On Break",      value: live_punches?.filter(p => p.on_break).length ?? 0,  color: "text-yellow-600 dark:text-yellow-400" },
                  { label: "Off Duty",      value: (staff.length) - (live_punches?.filter(p => p.is_active).length ?? 0), color: "text-gray-400" },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-4 md:p-5 shadow-sm">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-2">{s.label}</p>
                    <p className={`text-2xl md:text-3xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Live Punch Cards */}
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  Live Floor Activity
                </h3>

                {(!live_punches || live_punches.length === 0) ? (
                  <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-10 flex flex-col items-center justify-center text-gray-400 shadow-sm">
                    <UserX size={32} className="opacity-30 mb-3" />
                    <p className="font-bold text-sm">No one is currently clocked in.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {live_punches.map((punch, i) => (
                      <div key={i} className={`relative overflow-hidden bg-white dark:bg-[#0a0a0a] border rounded-3xl p-5 transition-all duration-300 ${
                        punch.is_active ? "border-emerald-200 dark:border-emerald-900/50 shadow-md shadow-emerald-500/10" : "border-gray-200 dark:border-neutral-800 opacity-75"
                      }`}>
                        {punch.is_active && <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>}
                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div className="pr-2 min-w-0">
                            <p className="font-black text-base text-gray-900 dark:text-white leading-tight mb-0.5 truncate">{punch.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase font-black tracking-widest truncate">{punch.role}</p>
                          </div>
                          {punch.is_active
                            ? <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-1 rounded-lg shrink-0"><UserCheck size={12}/> Active</span>
                            : <span className="text-[10px] font-black text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-900 px-2 py-1 rounded-lg shrink-0">Off Duty</span>
                          }
                        </div>
                        <div className="space-y-2.5 text-xs relative z-10">
                          <div className="flex justify-between items-center bg-gray-50 dark:bg-neutral-900/50 p-2 rounded-xl">
                            <span className="text-gray-500 dark:text-neutral-400 font-bold ml-1">First In</span>
                            <span className="font-mono font-black text-gray-900 dark:text-white mr-1">{punch.first_punch ? new Date(punch.first_punch).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                          </div>
                          {punch.is_active && punch.last_punch && (
                            <div className="flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/10 p-2 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                              <span className="text-emerald-700 dark:text-emerald-500 font-bold ml-1">Session</span>
                              <LiveTimer punchTime={punch.last_punch} />
                            </div>
                          )}
                          <div className="flex justify-between items-center px-2 pt-1">
                            <span className="text-gray-500 dark:text-neutral-400 font-bold">Total Today</span>
                            <span className="font-mono font-black text-gray-900 dark:text-white text-sm">{formatDuration(punch.total_seconds)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Branch System History Timeline */}
            <div className="xl:col-span-1 space-y-4">
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 px-1">
                <History size={16} className="text-blue-500" /> Branch Feed
              </h3>
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm relative overflow-hidden h-[500px]">
                <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                  {branchLogs.length === 0 ? (
                    <div className="text-center text-gray-400 font-bold mt-20 text-sm">No recent activity.</div>
                  ) : (
                    <div className="relative pl-3 md:pl-4 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6">
                      {branchLogs.map((log) => {
                        let colorClass = "bg-gray-100 dark:bg-neutral-800 ring-white dark:ring-[#0a0a0a]";
                        if (log.action_type.includes("LOGIN")) colorClass = "bg-blue-500 ring-white dark:ring-[#0a0a0a]";
                        if (log.action_type.includes("ATTENDANCE") || log.action_type.includes("PUNCH")) colorClass = "bg-purple-500 ring-white dark:ring-[#0a0a0a]";
                        if (log.action_type.includes("ADVANCE") || log.action_type.includes("SALARY")) colorClass = "bg-orange-500 ring-white dark:ring-[#0a0a0a]";

                        return (
                          <div key={log.id} className="relative group">
                            <div className={`absolute -left-[19px] md:-left-[23px] top-1 w-3 h-3 rounded-full ring-4 ${colorClass}`} />
                            <div className="pl-2">
                              <p className="text-xs font-medium text-gray-800 dark:text-neutral-200 leading-snug">{log.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 tabular-nums">
                                  {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {log.actor_name && <span className="text-[10px] font-bold text-blue-500 truncate max-w-[120px]">· {log.actor_name}</span>}
                              </div>
                            </div>
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

        {/* ════════════════════════════════════════════════════════════════
            TAB: PERSONNEL
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "personnel" && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center px-1">
               <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                 <Users size={16} className="text-blue-500" /> Active Roster
               </h2>
              <button
                onClick={() => { setIsModalOpen(true); setFormData(blankForm); }}
                className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-500/20 text-xs md:text-sm"
              >
                <Plus size={16} strokeWidth={3} /> <span className="hidden sm:inline">Add Employee</span><span className="sm:hidden">Add</span>
              </button>
            </div>

            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="w-full overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <th className="p-4 md:p-5 sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-sm z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.2)]">Employee</th>
                      <th className="p-4 md:p-5">Mobile</th>
                      <th className="p-4 md:p-5 text-right">Fixed Salary</th>
                      <th className="p-4 md:p-5 text-center">Leave Cap</th>
                      <th className="p-4 md:p-5 text-center">Shift Target</th>
                      <th className="p-4 md:p-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                    {staff.length === 0 && (
                      <tr><td colSpan={6} className="p-10 text-center text-gray-400 font-bold text-sm">No personnel in this branch.</td></tr>
                    )}
                    {staff.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                        <td className="p-4 md:p-5 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50 dark:group-hover:bg-[#111] z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.2)] transition-colors">
                          <p className="font-black text-sm text-gray-900 dark:text-white mb-0.5">{user.name}</p>
                          <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${user.role === "manager" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400" : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"}`}>{user.role}</span>
                        </td>
                        <td className="p-4 md:p-5 font-mono text-xs font-bold text-gray-500">{user.mobile_number}</td>
                        <td className="p-4 md:p-5 text-right font-mono font-black text-sm text-gray-900 dark:text-white">₹{parseFloat(user.monthly_fixed_salary).toLocaleString("en-IN")}</td>
                        <td className="p-4 md:p-5 text-center font-mono font-black text-sm text-gray-600 dark:text-neutral-300">{user.max_paid_leaves ?? user.paid_leaves}</td>
                        <td className="p-4 md:p-5 text-center text-sm font-black text-gray-600 dark:text-neutral-300">{user.standard_shift_hours}h</td>
                        <td className="p-4 md:p-5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(user)} className="p-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-colors"><Edit2 size={16} /></button>
                            <button onClick={() => setAdvTarget(user)} className="p-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-orange-50 text-gray-400 hover:text-orange-600 rounded-xl transition-colors"><DollarSign size={16} /></button>
                            <button onClick={() => setDeleteTarget(user)} className="p-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-colors"><Trash2 size={16} /></button>
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

        {/* ── Month/Year picker for Attendance & Payroll ──────────────── */}
        {(activeTab === "attendance" || activeTab === "payroll") && (
          <div className="flex flex-wrap gap-2.5 items-center animate-in fade-in duration-300 bg-white dark:bg-[#0a0a0a] p-2.5 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm w-fit mx-1">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2">
              <Calendar size={14} className="text-emerald-500" />
              <select value={finMonth} onChange={e => setFinMonth(parseInt(e.target.value))} className="bg-transparent text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
                {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "long" })}</option>)}
              </select>
            </div>
            <select value={finYear} onChange={e => setFinYear(parseInt(e.target.value))} className="bg-gray-50 dark:bg-neutral-900 rounded-xl px-3 py-2 text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => activeTab === "attendance" ? loadAttendance() : loadPayroll()} className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-black rounded-xl hover:bg-gray-800 active:scale-95 transition-all">
              Load
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: ATTENDANCE LEDGER
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "attendance" && (
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#050505]/50">
              {[
                { marker: "P", label: "Present", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
                { marker: "H", label: "Half",    bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400" },
                { marker: "N", label: "Night",   bg: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
                { marker: "A", label: "Absent",  bg: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
                { marker: "W", label: "Off",     bg: "bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400" },
              ].map(l => (
                <div key={l.marker} className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-black ${l.bg}`}>{l.marker}</span>
                  <span className="text-[11px] font-bold text-gray-600 dark:text-neutral-400">{l.label}</span>
                </div>
              ))}
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
                      <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-sm z-20 border-r border-gray-200 dark:border-neutral-800 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">
                        Personnel
                      </th>
                      {[...Array(daysInMonth)].map((_, i) => {
                        const d = new Date(finYear, finMonth - 1, i + 1);
                        const isSun = d.getDay() === 0;
                        return (
                          <th key={i} className={`p-1.5 text-center min-w-[40px] border-r border-gray-100 dark:border-neutral-900 ${isSun ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                            <div className={`text-[8px] font-black uppercase mb-0.5 ${isSun ? "text-red-400" : "text-gray-400"}`}>{d.toLocaleDateString("en-IN", { weekday: "short" }).charAt(0)}</div>
                            <div className={`text-xs font-black ${isSun ? "text-red-600" : "text-gray-900 dark:text-white"}`}>{i + 1}</div>
                          </th>
                        );
                      })}
                      {["P", "H", "N", "A"].map(h => <th key={h} className="p-2 text-center text-[9px] font-black text-gray-400 uppercase min-w-[40px]">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                    {attendanceGrid.map((row, idx) => {
                      let totP = 0, totH = 0, totN = 0, totA = 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 group">
                          <td className="p-3 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/50 dark:group-hover:bg-[#111] z-10 border-r border-gray-200 dark:border-neutral-800 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">
                            <p className="font-black text-xs text-gray-900 dark:text-white whitespace-nowrap">{row.name}</p>
                          </td>
                          {[...Array(daysInMonth)].map((_, i) => {
                            const dateStr = `${finYear}-${pad(finMonth)}-${pad(i + 1)}`;
                            const status = row.days?.[dateStr] || "-";
                            const isSun = new Date(finYear, finMonth - 1, i + 1).getDay() === 0;
                            if (status === "P") totP++; if (status === "H") totH++; if (status === "N") totN++; if (status === "A") totA++;
                            return <td key={i} className={`p-1 text-center border-r border-gray-100 dark:border-neutral-900 ${isSun ? "bg-red-50/20 dark:bg-red-900/5" : ""}`}><AttendanceMarker status={status} /></td>;
                          })}
                          <td className="p-2 text-center font-mono font-black text-xs text-emerald-600">{totP}</td>
                          <td className="p-2 text-center font-mono font-black text-xs text-yellow-600">{totH}</td>
                          <td className="p-2 text-center font-mono font-black text-xs text-blue-600">{totN}</td>
                          <td className="p-2 text-center font-mono font-black text-xs text-red-500">{totA}</td>
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
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
              {isSubLoading ? (
                <div className="flex justify-center py-24"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>
              ) : payrollData.length === 0 ? (
                <div className="p-12 text-center text-gray-400 font-bold text-sm">No payroll data calculated.</div>
              ) : (
                <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-200 dark:border-neutral-800 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                        <th className="p-4 sticky left-0 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-sm z-20 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">Personnel</th>
                        <th className="p-4 text-right">Fixed Salary</th>
                        <th className="p-4 text-center">Duty</th>
                        <th className="p-4 text-right text-red-400">Pre Adv</th>
                        <th className="p-4 text-right text-red-400">Final Adv</th>
                        <th className="p-4 text-right text-orange-400">Shop Adv</th>
                        <th className="p-4 text-right text-orange-400">Shop Bill</th>
                        <th className="p-4 text-right text-red-400">Deduct</th>
                        <th className="p-4 text-right bg-emerald-50/80 dark:bg-emerald-900/10 text-emerald-700">Net Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                      {payrollData.map((row) => {
                        const { paidHolidays, totalPaidDays } = calcNetPay(row, daysInMonth);
                        return (
                          <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 group">
                            <td className="p-4 sticky left-0 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/50 dark:group-hover:bg-[#111] z-10 border-r border-gray-100 dark:border-neutral-900 shadow-[2px_0_8px_rgba(0,0,0,0.05)]">
                              <p className="font-black text-xs md:text-sm text-gray-900 dark:text-white whitespace-nowrap">{row.name}</p>
                              <button onClick={() => setSalaryBreakdownUser({ staff: row, daysInMonth })} className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline mt-0.5">View Formula</button>
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-xs">₹{parseFloat(row.monthly_fixed_salary).toLocaleString("en-IN")}</td>
                            <td className="p-4 text-center">
                              <span className="font-mono font-black text-xs text-emerald-600">{row.days_worked}</span>
                              <span className="text-gray-400 mx-1">+</span>
                              <span className="font-mono font-black text-xs text-blue-500">{paidHolidays}</span>
                              <span className="text-gray-400 mx-1">=</span>
                              <span className="font-mono font-black text-xs text-gray-900 dark:text-white">{totalPaidDays}</span>
                            </td>
                            {/* Clickable Transaction Columns */}
                            {["pre_advance", "final_advance", "shop_advance", "shop_bill", "deduction"].map(col => {
                              const val = parseFloat(row[col]);
                              const isRed = col.includes("advance") || col === "deduction";
                              return (
                                <td key={col} className="p-4 text-right">
                                  {val > 0 ? (
                                    <button 
                                      onClick={() => openTransactionHistory(row, col, col.replace("_", " ").toUpperCase())}
                                      className={`font-mono text-xs font-bold hover:underline ${isRed ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}
                                    >
                                      ₹{val.toLocaleString("en-IN")}
                                    </button>
                                  ) : <span className="font-mono text-xs text-gray-300 dark:text-neutral-700">—</span>}
                                </td>
                              );
                            })}
                            <td className="p-4 text-right bg-emerald-50/50 dark:bg-emerald-900/10 border-l border-emerald-100 dark:border-emerald-900/30">
                              <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-400">
                                ₹{parseFloat(calcNetPay(row, daysInMonth).net).toLocaleString("en-IN")}
                              </span>
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
          MODAL: ADD EMPLOYEE (Centered / Slide-up)
      ══════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-3xl max-h-[90dvh] overflow-y-auto custom-scrollbar rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300">
            <div className="sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center z-20">
              <h2 className="text-lg font-black flex items-center gap-2"><Shield size={16} className="text-emerald-500" /> Add Employee</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-full"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 md:p-8 space-y-8 pb-safe">
              {/* Identity */}
              <section>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Full Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Mobile No.</label>
                    <input type="tel" value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Password</label>
                    <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">System Role</label>
                    <div className="relative">
                      <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 appearance-none">
                        <option value="staff">Staff / Floor Worker</option>
                        <option value="manager">Branch Manager</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Finance */}
              <section className="border-t border-gray-100 dark:border-neutral-900 pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Monthly Salary (₹)</label>
                    <input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} className="w-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-xl px-4 py-3 text-sm font-black font-mono text-blue-700 dark:text-blue-400 outline-none focus:border-blue-500" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Leave Cap</label>
                    <select value={formData.max_paid_leaves} onChange={e => setFormData({...formData, max_paid_leaves: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-blue-500">
                      <option value={4}>4 (Tier-A)</option>
                      <option value={2}>2 (Tier-B)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Shift Hours</label>
                    <input type="number" step="0.5" value={formData.shift_hours} onChange={e => setFormData({...formData, shift_hours: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-3 py-3 text-sm font-bold font-mono outline-none focus:border-blue-500" />
                  </div>
                </div>
              </section>

              {/* Permissions */}
              <section className="border-t border-gray-100 dark:border-neutral-900 pt-6 pb-4">
                <div className="space-y-4">
                  {ALL_PERMISSIONS.map(cat => (
                    <div key={cat.category} className="bg-gray-50/50 dark:bg-[#111]/50 p-3.5 rounded-2xl border border-gray-100 dark:border-neutral-900">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">{cat.category}</p>
                      <div className="space-y-1.5">
                        {cat.items.map(perm => {
                          const cur = formData.permissions[perm.id] || { read: false, write: false };
                          return (
                            <div key={perm.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border transition-all ${cur.read || cur.write ? "bg-white dark:bg-black border-purple-200 shadow-sm" : "bg-transparent border-transparent"}`}>
                              <span className={`text-[11px] font-bold ${cur.read || cur.write ? "text-purple-900 dark:text-purple-300" : "text-gray-600 dark:text-neutral-400"}`}>{perm.label}</span>
                              <div className="flex gap-2 bg-gray-100 dark:bg-neutral-900 p-1 rounded-lg w-fit">
                                {perm.read && (
                                  <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-bold uppercase px-3 py-1.5 rounded-md ${cur.read ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500"}`}>
                                    <input type="checkbox" className="hidden" checked={cur.read} onChange={() => togglePerm(perm.id, "read")} /> Read
                                  </label>
                                )}
                                {perm.write && (
                                  <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-bold uppercase px-3 py-1.5 rounded-md ${cur.write ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500"}`}>
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

              <div className="pt-2 sticky bottom-0 bg-white dark:bg-[#0a0a0a] pb-safe z-10">
                <button type="submit" disabled={isSubmitting} className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Establish Personnel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: EDIT EMPLOYEE (Drawer on Mobile)
      ══════════════════════════════════════════════════════════════════ */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-3xl max-h-[90dvh] overflow-y-auto custom-scrollbar rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300">
            <div className="sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center z-20">
              <h2 className="text-lg font-black flex items-center gap-2"><Edit2 size={16} className="text-blue-500" /> Edit Details</h2>
              <button onClick={() => setEditTarget(null)} className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-full"><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 md:p-8 space-y-6 pb-safe">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Full Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Mobile No.</label>
                  <input type="tel" value={editForm.mobile_number} onChange={e => setEditForm({...editForm, mobile_number: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono outline-none focus:border-blue-500" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">System Role</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Salary (₹)</label>
                  <input type="number" value={editForm.salary} onChange={e => setEditForm({...editForm, salary: e.target.value})} className="w-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-xl px-4 py-3 text-sm font-black font-mono text-blue-600 outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Leave Cap</label>
                  <select value={editForm.max_paid_leaves} onChange={e => setEditForm({...editForm, max_paid_leaves: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500">
                    <option value={4}>4 (Tier-A)</option>
                    <option value={2}>2 (Tier-B)</option>
                  </select>
                </div>
              </div>

              {/* Permissions */}
              <div className="border-t border-gray-100 dark:border-neutral-900 pt-6 pb-4">
                <div className="space-y-4">
                  {ALL_PERMISSIONS.map(cat => (
                    <div key={cat.category} className="bg-gray-50/50 dark:bg-[#111]/50 p-3.5 rounded-2xl border border-gray-100 dark:border-neutral-900">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">{cat.category}</p>
                      <div className="space-y-1.5">
                        {cat.items.map(perm => {
                          const cur = editForm.permissions?.[perm.id] || { read: false, write: false };
                          const toggleEdit = (mode) => setEditForm(prev => ({
                            ...prev, permissions: { ...prev.permissions, [perm.id]: { ...cur, [mode]: !cur[mode] } }
                          }));
                          return (
                            <div key={perm.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border transition-all ${cur.read || cur.write ? "bg-white dark:bg-black border-purple-200 shadow-sm" : "bg-transparent border-transparent"}`}>
                              <span className={`text-[11px] font-bold ${cur.read || cur.write ? "text-purple-900 dark:text-purple-300" : "text-gray-600 dark:text-neutral-400"}`}>{perm.label}</span>
                              <div className="flex gap-2 bg-gray-100 dark:bg-neutral-900 p-1 rounded-lg w-fit">
                                {perm.read && <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-bold uppercase px-3 py-1.5 rounded-md ${cur.read ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500"}`}><input type="checkbox" className="hidden" checked={cur.read}  onChange={() => toggleEdit("read")}  /> Read</label>}
                                {perm.write && <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-bold uppercase px-3 py-1.5 rounded-md ${cur.write ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500"}`}><input type="checkbox" className="hidden" checked={cur.write} onChange={() => toggleEdit("write")} /> Write</label>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 sticky bottom-0 bg-white dark:bg-[#0a0a0a] pb-safe z-10">
                <button type="submit" disabled={editSubmitting} className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50">
                  {editSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: LOG ADVANCE
      ══════════════════════════════════════════════════════════════════ */}
      {advTarget && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/20 rounded-t-3xl">
              <h2 className="text-base font-black flex items-center gap-2"><DollarSign size={18} className="text-orange-500" /> Log Transaction</h2>
              <button onClick={() => setAdvTarget(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full"><X size={16} /></button>
            </div>
            <form onSubmit={handleAdvanceSubmit} className="p-6 space-y-5 pb-safe">
              <div className="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded-2xl flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-white dark:bg-black border border-gray-200 flex items-center justify-center font-black text-gray-600">{advTarget.name.charAt(0)}</div>
                 <div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase">Logging for</p>
                   <p className="text-sm font-black text-gray-900 dark:text-white">{advTarget.name}</p>
                 </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Transaction Type</label>
                <select value={advForm.type} onChange={e => setAdvForm({...advForm, type: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold outline-none focus:border-orange-500">
                  <option value="pre_advance">Pre Advance</option>
                  <option value="final_advance">Final Advance</option>
                  <option value="shop_advance">Shop Advance</option>
                  <option value="shop_bill">Shop Bill</option>
                  <option value="deduction">Deduction / Fine</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Amount (₹)</label>
                <input type="number" min="1" value={advForm.amount} onChange={e => setAdvForm({...advForm, amount: e.target.value})} className="w-full bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/50 rounded-xl px-4 py-3.5 text-base font-black font-mono text-orange-600 outline-none focus:border-orange-500" required placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Remarks</label>
                <textarea value={advForm.remarks} onChange={e => setAdvForm({...advForm, remarks: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500 resize-none h-20" placeholder="Optional note..." />
              </div>
              <button type="submit" disabled={advSubmitting} className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50">
                {advSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Log Transaction"}
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
              <h2 className="text-sm font-black flex items-center gap-2"><Banknote size={16} className="text-emerald-500" /> Salary Breakdown</h2>
              <button onClick={() => setSalaryBreakdownUser(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full"><X size={16} /></button>
            </div>
            <div className="p-6">
              <p className="font-black text-gray-900 dark:text-white mb-4">{salaryBreakdownUser.staff.name}</p>
              <div className="space-y-3 font-mono text-xs">
                {(() => {
                  const { net, perDay, paidHolidays, totalPaidDays, gross, totalAdv } = calcNetPay(salaryBreakdownUser.staff, salaryBreakdownUser.daysInMonth);
                  return (
                    <>
                      <div className="flex justify-between text-gray-500"><span>Fixed Salary</span><span className="font-bold text-gray-900 dark:text-white">₹{parseFloat(salaryBreakdownUser.staff.monthly_fixed_salary).toLocaleString("en-IN")}</span></div>
                      <div className="flex justify-between text-gray-500"><span>Days in Month</span><span className="font-bold text-gray-900 dark:text-white">{salaryBreakdownUser.daysInMonth}</span></div>
                      <div className="flex justify-between text-gray-500 border-t border-dashed border-gray-200 dark:border-neutral-800 pt-2"><span>Per-Day Rate</span><span className="font-bold text-gray-900 dark:text-white">₹{perDay}</span></div>
                      <div className="flex justify-between text-gray-600 dark:text-neutral-400"><span>Days Present</span><span className="font-bold text-emerald-600">{salaryBreakdownUser.staff.days_worked}</span></div>
                      <div className="flex justify-between text-gray-600 dark:text-neutral-400"><span>Paid Holidays (Cap {salaryBreakdownUser.staff.max_paid_leaves})</span><span className="font-bold text-blue-600">+{paidHolidays}</span></div>
                      <div className="flex justify-between font-bold text-gray-800 dark:text-neutral-200 border-t border-dashed border-gray-200 dark:border-neutral-800 pt-2"><span>Total Paid Days</span><span>{totalPaidDays}</span></div>
                      <div className="flex justify-between font-bold text-gray-800 dark:text-neutral-200"><span>Gross (Rate × Days)</span><span>₹{parseFloat(gross).toLocaleString("en-IN")}</span></div>
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
              <h2 className="text-sm font-black flex items-center gap-2"><History size={16} className="text-orange-500" /> {transactionHistoryModal.label} History</h2>
              <button onClick={() => setTransactionHistoryModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full"><X size={16} /></button>
            </div>
            <div className="p-5 bg-gray-50 dark:bg-neutral-900/50 border-b border-gray-100 dark:border-neutral-900 shrink-0">
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
                        <span className="font-mono font-black text-orange-600 dark:text-orange-400">₹{parseFloat(txn.amount).toLocaleString("en-IN")}</span>
                        <span className="text-[10px] font-bold text-gray-400">{new Date(txn.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
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
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-2 text-red-500">
              <Trash2 size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">Remove {deleteTarget.name}?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 leading-relaxed">
              This action is <strong className="text-red-500">irreversible</strong>. Login access will be instantly revoked.
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleteSubmitting} className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-all shadow-lg active:scale-95 text-sm disabled:opacity-50">
                {deleteSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Yes, Remove"}
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
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Initializing Environment...</p>
      </div>
    }>
      <CommandRoomContent />
    </Suspense>
  );
}