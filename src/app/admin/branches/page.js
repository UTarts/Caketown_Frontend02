"use client";
import { useState, useEffect } from "react";
import { callApi } from "@/lib/apiClient";
import { Building2, MapPin, Plus, Loader2, Server, ArrowRight } from "lucide-react";

export default function BranchManagement() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ branch_name: "", address: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchBranches(); }, []);

  const fetchBranches = async () => {
    setLoading(true);
    const res = await callApi("get_branches");
    if (res.status === "success") setBranches(res.data);
    setLoading(false);
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!formData.branch_name) return;
    setIsSubmitting(true);
    const res = await callApi("create_branch", formData);
    if (res.status === "success") {
      setFormData({ branch_name: "", address: "" });
      fetchBranches();
    } else { alert(res.message); }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-neutral-200 p-6 md:p-12 font-sans selection:bg-emerald-500/30">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col gap-2 border-b border-gray-200 dark:border-neutral-800 pb-8">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-500">
            <Server size={20} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase">God Mode // Architecture</span>
          </div>
          <h1 className="text-4xl font-black text-black dark:text-white tracking-tight">Branch Command Center</h1>
          <p className="text-gray-500 dark:text-neutral-500 max-w-xl">
            Deploy isolated environments for new cafe locations. Each branch operates as a distinct ecosystem within the Caketown Vault.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Branch Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-neutral-900/50 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm dark:shadow-none backdrop-blur-xl transition-colors">
              <h2 className="text-lg font-bold text-black dark:text-white mb-6 flex items-center gap-2">
                <Plus size={18} className="text-emerald-600 dark:text-emerald-500"/> Initialize New Branch
              </h2>
              
              <form onSubmit={handleCreateBranch} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Branch Designation</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" />
                    <input 
                      type="text" 
                      value={formData.branch_name}
                      onChange={(e) => setFormData({...formData, branch_name: e.target.value})}
                      placeholder="e.g. Caketown Chowk" 
                      className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-black dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Physical Address</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-4 text-gray-400 dark:text-neutral-500" />
                    <textarea 
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="Street location..." 
                      rows="3"
                      className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-black dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
                    ></textarea>
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-black font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Deploy Branch"}
                </button>
              </form>
            </div>
          </div>

          {/* Active Branches Grid */}
          <div className="lg:col-span-2 space-y-4">
                {branches.map((branch) => (
                  <div 
                    key={branch.id} 
                    onClick={() => window.location.href = `/admin/branch?id=${branch.id}`}
                    className="group cursor-pointer bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 hover:border-emerald-500/50 rounded-2xl p-5 shadow-sm dark:shadow-none transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
                      <Building2 size={64} className="text-emerald-600 dark:text-emerald-500 transform translate-x-4 -translate-y-4" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2 py-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-md uppercase tracking-widest">
                          {branch.status}
                        </span>
                        <span className="text-gray-400 dark:text-neutral-600 font-mono text-xs">ID: {branch.id.toString().padStart(4, '0')}</span>
                      </div>
                      <h3 className="text-xl font-bold text-black dark:text-white mb-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{branch.branch_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-neutral-500 flex items-start gap-2 mt-3">
                        <MapPin size={14} className="shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{branch.address || "No address provided."}</span>
                      </p>
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-neutral-900 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Enter Command Room</span>
                         <ArrowRight size={16} className="text-emerald-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
        </div>
      </div>
    </div>
  );
}