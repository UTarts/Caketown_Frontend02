"use client";

import { useState, useEffect, useCallback } from "react";
import { callApi } from "@/lib/apiClient";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import { 
  Store, 
  MapPin, 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  Loader2, 
  AlertCircle,
  X
} from "lucide-react";

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" or "edit"
  const [currentBranch, setCurrentBranch] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({ branch_name: "", address: "", status: "active" });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    const res = await callApi("get_branches");
    if (res.status === "success") {
      setBranches(res.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Handle Form Submission (Add/Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");

    const action = modalMode === "add" ? "create_branch" : "update_branch";
    const payload = modalMode === "add" ? formData : { ...formData, id: currentBranch.id };

    const res = await callApi(action, payload);
    
    if (res.status === "success") {
      await fetchBranches();
      closeModal();
    } else {
      setFormError(res.message || "Something went wrong.");
    }
    setFormLoading(false);
  };

  // Handle Deletion
  const handleDelete = async () => {
    setFormLoading(true);
    setFormError("");
    
    const res = await callApi("delete_branch", { id: currentBranch.id });
    
    if (res.status === "success") {
      await fetchBranches();
      setIsDeleteModalOpen(false);
      setCurrentBranch(null);
    } else {
      setFormError(res.message || "Failed to delete branch.");
    }
    setFormLoading(false);
  };

  const openAddModal = () => {
    setModalMode("add");
    setFormData({ branch_name: "", address: "", status: "active" });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (branch) => {
    setModalMode("edit");
    setCurrentBranch(branch);
    setFormData({ branch_name: branch.branch_name, address: branch.address, status: branch.status });
    setFormError("");
    setIsModalOpen(true);
  };

  const openDeleteModal = (branch) => {
    setCurrentBranch(branch);
    setFormError("");
    setIsDeleteModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentBranch(null);
  };

  return (
    <div className="space-y-6 md:space-y-8 font-sans pb-12">
      
      {/* ── Page Heading ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 dark:bg-neutral-900/20 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Branches</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1 font-medium">Manage your cafe locations and environments</p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
        >
          <Plus size={18} strokeWidth={3} />
          New Branch
        </button>
      </div>

      {/* ── Main Content ─────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
          <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest animate-pulse">Loading Branches...</p>
        </div>
      ) : branches.length === 0 ? (
        <EmptyState icon={Store} title="No Branches Found" message="You haven't added any branch locations yet. Click 'New Branch' to get started." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {branches.map((branch) => (
            <div key={branch.id} className="group bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-6 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 relative overflow-hidden flex flex-col h-full">
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Store size={24} strokeWidth={2.5} />
                </div>
                <Badge label={branch.status} variant={branch.status === 'active' ? 'emerald' : 'gray'} dot />
              </div>

              <div className="mb-6 flex-1 relative z-10">
                <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-2">{branch.branch_name}</h3>
                <div className="flex items-start gap-1.5 text-gray-500 dark:text-neutral-400">
                  <MapPin size={14} className="shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">{branch.address || "No address provided"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5 pt-5 border-t border-gray-100 dark:border-neutral-900 relative z-10">
                <div>
                  <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums flex items-center gap-2">
                    <Users size={16} className="text-emerald-500" /> {branch.staff_count}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Assigned Staff</p>
                </div>
              </div>

              <div className="flex items-center gap-2 relative z-10">
                <button 
                  onClick={() => openEditModal(branch)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-gray-700 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl text-xs font-bold transition-colors"
                >
                  <Edit3 size={14} /> Edit
                </button>
                <button 
                  onClick={() => openDeleteModal(branch)}
                  className="flex items-center justify-center p-2.5 bg-gray-50 dark:bg-neutral-900 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ── Add/Edit Modal ─────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal}></div>
          
          <div className="relative bg-white dark:bg-[#0A0A0A] w-full max-w-lg rounded-3xl shadow-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-neutral-900/20">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                {modalMode === "add" ? "Create New Branch" : "Edit Branch Details"}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl flex items-center gap-2 border border-red-100 dark:border-red-900/30">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider">Branch Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.branch_name}
                  onChange={(e) => setFormData({...formData, branch_name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                  placeholder="e.g. Caketown Chowk"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider">Address</label>
                <textarea 
                  rows="3"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all resize-none custom-scrollbar"
                  placeholder="Full branch address..."
                />
              </div>

              {modalMode === "edit" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all appearance-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-70"
                >
                  {formLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {modalMode === "add" ? "Create Branch" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────── */}
      {isDeleteModalOpen && currentBranch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)}></div>
          
          <div className="relative bg-white dark:bg-[#0A0A0A] w-full max-w-md rounded-3xl shadow-2xl border border-gray-200 dark:border-neutral-800 p-6 md:p-8 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-5 text-red-500">
              <AlertCircle size={32} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Delete Branch?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mb-6">
              Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{currentBranch.branch_name}</strong>? This action will mark it as inactive. You cannot delete a branch that has active staff assigned to it.
            </p>

            {formError && (
              <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl text-left border border-red-100 dark:border-red-900/30">
                {formError}
              </div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={formLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 disabled:opacity-70"
              >
                {formLoading ? <Loader2 size={16} className="animate-spin" /> : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}