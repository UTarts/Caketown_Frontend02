"use client";

import { useEffect, useMemo, useState } from "react";
import { callApi } from "@/lib/apiClient";
import {
  Users, UserPlus, Shield, Smartphone, MapPin, Loader2, Lock, Search, Edit2, 
  Trash2, X, Save, Building2, Banknote, Clock3, CalendarRange, RefreshCw, 
  CheckSquare, Filter, UserCog, Briefcase, AlertCircle, ChevronDown, CheckCircle2, Plus, UserX
} from "lucide-react";

// ─── FULL PERMISSIONS LIST ─────────────────────────────────────────────────
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
  { category: "Reports", items: [
    { id: "download_attendance_report", label: "Download Attendance Report", read: true, write: false },
    { id: "download_financial_report", label: "Download Financial Report", read: true, write: false },
    { id: "download_full_report", label: "Download Full Monthly Report", read: true, write: false },
  ]},
  { category: "Staff Management", items: [
    { id: "view_staff_list", label: "View Staff List", read: true, write: false },
    { id: "edit_staff", label: "Edit Staff Details", read: false, write: true },
    { id: "view_staff_profile", label: "View Own Profile", read: true, write: false },
  ]},
];

const blankForm = {
  branch_id: "", role: "staff", name: "", mobile_number: "", password: "",
  salary: "", paid_leaves: 4, max_paid_leaves: 4, shift_hours: 10, weekly_off_day: "Sunday", permissions: {},
};

function getRoleStyle(role) {
  switch (role) {
    case "admin":   return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400";
    case "manager": return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400";
    default:        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400";
  }
}

function countGrantedPermissions(permissions) {
  if (!permissions) return 0;
  return Object.values(permissions).filter((p) => p?.read || p?.write).length;
}

