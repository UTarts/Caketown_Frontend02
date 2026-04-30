"use client";

import { useEffect, useMemo, useState } from "react";
import { callApi } from "@/lib/apiClient";
import {
  Building2,
  CalendarRange,
  ChevronDown,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const DEFAULT_BRANCH_FORM = {
  id: "",
  branch_name: "",
  branch_code: "",
  address_line_1: "",
  city: "",
  state: "Uttar Pradesh",
  is_active: 1,
};

const DEFAULT_RULE_FORM = {
  branch_id: "",
  leave_cap_type: "4",
  min_days_present: "",
  max_days_present: "",
  paid_holidays_awarded: "",
  sort_order: "",
};

function BranchModal({ open, onClose, onSubmit, form, setForm, saving, editing }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-900 shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-900 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-600 dark:text-emerald-400">
              Branch Management
            </p>
            <h2 className="text-xl font-black text-black dark:text-white">
              {editing ? "Edit Branch" : "Create Branch"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Branch Name
              </label>
              <input
                value={form.branch_name}
                onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
                placeholder="Cake Town Café Chowk"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Branch Code
              </label>
              <input
                value={form.branch_code}
                onChange={(e) => setForm({ ...form, branch_code: e.target.value.toUpperCase() })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
                placeholder="CHOWK"
                required
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Address
              </label>
              <input
                value={form.address_line_1}
                onChange={(e) => setForm({ ...form, address_line_1: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Full branch address"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                City
              </label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Prayagraj"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                State
              </label>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm outline-none focus:border-emerald-500"
                placeholder="Uttar Pradesh"
                required
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Status
              </label>
              <select
                value={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {editing ? "Update Branch" : "Create Branch"}
          </button>
        </form>
      </div>
    </div>
  );
}

function RuleModal({
  open,
  onClose,
  onSubmit,
  form,
  setForm,
  saving,
  editing,
  branches,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-900 shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-900 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-600 dark:text-blue-400">
              Leave Rules
            </p>
            <h2 className="text-xl font-black text-black dark:text-white">
              {editing ? "Edit Leave Rule" : "Add Leave Rule"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Branch
              </label>
              <select
                value={form.branch_id}
                onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                required
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Leave Cap Type
              </label>
              <select
                value={form.leave_cap_type}
                onChange={(e) => setForm({ ...form, leave_cap_type: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
                required
              >
                <option value="4">Cap 4 Paid Holidays</option>
                <option value="2">Cap 2 Paid Holidays</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Sort Order
              </label>
              <input
                type="number"
                min="1"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-mono font-bold outline-none focus:border-blue-500"
                placeholder="1"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Min Days Present
              </label>
              <input
                type="number"
                min="0"
                value={form.min_days_present}
                onChange={(e) => setForm({ ...form, min_days_present: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-mono font-bold outline-none focus:border-blue-500"
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Max Days Present
              </label>
              <input
                type="number"
                min="0"
                value={form.max_days_present}
                onChange={(e) => setForm({ ...form, max_days_present: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-mono font-bold outline-none focus:border-blue-500"
                placeholder="9"
                required
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Paid Holidays Awarded
              </label>
              <input
                type="number"
                min="0"
                value={form.paid_holidays_awarded}
                onChange={(e) => setForm({ ...form, paid_holidays_awarded: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-mono font-bold outline-none focus:border-blue-500"
                placeholder="0"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black py-3 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {editing ? "Update Leave Rule" : "Save Leave Rule"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [branches, setBranches] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("all");

  const [loading, setLoading] = useState(true);
  const [savingBranch, setSavingBranch] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [deletingBranchId, setDeletingBranchId] = useState(null);
  const [deletingRuleId, setDeletingRuleId] = useState(null);

  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);

  const [branchForm, setBranchForm] = useState(DEFAULT_BRANCH_FORM);
  const [ruleForm, setRuleForm] = useState(DEFAULT_RULE_FORM);

  const [editingBranch, setEditingBranch] = useState(null);
  const [editingRule, setEditingRule] = useState(null);

  const fetchSettingsData = async () => {
    setLoading(true);

    const [branchesRes, rulesRes] = await Promise.all([
      callApi("get_branches"),
      callApi("get_branch_leave_rules"),
    ]);

    if (branchesRes.status === "success") {
      setBranches(branchesRes.data || []);
    }

    if (rulesRes.status === "success") {
      setRules(rulesRes.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const filteredRules = useMemo(() => {
    if (selectedBranchId === "all") return rules;
    return rules.filter((rule) => String(rule.branch_id) === String(selectedBranchId));
  }, [rules, selectedBranchId]);

  const groupedRules = useMemo(() => {
    const groups = { "4": [], "2": [] };
    filteredRules.forEach((rule) => {
      const key = String(rule.leave_cap_type || rule.max_paid_leaves || "4");
      if (!groups[key]) groups[key] = [];
      groups[key].push(rule);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    });

    return groups;
  }, [filteredRules]);

  const openCreateBranch = () => {
    setEditingBranch(null);
    setBranchForm(DEFAULT_BRANCH_FORM);
    setBranchModalOpen(true);
  };

  const openEditBranch = (branch) => {
    setEditingBranch(branch);
    setBranchForm({
      id: branch.id || "",
      branch_name: branch.branch_name || "",
      branch_code: branch.branch_code || "",
      address_line_1: branch.address_line_1 || branch.address || "",
      city: branch.city || "",
      state: branch.state || "Uttar Pradesh",
      is_active: Number(branch.is_active ?? 1),
    });
    setBranchModalOpen(true);
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({
      ...DEFAULT_RULE_FORM,
      branch_id: selectedBranchId !== "all" ? String(selectedBranchId) : "",
      leave_cap_type: "4",
    });
    setRuleModalOpen(true);
  };

  const openEditRule = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      branch_id: String(rule.branch_id || ""),
      leave_cap_type: String(rule.leave_cap_type || rule.max_paid_leaves || "4"),
      min_days_present: String(rule.min_days_present ?? ""),
      max_days_present: String(rule.max_days_present ?? ""),
      paid_holidays_awarded: String(rule.paid_holidays_awarded ?? rule.paid_leaves_awarded ?? ""),
      sort_order: String(rule.sort_order ?? ""),
    });
    setRuleModalOpen(true);
  };

  const submitBranch = async (e) => {
    e.preventDefault();
    setSavingBranch(true);

    const payload = {
      ...branchForm,
      is_active: Number(branchForm.is_active),
    };

    const res = await callApi(editingBranch ? "update_branch" : "create_branch", payload);

    if (res.status === "success") {
      setBranchModalOpen(false);
      setBranchForm(DEFAULT_BRANCH_FORM);
      setEditingBranch(null);
      fetchSettingsData();
    } else {
      alert(res.message || "Unable to save branch.");
    }

    setSavingBranch(false);
  };

  const submitRule = async (e) => {
    e.preventDefault();
    setSavingRule(true);

    const payload = {
      ...(editingRule?.id ? { id: editingRule.id } : {}),
      branch_id: Number(ruleForm.branch_id),
      leave_cap_type: Number(ruleForm.leave_cap_type),
      min_days_present: Number(ruleForm.min_days_present),
      max_days_present: Number(ruleForm.max_days_present),
      paid_holidays_awarded: Number(ruleForm.paid_holidays_awarded),
      sort_order: Number(ruleForm.sort_order),
    };

    const res = await callApi(editingRule ? "update_branch_leave_rule" : "create_branch_leave_rule", payload);

    if (res.status === "success") {
      setRuleModalOpen(false);
      setRuleForm(DEFAULT_RULE_FORM);
      setEditingRule(null);
      fetchSettingsData();
    } else {
      alert(res.message || "Unable to save leave rule.");
    }

    setSavingRule(false);
  };

  const handleDeleteBranch = async (branch) => {
    const confirmed = window.confirm(
      `Delete branch "${branch.branch_name}"? This should only be allowed if your backend safely blocks deletion when employees or transactions exist.`
    );
    if (!confirmed) return;

    setDeletingBranchId(branch.id);
    const res = await callApi("delete_branch", { id: branch.id });

    if (res.status === "success") {
      fetchSettingsData();
    } else {
      alert(res.message || "Unable to delete branch.");
    }
    setDeletingBranchId(null);
  };

  const handleDeleteRule = async (rule) => {
    const confirmed = window.confirm("Delete this leave rule?");
    if (!confirmed) return;

    setDeletingRuleId(rule.id);
    const res = await callApi("delete_branch_leave_rule", { id: rule.id });

    if (res.status === "success") {
      fetchSettingsData();
    } else {
      alert(res.message || "Unable to delete leave rule.");
    }
    setDeletingRuleId(null);
  };

  return (
    <div className="text-gray-900 dark:text-neutral-200 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div className="border-b border-gray-200 dark:border-neutral-800 pb-6">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-500 mb-2">
            <Settings2 size={20} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase">
              Admin Settings
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-black dark:text-white tracking-tight">
            Branches & Leave Rules
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-neutral-500 max-w-4xl mt-2">
            Manage branch identities, branch activation, and the exact paid holiday rules used by payroll calculations for each branch.
          </p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: "Total Branches",
              value: branches.length,
              icon: Building2,
              color: "text-black dark:text-white",
            },
            {
              label: "Active Branches",
              value: branches.filter((b) => Number(b.is_active) === 1).length,
              icon: CheckCircle2,
              color: "text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Leave Rules",
              value: rules.length,
              icon: CalendarRange,
              color: "text-blue-600 dark:text-blue-400",
            },
            {
              label: "Needs Review",
              value: branches.filter((b) => !rules.some((r) => String(r.branch_id) === String(b.id))).length,
              icon: AlertTriangle,
              color: "text-orange-500",
            },
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
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <section className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-600 dark:text-emerald-400">
                  Branch Registry
                </p>
                <h2 className="text-lg font-black text-black dark:text-white mt-1">
                  All Branches
                </h2>
              </div>

              <button
                onClick={openCreateBranch}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black transition-colors"
              >
                <Plus size={16} />
                New Branch
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={30} className="animate-spin text-emerald-500" />
              </div>
            ) : branches.length === 0 ? (
              <div className="p-10 text-center text-gray-400">No branches found.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-900">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-[#0a0a0a] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-black dark:text-white">
                          {branch.branch_name}
                        </h3>
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-neutral-900 text-gray-500 uppercase">
                          {branch.branch_code || "No Code"}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            Number(branch.is_active) === 1
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                              : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300"
                          }`}
                        >
                          {Number(branch.is_active) === 1 ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col gap-1.5 text-sm text-gray-500">
                        <p className="inline-flex items-center gap-2">
                          <MapPin size={14} />
                          {branch.address_line_1 || branch.address || "No address"}
                        </p>
                        <p className="inline-flex items-center gap-2">
                          <Building2 size={14} />
                          {branch.city || "City"}, {branch.state || "State"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditBranch(branch)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-emerald-500 bg-white dark:bg-black text-sm font-bold transition-colors"
                      >
                        <Pencil size={15} />
                        Edit
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(branch)}
                        disabled={deletingBranchId === branch.id}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
                      >
                        {deletingBranchId === branch.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-600 dark:text-blue-400">
                  Payroll Leave Logic
                </p>
                <h2 className="text-lg font-black text-black dark:text-white mt-1">
                  Branch Leave Rules
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="appearance-none bg-gray-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl py-2.5 pl-4 pr-10 text-sm font-bold outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="all">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.branch_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>

                <button
                  onClick={openCreateRule}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-colors"
                >
                  <Plus size={16} />
                  Add Rule
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/10 p-4">
                <p className="text-xs font-black text-blue-700 dark:text-blue-300">
                  Recommended Configuration
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 leading-6">
                  Cap 4 example: 0–9 = 0, 10–13 = 1, 14–19 = 2, 20–23 = 3, 24+ = 4.
                  Cap 2 example: below 14 = 0, 14–23 = 1, 24+ = 2.
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin text-blue-500" />
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-800 p-8 text-center text-gray-400">
                  No leave rules found for the selected branch.
                </div>
              ) : (
                <div className="space-y-6">
                  {["4", "2"].map((capKey) => (
                    <div key={capKey} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck
                          size={16}
                          className={capKey === "4" ? "text-emerald-500" : "text-orange-500"}
                        />
                        <h3 className="text-sm font-black text-black dark:text-white">
                          Maximum {capKey} Paid Holidays
                        </h3>
                      </div>

                      {groupedRules[capKey]?.length ? (
                        <div className="space-y-3">
                          {groupedRules[capKey].map((rule) => {
                            const branch = branches.find(
                              (b) => String(b.id) === String(rule.branch_id)
                            );

                            return (
                              <div
                                key={rule.id}
                                className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black p-4"
                              >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-neutral-900 text-gray-500">
                                        {branch?.branch_name || "Unknown Branch"}
                                      </span>
                                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                                        Order {rule.sort_order}
                                      </span>
                                    </div>

                                    <p className="text-sm font-bold text-black dark:text-white">
                                      {rule.min_days_present} to {rule.max_days_present} duty days
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Award {rule.paid_holidays_awarded} paid holiday(s)
                                    </p>
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => openEditRule(rule)}
                                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-blue-500 bg-white dark:bg-black text-sm font-bold transition-colors"
                                    >
                                      <Pencil size={15} />
                                      Edit
                                    </button>

                                    <button
                                      onClick={() => handleDeleteRule(rule)}
                                      disabled={deletingRuleId === rule.id}
                                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
                                    >
                                      {deletingRuleId === rule.id ? (
                                        <Loader2 size={15} className="animate-spin" />
                                      ) : (
                                        <Trash2 size={15} />
                                      )}
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-800 p-5 text-sm text-gray-400">
                          No rules configured for cap {capKey}.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <BranchModal
        open={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
        onSubmit={submitBranch}
        form={branchForm}
        setForm={setBranchForm}
        saving={savingBranch}
        editing={!!editingBranch}
      />

      <RuleModal
        open={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        onSubmit={submitRule}
        form={ruleForm}
        setForm={setRuleForm}
        saving={savingRule}
        editing={!!editingRule}
        branches={branches}
      />
    </div>
  );
}
