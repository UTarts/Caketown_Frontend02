"use client";

import { useEffect, useMemo, useState } from "react";
import { callApi } from "@/lib/apiClient";
import {
  Users,
  UserPlus,
  Shield,
  Smartphone,
  MapPin,
  Loader2,
  Lock,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Building2,
  Banknote,
  Clock3,
  CalendarRange,
  RefreshCw,
  CheckSquare,
  Filter,
  DollarSign,
  UserCog,
  Briefcase,
  AlertCircle,
} from "lucide-react";

const ALL_PERMISSIONS = [
  {
    category: "Attendance",
    items: [
      { id: "view_live_attendance", label: "View Live Floor Status", read: true, write: false },
      { id: "view_attendance_history", label: "View Attendance History", read: true, write: false },
      { id: "edit_attendance", label: "Override / Edit Attendance", read: true, write: true },
      { id: "manage_terminal", label: "Manage Biometric Terminal", read: false, write: true },
      { id: "register_face", label: "Register Employee Face", read: false, write: true },
    ],
  },
  {
    category: "Payroll & Finance",
    items: [
      { id: "view_payroll", label: "View Payroll Data", read: true, write: false },
      { id: "edit_payroll", label: "Edit / Finalize Payroll", read: false, write: true },
      { id: "log_advance", label: "Log Advance / Pre-Advance", read: false, write: true },
      { id: "log_shop_bill", label: "Log Shop Bills", read: false, write: true },
      { id: "log_shop_advance", label: "Log Shop Advance", read: false, write: true },
      { id: "view_financial_history", label: "View Financial History", read: true, write: false },
      { id: "download_salary_slip", label: "Download Salary Slip", read: true, write: false },
    ],
  },
  {
    category: "Reports",
    items: [
      { id: "download_attendance_report", label: "Download Attendance Report", read: true, write: false },
      { id: "download_financial_report", label: "Download Financial Report", read: true, write: false },
      { id: "download_full_report", label: "Download Full Monthly Report", read: true, write: false },
    ],
  },
  {
    category: "Staff Management",
    items: [
      { id: "view_staff_list", label: "View Staff List", read: true, write: false },
      { id: "edit_staff", label: "Edit Staff Details", read: false, write: true },
      { id: "view_staff_profile", label: "View Own Profile", read: true, write: false },
    ],
  },
];

const blankForm = {
  branch_id: "",
  role: "staff",
  name: "",
  mobile_number: "",
  password: "",
  salary: "",
  paid_leaves: 4,
  max_paid_leaves: 4,
  shift_hours: 10,
  weekly_off_day: "Sunday",
  permissions: {},
};