export default function EmployeeManagementPage() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  // Modals
  const [modalMode, setModalMode] = useState("create");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [formData, setFormData] = useState(blankForm);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [usersRes, branchesRes] = await Promise.all([callApi("get_users"), callApi("get_branches")]);
    if (usersRes.status === "success") setUsers(usersRes.data || []);
    if (branchesRes.status === "success") setBranches(branchesRes.data || []);
    setLoading(false);
  };

  const openCreateModal = () => {
    setModalMode("create");
    setFormData(blankForm);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    let parsedPermissions = {};
    try { parsedPermissions = typeof user.feature_permissions === "string" ? JSON.parse(user.feature_permissions || "{}") : user.feature_permissions || {}; } 
    catch { parsedPermissions = {}; }

    setModalMode("edit");
    setFormData({
      branch_id: user.branch_id ? String(user.branch_id) : "",
      role: user.role || "staff",
      name: user.name || "",
      mobile_number: user.mobile_number || "",
      password: "",
      salary: user.monthly_fixed_salary ?? user.salary ?? "",
      paid_leaves: user.paid_leaves ?? 4,
      max_paid_leaves: user.max_paid_leaves_cap ?? user.max_paid_leaves ?? 4,
      shift_hours: user.standard_shift_hours ?? user.shift_hours ?? 10,
      weekly_off_day: user.weekly_off_day || "Sunday",
      permissions: parsedPermissions,
      user_id: user.id,
    });
    setIsModalOpen(true);
  };

  const togglePerm = (permId, mode) => {
    setFormData((prev) => {
      const current = prev.permissions?.[permId] || { read: false, write: false };
      return { ...prev, permissions: { ...prev.permissions, [permId]: { ...current, [mode]: !current[mode] } } };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.role !== "admin" && !formData.branch_id) { alert("Please select a branch."); return; }
    if (modalMode === "create" && !formData.password) { alert("Password is required for a new employee."); return; }

    setIsSubmitting(true);
    const payload = { ...formData, branch_id: formData.role === "admin" ? "" : formData.branch_id };
    const res = modalMode === "create" ? await callApi("create_user", payload) : await callApi("update_user", payload);

    if (res.status === "success") { setIsModalOpen(false); setFormData(blankForm); fetchData(); } 
    else { alert(res.message || "Something went wrong."); }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    const res = await callApi("delete_user", { user_id: deleteTarget.id });
    if (res.status === "success") { setDeleteTarget(null); fetchData(); } 
    else { alert(res.message || "Failed to delete user."); }
    setDeleteSubmitting(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text = `${user.name || ""} ${user.mobile_number || ""} ${user.branch_name || ""}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" ? true : user.role === roleFilter;
      const matchesBranch = branchFilter === "all" ? true : String(user.branch_id || "") === String(branchFilter);
      return matchesSearch && matchesRole && matchesBranch;
    });
  }, [users, search, roleFilter, branchFilter]);

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    managers: users.filter((u) => u.role === "manager").length,
    staff: users.filter((u) => u.role === "staff").length,
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 w-full overflow-x-hidden">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mx-3 md:mx-0 mt-3 md:mt-0">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
            <Users size={12} className="shrink-0" />
            <span className="text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase truncate">Central Workforce Command</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            Personnel Directory
          </h1>
        </div>

        <button onClick={openCreateModal} className="w-full md:w-auto flex items-center justify-center p-3 md:px-6 md:py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 transition-all shrink-0 gap-2 active:scale-95">
          <UserPlus size={18} strokeWidth={2.5} /> Add Employee
        </button>
      </div>

      {/* ── STAT CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 px-3 md:px-0">
        {[
          { label: "Total Workforce", value: stats.total, icon: Users, color: "text-gray-900 dark:text-white" },
          { label: "System Admins", value: stats.admins, icon: Shield, color: "text-red-600 dark:text-red-400" },
          { label: "Branch Managers", value: stats.managers, icon: UserCog, color: "text-blue-600 dark:text-blue-400" },
          { label: "Floor Staff", value: stats.staff, icon: Briefcase, color: "text-emerald-600 dark:text-emerald-400" },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">{card.label}</p>
              <card.icon size={16} className="text-gray-400 opacity-50" />
            </div>
            <p className={`text-3xl md:text-4xl font-black tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── SMART FILTERS ──────────────────────────────────────────────── */}
      <div className="px-3 md:px-0">
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-4 md:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 dark:text-neutral-400">
              <Filter size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Directory Filters</span>
            </div>
            <button onClick={fetchData} className="p-2 rounded-xl bg-gray-50 dark:bg-neutral-900 hover:text-emerald-500 transition-colors" title="Sync Data">
              <RefreshCw size={16} className={loading ? "animate-spin text-emerald-500" : ""} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="sm:col-span-2 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, or branch..." className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
            </div>
            <div className="relative">
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer">
                <option value="all">All Roles</option>
                <option value="admin">System Admins</option>
                <option value="manager">Managers</option>
                <option value="staff">Floor Staff</option>
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer">
                <option value="all">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── EMPLOYEE CARD GRID (Replaced Table for Mobile Superiority) ── */}
      <div className="px-3 md:px-0 pb-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-emerald-500 mb-4" />
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Syncing Directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
            <UserX size={40} className="text-gray-300 dark:text-neutral-700 mb-4" />
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">No Personnel Found</h3>
            <p className="text-sm font-bold text-gray-500">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {filteredUsers.map((user) => {
              let parsedPerms = {};
              try { parsedPerms = typeof user.feature_permissions === "string" ? JSON.parse(user.feature_permissions) : user.feature_permissions; } catch {}
              const salary = parseFloat(user.monthly_fixed_salary ?? user.salary ?? 0);
              
              return (
                <div key={user.id} className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all flex flex-col h-full group">
                  
                  {/* Top: Identity */}
                  <div className="flex justify-between items-start mb-4 border-b border-gray-100 dark:border-neutral-900 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${getRoleStyle(user.role)}`}>
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black text-base text-gray-900 dark:text-white leading-tight mb-0.5">{user.name}</h3>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{user.role}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 bg-gray-100 dark:bg-neutral-900 rounded-lg text-[9px] font-black text-gray-500 tracking-widest uppercase">ID #{String(user.id).padStart(4, "0")}</span>
                    </div>
                  </div>

                  {/* Middle: Details */}
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs mb-5 flex-1">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Location</p>
                      <p className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" /> {user.role === 'admin' ? 'Global Access' : (user.branch_name || 'Unassigned')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Mobile</p>
                      <p className="font-mono font-bold text-gray-900 dark:text-white flex items-center gap-1.5"><Smartphone size={12} className="text-gray-400" /> {user.mobile_number}</p>
                    </div>
                    {user.role !== 'admin' && (
                      <>
                        <div className="col-span-2 mt-1 mb-1 border-t border-dashed border-gray-100 dark:border-neutral-900"></div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Fixed Salary</p>
                          <p className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">₹{salary.toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Shift Target</p>
                          <p className="font-mono font-bold text-gray-900 dark:text-white">{user.standard_shift_hours ?? 10}h / Day</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Bottom: Permissions & Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-neutral-900">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-500/10 rounded-lg">
                      <CheckSquare size={12} className="text-purple-500" />
                      <span className="text-[9px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">{countGrantedPermissions(parsedPerms)} Permissions</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEditModal(user)} className="p-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-colors">
                        <Edit2 size={16} strokeWidth={2.5} />
                      </button>
                      {user.role !== 'admin' && (
                        <button onClick={() => setDeleteTarget(user)} className="p-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors">
                          <Trash2 size={16} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ADD/EDIT EMPLOYEE (Drawer on Mobile)
      ══════════════════════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-4xl max-h-[90dvh] overflow-y-auto custom-scrollbar rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300">
            <div className="sticky top-0 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center z-20">
              <h2 className="text-lg font-black flex items-center gap-2">
                {modalMode === "create" ? <><UserPlus size={18} className="text-emerald-500" /> Establish Personnel</> : <><Edit2 size={18} className="text-blue-500" /> Edit Employee</>}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 dark:bg-neutral-900 rounded-full hover:text-gray-900 dark:hover:text-white transition-colors"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 md:p-8 space-y-8 pb-safe">
              
              {/* Identity */}
              <section>
                <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Identity & Assignment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">System Role</label>
                    <div className="relative">
                      <select value={formData.role} onChange={e => setFormData(prev => ({...prev, role: e.target.value, branch_id: e.target.value === "admin" ? "" : prev.branch_id}))} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none">
                        <option value="staff">Staff / Floor Worker</option>
                        <option value="manager">Branch Manager</option>
                        <option value="admin">System Admin (God Mode)</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Assigned Branch</label>
                    <div className="relative">
                      <select value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})} disabled={formData.role === "admin"} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none disabled:opacity-50">
                        <option value="">Select branch...</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Full Name</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/50" required placeholder="Full Name" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Mobile No.</label>
                    <input type="tel" value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500/50" required placeholder="9876543210" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{modalMode === "create" ? "Password" : "New Password (Optional)"}</label>
                    <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500/50" placeholder={modalMode === "create" ? "••••••••" : "Leave blank to keep"} required={modalMode === "create"} />
                  </div>
                </div>
              </section>

              {formData.role !== "admin" && (
                <section className="border-t border-gray-100 dark:border-neutral-900 pt-8">
                  <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Financial Contract</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-5">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Monthly Salary (₹)</label>
                      <input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} className="w-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-2xl px-4 py-3.5 text-base font-black font-mono text-blue-700 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/50" required placeholder="0.00" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Leave Cap</label>
                      <div className="relative">
                        <select value={formData.max_paid_leaves} onChange={e => setFormData({...formData, max_paid_leaves: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none">
                          <option value={4}>4 (Tier-A)</option>
                          <option value={2}>2 (Tier-B)</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Shift Target</label>
                      <input type="number" step="0.5" value={formData.shift_hours} onChange={e => setFormData({...formData, shift_hours: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-blue-500/50" />
                    </div>
                  </div>
                </section>
              )}

              {/* Permissions Grid */}
              <section className="border-t border-gray-100 dark:border-neutral-900 pt-8 pb-4">
                <h3 className="text-[11px] font-black text-purple-600 uppercase tracking-widest mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Access Guardrails</h3>
                {formData.role === "admin" ? (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/50 rounded-3xl p-6 text-center">
                    <Shield size={32} className="text-red-500 mx-auto mb-3" />
                    <p className="font-black text-red-700 dark:text-red-400 text-base mb-1">Global Override Active</p>
                    <p className="text-xs text-red-600 dark:text-red-400/80 font-bold">System Administrators implicitly bypass all feature restrictions. Granular permissions are ignored.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {ALL_PERMISSIONS.map(cat => (
                      <div key={cat.category} className="bg-gray-50/50 dark:bg-[#111]/50 p-4 rounded-3xl border border-gray-100 dark:border-neutral-900">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 pl-2">{cat.category}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {cat.items.map(perm => {
                            const cur = formData.permissions[perm.id] || { read: false, write: false };
                            return (
                              <div key={perm.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${cur.read || cur.write ? "bg-white dark:bg-black border-purple-200 dark:border-purple-800 shadow-sm" : "bg-transparent border-transparent hover:bg-gray-100 dark:hover:bg-neutral-900"}`}>
                                <span className={`text-[11px] font-bold ${cur.read || cur.write ? "text-purple-900 dark:text-purple-300" : "text-gray-600 dark:text-neutral-400"}`}>{perm.label}</span>
                                <div className="flex items-center gap-2 bg-gray-100 dark:bg-neutral-900 p-1 rounded-xl w-fit shrink-0">
                                  {perm.read && (
                                    <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${cur.read ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500"}`}>
                                      <input type="checkbox" className="hidden" checked={cur.read} onChange={() => togglePerm(perm.id, "read")} /> Read
                                    </label>
                                  )}
                                  {perm.write && (
                                    <label className={`flex items-center gap-1.5 cursor-pointer text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${cur.write ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500"}`}>
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
                )}
              </section>

              <div className="pt-4 sticky bottom-0 bg-white dark:bg-[#0a0a0a] pb-safe z-10">
                <button type="submit" disabled={isSubmitting} className={`w-full py-4 text-white text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 active:scale-[0.98] ${modalMode === "create" ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20"}`}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : modalMode === "create" ? <><Plus size={18} strokeWidth={3} /> Establish Personnel</> : <><Save size={18} strokeWidth={2.5} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: DELETE CONFIRM
      ══════════════════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-900/50 w-full max-w-sm rounded-3xl shadow-2xl p-6 md:p-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-2 text-red-500 border-4 border-red-100 dark:border-red-900/30">
              <AlertCircle size={32} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">Remove {deleteTarget.name}?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 leading-relaxed">
              This action is <strong className="text-red-500">irreversible</strong>. Login access will be instantly revoked, though audit records remain intact.
            </p>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleteSubmitting} className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-all shadow-lg shadow-red-500/20 active:scale-95 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteSubmitting ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}