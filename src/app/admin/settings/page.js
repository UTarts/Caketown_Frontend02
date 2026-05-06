"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Building2, CalendarRange, ChevronDown, Loader2, Save, 
  Settings2, Plus, Trash2, ArrowRight, ShieldCheck, Moon, Sun, MonitorSmartphone
} from "lucide-react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const router = useRouter();
  
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  
  const [rules4, setRules4] = useState([]);
  const [rules2, setRules2] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving4, setSaving4] = useState(false);
  const [saving2, setSaving2] = useState(false);

  // Fetch branches to populate the scope selector
  const fetchBranches = useCallback(async () => {
    setLoading(true);
    const res = await callApi("get_branches");
    if (res.status === "success" && res.data?.length > 0) {
      setBranches(res.data);
      setSelectedBranchId(res.data[0].id); // Default to first branch
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Fetch rules whenever the selected branch changes
  const fetchRules = useCallback(async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    const res = await callApi("get_branch_leave_rules", { branch_id: selectedBranchId });
    if (res.status === "success") {
      // Map API data to our Matrix State
      const data4 = res.data["4"] || [];
      const data2 = res.data["2"] || [];
      
      setRules4(data4.map(r => ({
        min: r.min_working_days, 
        max: r.max_days_exclusive || "", 
        awarded: r.earned_paid_leaves
      })));
      
      setRules2(data2.map(r => ({
        min: r.min_working_days, 
        max: r.max_days_exclusive || "", 
        awarded: r.earned_paid_leaves
      })));
    }
    setLoading(false);
  }, [selectedBranchId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ─── MATRIX HANDLERS ──────────────────────────────────────────────────
  const updateRule = (cap, index, field, value) => {
    const setter = cap === 4 ? setRules4 : setRules2;
    setter(prev => {
      const newRules = [...prev];
      newRules[index][field] = value;
      return newRules;
    });
  };

  const addRuleRow = (cap) => {
    const setter = cap === 4 ? setRules4 : setRules2;
    setter(prev => [...prev, { min: "", max: "", awarded: "" }]);
  };

  const removeRuleRow = (cap, index) => {
    const setter = cap === 4 ? setRules4 : setRules2;
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const saveRulesMatrix = async (cap) => {
    const isCap4 = cap === 4;
    const rulesToSave = isCap4 ? rules4 : rules2;
    const setSaving = isCap4 ? setSaving4 : setSaving2;

    // Validate and format payload
    const formattedRules = rulesToSave.map(r => ({
      min_working_days: parseFloat(r.min) || 0,
      earned_paid_leaves: parseInt(r.awarded) || 0,
      max_days_exclusive: r.max === "" ? null : parseFloat(r.max)
    }));

    setSaving(true);
    const session = JSON.parse(localStorage.getItem("caketown_session") || "{}");

    const res = await callApi("save_leave_rules", {
      branch_id: selectedBranchId,
      cap: cap,
      rules: formattedRules,
      admin_id: session.id
    });

    if (res.status === "success") {
      fetchRules(); // Resync to ensure clean state
    } else {
      alert(res.message || `Failed to save Tier ${cap} rules.`);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 text-gray-900 dark:text-neutral-200 font-sans w-full overflow-x-hidden">
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mx-3 md:mx-0 mt-3 md:mt-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 mb-1">
            <Settings2 size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Global Configuration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight truncate">
            System Settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 font-medium leading-relaxed max-w-3xl">
            Configure core algorithmic parameters. Modify the mathematical bounds for paid holiday accrual across your branch environments.
          </p>
        </div>
      </div>

      <div className="px-3 md:px-0 grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
        
        {/* ── LEFT COLUMN: Quick Links & Scope ─────────────────────────── */}
        <div className="xl:col-span-1 space-y-6">
          
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-4">
              <MonitorSmartphone size={16} className="text-blue-500" /> Platform Scope
            </h3>
            <div className="space-y-3">
              <Link href="/admin/branches" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-[#111] hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/30 transition-colors">
                    <Building2 size={14} className="text-gray-600 dark:text-neutral-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400" />
                  </div>
                  <span className="font-bold text-sm text-gray-700 dark:text-neutral-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">Manage Branches</span>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-emerald-500 transition-colors" />
              </Link>

              <Link href="/admin/employees" className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-[#111] hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-transparent hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-500/30 transition-colors">
                    <ShieldCheck size={14} className="text-gray-600 dark:text-neutral-400 group-hover:text-blue-700 dark:group-hover:text-blue-400" />
                  </div>
                  <span className="font-bold text-sm text-gray-700 dark:text-neutral-300 group-hover:text-blue-700 dark:group-hover:text-blue-400">Personnel & Roles</span>
                </div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
              </Link>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest flex items-center gap-2 mb-4">
              <CalendarRange size={16} className="text-orange-500" /> Target Environment
            </h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3 font-medium">Select a branch to edit its specific algorithmic bounds for paid holiday accrual.</p>
            
            {branches.length === 0 ? (
              <div className="p-4 bg-gray-50 dark:bg-neutral-900 rounded-2xl text-center text-xs font-bold text-gray-400">No Branches Available</div>
            ) : (
              <div className="relative">
                <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <select 
                  value={selectedBranchId} 
                  onChange={(e) => setSelectedBranchId(e.target.value)} 
                  className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                >
                  {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Leave Rule Matrix Engine ────────────────────── */}
        <div className="xl:col-span-2 space-y-6 md:space-y-8">
          
          {loading ? (
             <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-16 flex flex-col items-center justify-center">
               <Loader2 className="animate-spin text-emerald-500 mb-4" size={32} />
               <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Loading Matrix...</p>
             </div>
          ) : !selectedBranchId ? (
             <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
               <Building2 size={40} className="text-gray-300 dark:text-neutral-700 mb-4" />
               <h3 className="text-lg font-black text-gray-900 dark:text-white">Select a Branch</h3>
               <p className="text-sm text-gray-500 mt-1">Please create or select a branch to configure its rules.</p>
             </div>
          ) : (
            <>
              {/* TIER A: 4 Paid Leaves */}
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 bg-emerald-50/30 dark:bg-emerald-900/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={16} /> Tier-A Configuration
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 font-medium">Matrix for employees capped at 4 paid holidays.</p>
                  </div>
                  <button onClick={() => addRuleRow(4)} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-neutral-900 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-gray-700 dark:text-neutral-300 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-black rounded-xl transition-colors shrink-0">
                    <Plus size={14} strokeWidth={3} /> Add Row
                  </button>
                </div>

                <div className="w-full overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="bg-gray-50/50 dark:bg-[#111] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="p-4 w-1/3">Min. Days (≥)</th>
                        <th className="p-4 w-1/3">Max. Days (&lt;)</th>
                        <th className="p-4 w-1/4 text-center">Holidays Earned</th>
                        <th className="p-4 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                      {rules4.map((rule, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                          <td className="p-2 border-r border-gray-100 dark:border-neutral-900">
                            <input type="number" step="0.1" value={rule.min} onChange={(e) => updateRule(4, idx, 'min', e.target.value)} placeholder="0" className="w-full bg-transparent p-2 text-sm font-mono font-black text-gray-900 dark:text-white outline-none focus:bg-emerald-50 dark:focus:bg-emerald-900/20 rounded-lg transition-colors" />
                          </td>
                          <td className="p-2 border-r border-gray-100 dark:border-neutral-900">
                            <input type="number" step="0.1" value={rule.max} onChange={(e) => updateRule(4, idx, 'max', e.target.value)} placeholder="Infinity (Blank)" className="w-full bg-transparent p-2 text-sm font-mono font-black text-gray-900 dark:text-white outline-none focus:bg-emerald-50 dark:focus:bg-emerald-900/20 rounded-lg transition-colors" />
                          </td>
                          <td className="p-2 border-r border-gray-100 dark:border-neutral-900">
                            <input type="number" value={rule.awarded} onChange={(e) => updateRule(4, idx, 'awarded', e.target.value)} placeholder="0" className="w-full text-center bg-transparent p-2 text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none focus:bg-emerald-50 dark:focus:bg-emerald-900/20 rounded-lg transition-colors" />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeRuleRow(4, idx)} className="p-2 text-gray-300 dark:text-neutral-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {rules4.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm font-bold text-gray-400">No rules defined. Add a row to begin.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#111]">
                  <button onClick={() => saveRulesMatrix(4)} disabled={saving4} className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-[0.98]">
                    {saving4 ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} strokeWidth={2.5} />} Save Tier-A Matrix
                  </button>
                </div>
              </div>

              {/* TIER B: 2 Paid Leaves */}
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 bg-blue-50/30 dark:bg-blue-900/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={16} /> Tier-B Configuration
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1 font-medium">Matrix for employees capped at 2 paid holidays.</p>
                  </div>
                  <button onClick={() => addRuleRow(2)} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-neutral-900 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-700 dark:text-neutral-300 hover:text-blue-700 dark:hover:text-blue-400 text-xs font-black rounded-xl transition-colors shrink-0">
                    <Plus size={14} strokeWidth={3} /> Add Row
                  </button>
                </div>

                <div className="w-full overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="bg-gray-50/50 dark:bg-[#111] border-b border-gray-200 dark:border-neutral-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="p-4 w-1/3">Min. Days (≥)</th>
                        <th className="p-4 w-1/3">Max. Days (&lt;)</th>
                        <th className="p-4 w-1/4 text-center">Holidays Earned</th>
                        <th className="p-4 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                      {rules2.map((rule, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors group">
                          <td className="p-2 border-r border-gray-100 dark:border-neutral-900">
                            <input type="number" step="0.1" value={rule.min} onChange={(e) => updateRule(2, idx, 'min', e.target.value)} placeholder="0" className="w-full bg-transparent p-2 text-sm font-mono font-black text-gray-900 dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 rounded-lg transition-colors" />
                          </td>
                          <td className="p-2 border-r border-gray-100 dark:border-neutral-900">
                            <input type="number" step="0.1" value={rule.max} onChange={(e) => updateRule(2, idx, 'max', e.target.value)} placeholder="Infinity (Blank)" className="w-full bg-transparent p-2 text-sm font-mono font-black text-gray-900 dark:text-white outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 rounded-lg transition-colors" />
                          </td>
                          <td className="p-2 border-r border-gray-100 dark:border-neutral-900">
                            <input type="number" value={rule.awarded} onChange={(e) => updateRule(2, idx, 'awarded', e.target.value)} placeholder="0" className="w-full text-center bg-transparent p-2 text-sm font-mono font-black text-blue-600 dark:text-blue-400 outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 rounded-lg transition-colors" />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeRuleRow(2, idx)} className="p-2 text-gray-300 dark:text-neutral-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {rules2.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm font-bold text-gray-400">No rules defined. Add a row to begin.</td></tr>}
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
      </div>
    </div>
  );
}