function getRoleStyle(role) {
  switch (role) {
    case "admin":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
    case "manager":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
    default:
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800";
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

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const [modalMode, setModalMode] = useState("create");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [formData, setFormData] = useState(blankForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [usersRes, branchesRes] = await Promise.all([
      callApi("get_users"),
      callApi("get_branches"),
    ]);

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
    try {
      parsedPermissions =
        typeof user.feature_permissions === "string"
          ? JSON.parse(user.feature_permissions || "{}")
          : user.feature_permissions || {};
    } catch {
      parsedPermissions = {};
    }

    setModalMode("edit");
    setFormData({
      branch_id: user.branch_id ? String(user.branch_id) : "",
      role: user.role || "staff",
      name: user.name || "",
      mobile_number: user.mobile_number || "",
      password: "",
      salary: user.monthly_fixed_salary ?? user.salary ?? "",
      paid_leaves: user.paid_leaves ?? 4,
      max_paid_leaves: user.max_paid_leaves ?? user.paid_leaves ?? 4,
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
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [permId]: {
            ...current,
            [mode]: !current[mode],
          },
        },
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.role !== "admin" && !formData.branch_id) {
      alert("Please select a branch.");
      return;
    }

    if (modalMode === "create" && !formData.password) {
      alert("Password is required for a new employee.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      ...formData,
      branch_id: formData.role === "admin" ? "" : formData.branch_id,
    };

    const res =
      modalMode === "create"
        ? await callApi("create_user", payload)
        : await callApi("update_user", payload);

    if (res.status === "success") {
      setIsModalOpen(false);
      setFormData(blankForm);
      fetchData();
    } else {
      alert(res.message || "Something went wrong.");
    }

    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);

    const res = await callApi("delete_user", { user_id: deleteTarget.id });

    if (res.status === "success") {
      setDeleteTarget(null);
      fetchData();
    } else {
      alert(res.message || "Failed to delete user.");
    }

    setDeleteSubmitting(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text = `${user.name || ""} ${user.mobile_number || ""} ${user.branch_name || ""}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());

      const matchesRole = roleFilter === "all" ? true : user.role === roleFilter;
      const matchesBranch =
        branchFilter === "all"
          ? true
          : String(user.branch_id || "") === String(branchFilter);

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
    <div className="text-gray-900 dark:text-neutral-200 font-sans">
      <div className="max-w-[1440px] mx-auto space-y-8">
        <div className="flex flex-col gap-2 border-b border-gray-200 dark:border-neutral-800 pb-6">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-500">
            <Users size={20} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase">
              Central Workforce Command
            </span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-black dark:text-white tracking-tight">
                Employee Management
              </h1>
              <p className="text-sm md:text-base text-gray-500 dark:text-neutral-500 max-w-3xl mt-2">
                View and control every employee across every branch. Create staff,
                promote managers, assign contracts, and define exact read/write
                permissions per feature.
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
            >
              <UserPlus size={18} />
              Add Employee
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Employees", value: stats.total, icon: Users, color: "text-black dark:text-white" },
            { label: "Admins", value: stats.admins, icon: Shield, color: "text-red-500" },
            { label: "Managers", value: stats.managers, icon: UserCog, color: "text-blue-500" },
            { label: "Staff", value: stats.staff, icon: Briefcase, color: "text-emerald-500" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {item.label}
                </p>
                <item.icon size={16} className="text-gray-400" />
              </div>
              <p className={`text-3xl font-black tabular-nums ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-neutral-400">
            <Filter size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Filters</span>
            <button
              onClick={fetchData}
              className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, mobile, or branch..."
                className="w-full bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="staff">Staff</option>
            </select>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={30} className="animate-spin text-emerald-500" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Users size={32} className="mb-3 opacity-40" />
              <p className="font-bold">No employees matched your filters.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1220px] text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="p-4">Employee</th>
                    <th className="p-4">Branch</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Mobile</th>
                    <th className="p-4 text-right">Salary</th>
                    <th className="p-4 text-center">Paid Leaves</th>
                    <th className="p-4 text-center">Leave Cap</th>
                    <th className="p-4 text-center">Shift</th>
                    <th className="p-4 text-right">30% Advance</th>
                    <th className="p-4 text-center">Permissions</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                  {filteredUsers.map((user) => {
                    let parsedPermissions = {};
                    try {
                      parsedPermissions =
                        typeof user.feature_permissions === "string"
                          ? JSON.parse(user.feature_permissions || "{}")
                          : user.feature_permissions || {};
                    } catch {
                      parsedPermissions = {};
                    }

                    const salary = parseFloat(
                      user.monthly_fixed_salary ?? user.salary ?? 0
                    );
                    const maxAdvance = salary * 0.3;

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/60 transition-colors"
                      >
                        <td className="p-4">
                          <div>
                            <p className="font-bold text-sm text-black dark:text-white">
                              {user.name}
                            </p>
                            <p className="text-[10px] font-mono text-gray-400 mt-1">
                              ID #{String(user.id).padStart(4, "0")}
                            </p>
                          </div>
                        </td>

                        <td className="p-4 text-sm font-medium text-gray-600 dark:text-neutral-400">
                          {user.role === "admin" ? "Global Access" : user.branch_name || "Unassigned"}
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2 py-1 text-[10px] font-bold border rounded-md uppercase tracking-widest ${getRoleStyle(
                              user.role
                            )}`}
                          >
                            {user.role}
                          </span>
                        </td>

                        <td className="p-4 font-mono text-sm text-gray-600 dark:text-neutral-400">
                          {user.mobile_number}
                        </td>

                        <td className="p-4 text-right font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                          ₹{salary.toLocaleString("en-IN")}
                        </td>

                        <td className="p-4 text-center font-mono font-bold">
                          {user.paid_leaves ?? 4}
                        </td>

                        <td className="p-4 text-center font-mono font-bold">
                          {user.max_paid_leaves ?? user.paid_leaves ?? 4}
                        </td>

                        <td className="p-4 text-center font-mono font-bold">
                          {user.standard_shift_hours ?? user.shift_hours ?? 10}h
                        </td>

                        <td className="p-4 text-right font-mono font-bold text-orange-600 dark:text-orange-400">
                          ₹{maxAdvance.toFixed(0)}
                        </td>

                        <td className="p-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                            {countGrantedPermissions(parsedPermissions)} enabled
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(user)}
                              className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                              title="Edit employee"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(user)}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                              title="Delete employee"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="w-full md:max-w-3xl max-h-[92dvh] overflow-y-auto custom-scrollbar bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-t-3xl md:rounded-3xl shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-800 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md">
              <h2 className="text-lg font-black flex items-center gap-2">
                {modalMode === "create" ? (
                  <>
                    <UserPlus size={18} className="text-emerald-500" />
                    Create Employee
                  </>
                ) : (
                  <>
                    <Edit2 size={18} className="text-blue-500" />
                    Edit Employee
                  </>
                )}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              <section>
                <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4">
                  Identity & Assignment
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Role
                    </label>
                    <div className="relative">
                      <Shield size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.role}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            role: e.target.value,
                            branch_id: e.target.value === "admin" ? "" : prev.branch_id,
                          }))
                        }
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-emerald-500 transition-colors appearance-none"
                      >
                        <option value="staff">Staff / Floor Worker</option>
                        <option value="manager">Branch Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Branch
                    </label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.branch_id}
                        onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                        disabled={formData.role === "admin"}
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-emerald-500 transition-colors appearance-none disabled:opacity-50"
                      >
                        <option value="">Select branch...</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.branch_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Full Name
                    </label>
                    <div className="relative">
                      <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"
                        placeholder="Full name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Smartphone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.mobile_number}
                        onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-mono font-bold outline-none focus:border-emerald-500 transition-colors"
                        placeholder="9876543210"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      {modalMode === "create" ? "Password" : "New Password (optional)"}
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-mono font-bold outline-none focus:border-emerald-500 transition-colors"
                        placeholder={modalMode === "create" ? "••••••••" : "Leave blank to keep current"}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-t border-gray-100 dark:border-neutral-900 pt-6">
                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Banknote size={14} />
                  Contract & Salary Rules
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Monthly Salary
                    </label>
                    <div className="relative">
                      <Banknote size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-mono font-bold text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 transition-colors"
                        placeholder="0"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Paid Leaves
                    </label>
                    <div className="relative">
                      <CalendarRange size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        max="31"
                        value={formData.paid_leaves}
                        onChange={(e) => setFormData({ ...formData, paid_leaves: Number(e.target.value) })}
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-mono font-bold outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Leave Cap Rule
                    </label>
                    <select
                      value={formData.max_paid_leaves}
                      onChange={(e) => setFormData({ ...formData, max_paid_leaves: Number(e.target.value) })}
                      className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value={4}>4 Max Holidays</option>
                      <option value={2}>2 Max Holidays</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Shift Hours
                    </label>
                    <div className="relative">
                      <Clock3 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={formData.shift_hours}
                        onChange={(e) => setFormData({ ...formData, shift_hours: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-mono font-bold outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Weekly Off Day
                    </label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.weekly_off_day}
                        onChange={(e) => setFormData({ ...formData, weekly_off_day: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-blue-500 transition-colors appearance-none"
                      >
                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-3 flex items-end">
                    <div className="w-full rounded-2xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-900/10 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1">
                        Advance Guardrail
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        Maximum allowed advance = 30% of salary
                      </p>
                      <p className="font-mono font-black text-2xl text-orange-600 dark:text-orange-400 mt-1">
                        ₹{((Number(formData.salary) || 0) * 0.3).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="border-t border-gray-100 dark:border-neutral-900 pt-6">
                <h3 className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CheckSquare size={14} />
                  Feature Permissions
                </h3>

                <div className="space-y-6">
                  {ALL_PERMISSIONS.map((group) => (
                    <div key={group.category}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                        {group.category}
                      </p>
                      <div className="space-y-2">
                        {group.items.map((perm) => {
                          const current = formData.permissions?.[perm.id] || {
                            read: false,
                            write: false,
                          };

                          return (
                            <div
                              key={perm.id}
                              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl border transition-colors ${
                                current.read || current.write
                                  ? "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800"
                                  : "bg-gray-50 dark:bg-neutral-950 border-gray-200 dark:border-neutral-800"
                              }`}
                            >
                              <span className="text-sm font-bold text-gray-700 dark:text-neutral-300">
                                {perm.label}
                              </span>

                              <div className="flex items-center gap-4">
                                {perm.read && (
                                  <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={current.read}
                                      onChange={() => togglePerm(perm.id, "read")}
                                      className="accent-purple-500"
                                    />
                                    Read
                                  </label>
                                )}

                                {perm.write && (
                                  <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={current.write}
                                      onChange={() => togglePerm(perm.id, "write")}
                                      className="accent-purple-500"
                                    />
                                    Write
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

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl disabled:opacity-50 active:scale-[0.98] ${
                  modalMode === "create"
                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                    : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20"
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : modalMode === "create" ? (
                  <>
                    <UserPlus size={18} />
                    Create Employee
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-900 rounded-3xl shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-black">Delete {deleteTarget.name}?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              This will remove login access for this employee. Historical records
              should remain in the system.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 bg-gray-100 dark:bg-neutral-900 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSubmitting}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
