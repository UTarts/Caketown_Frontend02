"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Building2, CalendarRange, ChevronDown, Loader2, Save, 
  Settings2, Plus, Trash2, ShieldCheck, MonitorSmartphone,
  CheckCircle2, XCircle, UserCog, Edit, KeyRound, MapPin, Users,
  Briefcase, X
} from "lucide-react";

const pad = (n, width = 2) => String(n).padStart(width, "0");

export default function AdminSettingsPage() {
  // FIXED: We now use standard Next.js hooks to safely track URL parameter changes
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("matrix");
  
  // -- MATRIX STATE --
  const [rules4, setRules4] = useState([]);
  const [rules2, setRules2] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving4, setSaving4] = useState(false);
  const [saving2, setSaving2] = useState(false);

  // -- BRANCH STATE --
  const [branches, setBranches] = useState([]);
  const [branchFormModal, setBranchFormModal] = useState(null); 
  const [branchSubmitting, setBranchSubmitting] = useState(false);

  // -- ADMIN STATE --
  const [admins, setAdmins] = useState([]);
  const [adminModal, setAdminModal] = useState(null); 

  // -- DEPARTMENTS & ROLES STATE --
  const [departments, setDepartments] = useState([]);
  const [deptModal, setDeptModal] = useState(null);
  const [deptSubmitting, setDeptSubmitting] = useState(false);
  
  const [newRoleName, setNewRoleName] = useState("");

  // ─── FIXED: DYNAMIC URL LISTENER ───
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
      // Silently clean the URL without triggering a page scroll or jump
      router.replace('/admin/settings', { scroll: false });
    }
  }, [searchParams, activeTab, router]);
  
  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) return;
    try { setSession(JSON.parse(raw)); } catch {}
  }, []);

  const fetchGlobals = useCallback(async () => {
    setLoading(true);
    const [bRes, uRes, dRes] = await Promise.all([
      callApi("get_branches"),
      callApi("get_users"),
      callApi("get_departments_roles")
    ]);
    
    if (bRes.status === "success") {
      setBranches(bRes.data || []);
    }
    
    if (uRes.status === "success") setAdmins((uRes.data || []).filter(u => u.role === 'admin'));
    
    if (dRes.status === "success") setDepartments(dRes.data || []);
    
    setLoading(false);
  }, []);

  useEffect(() => { fetchGlobals(); }, [fetchGlobals]);

  const fetchRules = useCallback(async () => {
    if (activeTab !== "matrix") return;
    setLoading(true);
    const res = await callApi("get_leave_rules");
    if (res.status === "success") {
      setRules4((res.data["4"] || []).map(r => ({ min: r.min_working_days, max: r.max_days_exclusive || "", awarded: r.earned_paid_leaves })));
      setRules2((res.data["2"] || []).map(r => ({ min: r.min_working_days, max: r.max_days_exclusive || "", awarded: r.earned_paid_leaves })));
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // ─── MATRIX HANDLERS ──────────────────────────────────────────────────
  const updateRule = (cap, index, field, value) => {
    const setter = cap === 4 ? setRules4 : setRules2;
    setter(prev => { const newRules = [...prev]; newRules[index][field] = value; return newRules; });
  };
  const addRuleRow = (cap) => (cap === 4 ? setRules4 : setRules2)(prev => [...prev, { min: "", max: "", awarded: "" }]);
  const removeRuleRow = (cap, index) => (cap === 4 ? setRules4 : setRules2)(prev => prev.filter((_, i) => i !== index));

  const saveRulesMatrix = async (cap) => {
    const rulesToSave = cap === 4 ? rules4 : rules2;
    const setSaving = cap === 4 ? setSaving4 : setSaving2;
    const formattedRules = rulesToSave.map(r => ({
      min_working_days: parseFloat(r.min) || 0,
      earned_paid_leaves: parseInt(r.awarded) || 0,
      max_days_exclusive: r.max === "" ? null : parseFloat(r.max)
    }));

    setSaving(true);
    const res = await callApi("save_leave_rules", { cap, rules: formattedRules, admin_id: session?.id });
    if (res.status === "success") fetchRules();
    else alert(res.message || `Failed to save Tier ${cap} rules.`);
    setSaving(false);
  };

  // ─── BRANCH HANDLERS ──────────────────────────────────────────────────
  const handleBranchSubmit = async (e) => {
    e.preventDefault();
    setBranchSubmitting(true);
    const action = branchFormModal.action === 'create' ? 'create_branch' : 'update_branch';
    const payload = { 
      branch_name: branchFormModal.name, 
      address: branchFormModal.address,
      status: branchFormModal.status,
      admin_id: session?.id 
    };
    if (branchFormModal.id) payload.id = branchFormModal.id;

    const res = await callApi(action, payload);
    setBranchSubmitting(false);
    if (res.status === "success") {
      setBranchFormModal(null);
      fetchGlobals();
    } else alert(res.message || "Operation failed.");
  };

  const deleteBranch = async (id) => {
    if (!confirm("Delete this branch permanently? All associated unassigned users might be affected.")) return;
    const res = await callApi("delete_branch", { branch_id: id, admin_id: session?.id });
    if (res.status === "success") fetchGlobals();
    else alert(res.message || "Failed to delete branch.");
  };

  // ─── ADMIN HANDLERS ───────────────────────────────────────────────────
  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (adminModal.action === 'create' && !adminModal.password) return alert("Password required for new admins.");
    
    setBranchSubmitting(true);
    const action = adminModal.action === 'create' ? 'create_user' : 'update_user';
    const payload = {
      role: 'admin',
      name: adminModal.name,
      mobile_number: adminModal.mobile,
      admin_id: session?.id
    };
    if (adminModal.password) payload.password = adminModal.password;
    if (adminModal.id) payload.user_id = adminModal.id;

    const res = await callApi(action, payload);
    setBranchSubmitting(false);
    if (res.status === "success") {
      setAdminModal(null);
      fetchGlobals();
    } else alert(res.message || "Operation failed.");
  };

  const toggleAdminStatus = async (user) => {
    if (!confirm(`Are you sure you want to ${user.status === 'active' ? 'deactivate' : 'activate'} this admin account?`)) return;
    const res = await callApi("deactivate_user", { user_id: user.id, admin_id: session?.id });
    if (res.status === "success") fetchGlobals();
    else alert(res.message || "Operation failed.");
  };

  // ─── DEPARTMENTS & ROLES HANDLERS ──────────────────────────────────────
  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    if (!deptModal.name.trim()) return alert("Department name is required.");
    if (deptModal.roles.length === 0) return alert("At least one role is required.");

    setDeptSubmitting(true);
    
    const action = deptModal.action === 'create' ? 'create_department' : 'update_department';
    const payload = {
      department_name: deptModal.name,
      roles: JSON.stringify(deptModal.roles),
      admin_id: session?.id
    };

    if (deptModal.action === 'edit' && deptModal.id) {
      payload.id = deptModal.id;
    }

    const res = await callApi(action, payload);
    
    if (res.status === "success") {
      setDeptModal(null);
      fetchGlobals();
    } else {
      alert(res.message || "Failed to save department.");
    }
    
    setDeptSubmitting(false);
  };

  const deleteDept = async (id) => {
    if (!confirm("Are you sure you want to delete this department? Users assigned to this department will not be deleted, but their department field may act unexpectedly.")) return;
    
    const res = await callApi("delete_department", { id, admin_id: session?.id });
    
    if (res.status === "success") {
      fetchGlobals();
    } else {
      alert(res.message || "Failed to delete department.");
    }
  };

  const addRoleToModal = () => {
    if (!newRoleName.trim()) return;
    setDeptModal(prev => ({ ...prev, roles: [...prev.roles, newRoleName.trim()] }));
    setNewRoleName(""); 
  };

  const removeRoleFromModal = (idx) => {
    setDeptModal(prev => ({ ...prev, roles: prev.roles.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-2rem)] gap-4 md:gap-5 animate-in fade-in duration-500 text-gray-900 dark:text-neutral-200 font-sans w-full min-w-0 max-w-full overflow-hidden">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-4 md:p-5 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm w-full shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-500 mb-1">
            <Settings2 size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Global Configuration</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            Master Settings Engine
          </h1>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl p-1 shadow-sm shrink-0">
            <button onClick={() => setActiveTab("branches")} className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'branches' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              <Building2 size={14} /> Branches
            </button>
            <button onClick={() => setActiveTab("departments")} className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'departments' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              <Briefcase size={14} /> Roles & Depts
            </button>
            <button onClick={() => setActiveTab("admins")} className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'admins' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              <ShieldCheck size={14} /> Administrators
            </button>
            <button onClick={() => setActiveTab("matrix")} className={`px-4 py-2.5 rounded-lg text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'matrix' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              <CalendarRange size={14} /> Leave Matrix
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar w-full">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 pb-10">
          
          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: LEAVE MATRIX
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "matrix" && (
            <div className="xl:col-span-3 space-y-6 max-w-4xl mx-auto w-full">
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm">
                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-2">
                  <MonitorSmartphone size={16} className="text-indigo-500" /> Global Environment
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400 font-medium leading-relaxed">
                  These algorithmic bounds for paid holiday accrual will apply uniformly across all active branches.
                </p>
              </div>

              {loading ? (
                 <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-16 flex flex-col items-center justify-center">
                   <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
                   <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Loading Matrix...</p>
                 </div>
              ) : (
                <>
                  <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
                    <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 bg-emerald-50/30 dark:bg-emerald-900/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={16} /> Tier-A Configuration</h3>
                        <p className="text-[10px] text-gray-500 dark:text-neutral-400 mt-1 font-bold uppercase tracking-widest">Matrix for max cap 4 leaves.</p>
                      </div>
                      <button onClick={() => addRuleRow(4)} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-neutral-900 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-gray-700 dark:text-neutral-300 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-black rounded-xl transition-colors shrink-0"><Plus size={14} strokeWidth={3} /> Add Row</button>
                    </div>
                    <div className="w-full overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[500px]">
                        <thead>
                          <tr className="bg-gray-50/50 dark:bg-[#111] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <th className="p-4 w-1/3">Min. Days (≥)</th>
                            <th className="p-4 w-1/3">Max. Days (&lt;)</th>
                            <th className="p-4 w-1/4 text-center">Earned</th>
                            <th className="p-4 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                          {rules4.map((rule, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                              <td className="p-2 border-r border-gray-100 dark:border-neutral-900"><input type="number" step="0.1" value={rule.min} onChange={(e) => updateRule(4, idx, 'min', e.target.value)} placeholder="0" className="w-full bg-transparent p-2 text-sm font-mono font-black text-gray-900 dark:text-white outline-none focus:bg-emerald-50 dark:focus:bg-emerald-900/20 rounded-lg transition-colors" /></td>
                              <td className="p-2 border-r border-gray-100 dark:border-neutral-900"><input type="number" step="0.1" value={rule.max} onChange={(e) => updateRule(4, idx, 'max', e.target.value)} placeholder="Infinity" className="w-full bg-transparent p-2 text-sm font-mono font-black text-gray-900 dark:text-white outline-none focus:bg-emerald-50 dark:focus:bg-emerald-900/20 rounded-lg transition-colors" /></td>
                              <td className="p-2 border-r border-gray-100 dark:border-neutral-900"><input type="number" value={rule.awarded} onChange={(e) => updateRule(4, idx, 'awarded', e.target.value)} placeholder="0" className="w-full text-center bg-transparent p-2 text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none focus:bg-emerald-50 dark:focus:bg-emerald-900/20 rounded-lg transition-colors" /></td>
                              <td className="p-2 text-center"><button onClick={() => removeRuleRow(4, idx)} className="p-2 text-gray-300 dark:text-neutral-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button></td>
                            </tr>
                          ))}
                          {rules4.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm font-bold text-gray-400">No rules defined.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111]">
                      <button onClick={() => saveRulesMatrix(4)} disabled={saving4} className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-[0.98]">
                        {saving4 ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} strokeWidth={2.5} />} Save Tier-A Matrix
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
                    <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 bg-blue-50/30 dark:bg-blue-900/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={16} /> Tier-B Configuration</h3>
                        <p className="text-[10px] text-gray-500 dark:text-neutral-400 mt-1 font-bold uppercase tracking-widest">Matrix for max cap 2 leaves.</p>
                      </div>
                      <button onClick={() => addRuleRow(2)} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-neutral-900 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-700 dark:text-neutral-300 hover:text-blue-700 dark:hover:text-blue-400 text-xs font-black rounded-xl transition-colors shrink-0"><Plus size={14} strokeWidth={3} /> Add Row</button>
                    </div>
                    <div className="w-full overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left min-w-[500px]">
                        <thead>
                          <tr className="bg-gray-50/50 dark:bg-[#111] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <th className="p-4 w-1/3">Min. Days (≥)</th>
                            <th className="p-4 w-1/3">Max. Days (&lt;)</th>
                            <th className="p-4 w-1/4 text-center">Earned</th>
                            <th className="p-4 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                          {rules2.map((rule, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                              <td className="p-2 border-r border-gray-100 dark:border-neutral-900"><input type="number" step="0.1" value={rule.min} onChange={(e) => updateRule(2, idx, 'min', e.target.value)} placeholder="0" className="w-full bg-transparent p-2 text-sm font-mono font-black text-gray-900 dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 rounded-lg transition-colors" /></td>
                              <td className="p-2 border-r border-gray-100 dark:border-neutral-900"><input type="number" step="0.1" value={rule.max} onChange={(e) => updateRule(2, idx, 'max', e.target.value)} placeholder="Infinity" className="w-full bg-transparent p-2 text-sm font-mono font-black text-gray-900 dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 rounded-lg transition-colors" /></td>
                              <td className="p-2 border-r border-gray-100 dark:border-neutral-900"><input type="number" value={rule.awarded} onChange={(e) => updateRule(2, idx, 'awarded', e.target.value)} placeholder="0" className="w-full text-center bg-transparent p-2 text-sm font-mono font-black text-blue-600 dark:text-blue-400 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 rounded-lg transition-colors" /></td>
                              <td className="p-2 text-center"><button onClick={() => removeRuleRow(2, idx)} className="p-2 text-gray-300 dark:text-neutral-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button></td>
                            </tr>
                          ))}
                          {rules2.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm font-bold text-gray-400">No rules defined.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111]">
                      <button onClick={() => saveRulesMatrix(2)} disabled={saving2} className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-[0.98]">
                        {saving2 ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} strokeWidth={2.5} />} Save Tier-B Matrix
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: DEPARTMENTS & ROLES
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "departments" && (
            <div className="xl:col-span-3">
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111]/50 flex justify-between items-center">
                   <div>
                     <h2 className="text-lg font-black text-gray-900 dark:text-white">Organization Structure</h2>
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Manage departments and designations</p>
                   </div>
                   <button onClick={() => { setDeptModal({action: 'create', name: '', roles: []}); setNewRoleName(""); }} className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">
                     <Plus size={14} strokeWidth={3} /> Add Department
                   </button>
                </div>
                
                {loading ? (
                   <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                    {departments.map(dept => (
                      <div key={dept.id || dept.name} className="border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 bg-gray-50/50 dark:bg-[#111]/50 relative group">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-black text-lg text-gray-900 dark:text-white">{dept.name}</h3>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setDeptModal({action: 'edit', id: dept.id, name: dept.name, roles: dept.roles}); setNewRoleName(""); }} className="p-1.5 text-gray-500 hover:text-blue-500 bg-white dark:bg-black rounded-lg shadow-sm border border-gray-200 dark:border-neutral-800"><Edit size={14}/></button>
                            <button onClick={() => deleteDept(dept.id)} className="p-1.5 text-gray-500 hover:text-red-500 bg-white dark:bg-black rounded-lg shadow-sm border border-gray-200 dark:border-neutral-800"><Trash2 size={14}/></button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {dept.roles.map((role, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-700 text-xs font-bold text-gray-600 dark:text-neutral-400 rounded-md shadow-sm">
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {departments.length === 0 && <div className="col-span-full p-8 text-center text-sm font-bold text-gray-400">No departments configured.</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: BRANCHES
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "branches" && (
            <div className="xl:col-span-3">
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111]/50 flex justify-between items-center">
                   <div>
                     <h2 className="text-lg font-black text-gray-900 dark:text-white">Active Branches</h2>
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Manage physical locations</p>
                   </div>
                   <button onClick={() => setBranchFormModal({action: 'create', name: '', address: '', status: 'active'})} className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">
                     <Plus size={14} strokeWidth={3} /> Add Branch
                   </button>
                </div>
                
                {loading ? (
                   <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <th className="p-4 md:p-5 border-r border-gray-200 dark:border-neutral-800">Branch Identity</th>
                          <th className="p-4 md:p-5 border-r border-gray-200 dark:border-neutral-800">Address / Location</th>
                          <th className="p-4 md:p-5 w-24 text-center border-r border-gray-200 dark:border-neutral-800">Staff</th>
                          <th className="p-4 md:p-5 w-32 text-center border-r border-gray-200 dark:border-neutral-800">Status</th>
                          <th className="p-4 md:p-5 w-32 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                        {branches.map(b => (
                          <tr key={b.id} className={`hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors ${b.status === 'inactive' ? 'opacity-50 grayscale' : ''}`}>
                            <td className="p-4 md:p-5 border-r border-gray-100 dark:border-neutral-900">
                              <p className="font-black text-sm text-gray-900 dark:text-white">{b.branch_name}</p>
                              <p className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest mt-0.5">ID: #{pad(b.id, 2)}</p>
                            </td>
                            <td className="p-4 md:p-5 border-r border-gray-100 dark:border-neutral-900">
                              <div className="flex items-center gap-2 text-gray-600 dark:text-neutral-400">
                                <MapPin size={14} className="shrink-0" />
                                <span className="text-xs font-medium line-clamp-1">{b.address || "No address provided"}</span>
                              </div>
                            </td>
                            <td className="p-4 md:p-5 text-center border-r border-gray-100 dark:border-neutral-900">
                               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-black font-mono rounded-lg">
                                 <Users size={12} /> {b.staff_count || 0}
                               </span>
                            </td>
                            <td className="p-4 md:p-5 text-center border-r border-gray-100 dark:border-neutral-900">
                              {b.status === 'active' ? (
                                <span className="inline-flex px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded border border-emerald-200 dark:border-emerald-900/50">Active</span>
                              ) : (
                                <span className="inline-flex px-2 py-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest rounded border border-red-200 dark:border-red-900/50">Inactive</span>
                              )}
                            </td>
                            <td className="p-4 md:p-5 flex items-center justify-center gap-2">
                              <button onClick={() => setBranchFormModal({action: 'edit', id: b.id, name: b.branch_name, address: b.address, status: b.status})} className="p-2 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit size={16} /></button>
                              <button onClick={() => deleteBranch(b.id)} className="p-2 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                        {branches.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm font-bold text-gray-400">No branches registered.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4: ADMIN ACCOUNTS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "admins" && (
            <div className="xl:col-span-3">
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111]/50 flex justify-between items-center">
                   <div>
                     <h2 className="text-lg font-black text-gray-900 dark:text-white">System Administrators</h2>
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Full system access control</p>
                   </div>
                   <button onClick={() => setAdminModal({action: 'create', name: '', mobile: '', password: ''})} className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">
                     <UserCog size={14} strokeWidth={3} /> Add Admin
                   </button>
                </div>
                
                {loading ? (
                   <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <th className="p-4 md:p-5 border-r border-gray-200 dark:border-neutral-800">Administrator</th>
                          <th className="p-4 md:p-5 border-r border-gray-200 dark:border-neutral-800 w-48">Mobile ID</th>
                          <th className="p-4 md:p-5 w-32 text-center border-r border-gray-200 dark:border-neutral-800">Status</th>
                          <th className="p-4 md:p-5 w-32 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                        {admins.map(u => (
                          <tr key={u.id} className={`hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors ${u.status === 'inactive' ? 'opacity-50 grayscale' : ''}`}>
                            <td className="p-4 md:p-5 border-r border-gray-100 dark:border-neutral-900">
                              <p className="font-black text-sm text-gray-900 dark:text-white">{u.name}</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-500">Super Admin</p>
                            </td>
                            <td className="p-4 md:p-5 font-mono font-black text-sm text-gray-600 dark:text-neutral-400 border-r border-gray-100 dark:border-neutral-900">{u.mobile_number}</td>
                            <td className="p-4 md:p-5 text-center border-r border-gray-100 dark:border-neutral-900">
                              {u.status === 'active' ? (
                                <span className="inline-flex px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded border border-emerald-200 dark:border-emerald-900/50">Active</span>
                              ) : (
                                <span className="inline-flex px-2 py-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest rounded border border-red-200 dark:border-red-900/50">Inactive</span>
                              )}
                            </td>
                            <td className="p-4 md:p-5 flex items-center justify-center gap-2">
                              <button onClick={() => setAdminModal({action: 'edit', id: u.id, name: u.name, mobile: u.mobile_number, password: ''})} className="p-2 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"><Edit size={16} /></button>
                              <button onClick={() => toggleAdminStatus(u)} disabled={u.id === session?.id} title={u.id === session?.id ? "Cannot deactivate yourself" : "Toggle Status"} className="p-2 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-20"><XCircle size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════ */}
      
      {/* Department Modal */}
      {deptModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] rounded-t-3xl shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2"><Briefcase size={16} className="text-indigo-500" /> {deptModal.action === 'create' ? 'Add Department' : 'Edit Department'}</h2>
              <button onClick={() => setDeptModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><X size={16} /></button>
            </div>
            <form onSubmit={handleDeptSubmit} className="p-5 md:p-6 space-y-5 pb-safe">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Department Name</label>
                <input required autoFocus type="text" value={deptModal.name} onChange={(e) => setDeptModal({...deptModal, name: e.target.value})} placeholder="e.g. Kitchen, Service..." className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Define Roles / Designations</label>
                <div className="flex gap-2 mb-3">
                  <input 
                    type="text" 
                    placeholder="e.g. Executive Chef" 
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRoleToModal())} 
                    className="flex-1 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" 
                  />
                  <button type="button" onClick={addRoleToModal} className="px-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-900/50"><Plus size={18}/></button>
                </div>
                
                <div className="flex flex-wrap gap-2 p-3 min-h-20 bg-gray-50/50 dark:bg-[#111]/50 border border-gray-200 dark:border-neutral-800 rounded-xl">
                  {deptModal.roles.length === 0 ? (
                    <span className="text-xs text-gray-400 font-bold m-auto">No roles added yet.</span>
                  ) : (
                    deptModal.roles.map((role, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-black border border-gray-200 dark:border-neutral-700 text-xs font-bold text-gray-700 dark:text-neutral-300 rounded-lg shadow-sm">
                        {role}
                        <button type="button" onClick={() => removeRoleFromModal(idx)} className="text-gray-400 hover:text-red-500"><X size={12}/></button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <button type="submit" disabled={deptSubmitting} className="w-full py-3.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {deptSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />} {deptModal.action === 'create' ? 'Create Department' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Branch Form Modal */}
      {branchFormModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-sm rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] rounded-t-3xl shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2"><Building2 size={16} className="text-indigo-500" /> {branchFormModal.action === 'create' ? 'Add Branch' : 'Edit Branch'}</h2>
              <button onClick={() => setBranchFormModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><XCircle size={16} /></button>
            </div>
            <form onSubmit={handleBranchSubmit} className="p-5 md:p-6 space-y-5 pb-safe">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Branch Name</label>
                <input required autoFocus type="text" value={branchFormModal.name} onChange={(e) => setBranchFormModal({...branchFormModal, name: e.target.value})} placeholder="e.g. Head Office" className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Physical Address</label>
                <textarea required value={branchFormModal.address} onChange={(e) => setBranchFormModal({...branchFormModal, address: e.target.value})} placeholder="Full street address..." className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none h-20" />
              </div>
              {branchFormModal.action === 'edit' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Operational Status</label>
                  <div className="relative">
                    <select required value={branchFormModal.status} onChange={(e) => setBranchFormModal({...branchFormModal, status: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer">
                      <option value="active">Active (Operational)</option>
                      <option value="inactive">Inactive (Suspended)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}
              <button type="submit" disabled={branchSubmitting} className="w-full py-3.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {branchSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />} {branchFormModal.action === 'create' ? 'Create Branch' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Form Modal */}
      {adminModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-end md:items-center justify-center sm:p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full md:max-w-sm rounded-t-3xl md:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-full md:zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] rounded-t-3xl shrink-0">
              <h2 className="text-sm font-black flex items-center gap-2"><UserCog size={16} className="text-indigo-500" /> {adminModal.action === 'create' ? 'Add Administrator' : 'Edit Administrator'}</h2>
              <button onClick={() => setAdminModal(null)} className="p-2 bg-gray-100 dark:bg-neutral-900 rounded-full hover:bg-gray-200 transition-colors text-gray-600 dark:text-neutral-400"><XCircle size={16} /></button>
            </div>
            <form onSubmit={handleAdminSubmit} className="p-5 md:p-6 space-y-4 pb-safe">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Full Name</label>
                <input required autoFocus type="text" value={adminModal.name} onChange={(e) => setAdminModal({...adminModal, name: e.target.value})} placeholder="e.g. John Doe" className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Mobile Login ID</label>
                <input required type="text" value={adminModal.mobile} onChange={(e) => setAdminModal({...adminModal, mobile: e.target.value})} placeholder="10-digit mobile number" className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1 flex justify-between">
                  <span>{adminModal.action === 'edit' ? 'New Password (Optional)' : 'Secure Password'}</span>
                  <KeyRound size={12} className="text-gray-400" />
                </label>
                <input type="password" value={adminModal.password} onChange={(e) => setAdminModal({...adminModal, password: e.target.value})} required={adminModal.action === 'create'} placeholder={adminModal.action === 'edit' ? "Leave blank to keep current" : "Create strict password"} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <button type="submit" disabled={branchSubmitting} className="w-full py-3.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
                {branchSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={3} />} {adminModal.action === 'create' ? 'Create Admin Account' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}