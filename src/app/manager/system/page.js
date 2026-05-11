"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import { canRead } from "@/lib/permissions";
import {
  History, Loader2, Search, Shield, Filter,
  Activity, Banknote, AlertTriangle, ShieldCheck, Clock
} from "lucide-react";

export default function ManagerSystemLogs() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) { router.push("/"); return; }
    
    try {
      const parsed = JSON.parse(raw);
      if (!canRead(parsed.feature_permissions, 'view_system_logs')) {
        router.push("/manager/dashboard"); return;
      }
      setSession(parsed);
    } catch { router.push("/"); }
  }, [router]);

  const fetchLogs = useCallback(async () => {
    if (!session?.branch_id) return;
    setLoading(true);
    // Fetch top 100 recent logs for forensic view
    const res = await callApi("get_system_logs", { branch_id: session.branch_id, per_page: 150 });
    if (res.status === "success") setLogs(res.data || []);
    setLoading(false);
  }, [session?.branch_id]);

  useEffect(() => { if (session) fetchLogs(); }, [session, fetchLogs]);

  const getCategory = (actionType) => {
    const t = actionType.toUpperCase();
    if (t.includes('ADVANCE') || t.includes('SALARY') || t.includes('BILL') || t.includes('FINE') || t.includes('PAYMENT')) return 'finance';
    if (t.includes('ATTENDANCE') || t.includes('PUNCH') || t.includes('OVERRIDE')) return 'attendance';
    if (t.includes('DELETE') || t.includes('DEACTIVATE') || t.includes('REGISTER_FACE')) return 'security';
    return 'system';
  };

  const getLogStyle = (category) => {
    switch (category) {
      case 'finance': return { color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-900/50", icon: Banknote };
      case 'attendance': return { color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-900/50", icon: Activity };
      case 'security': return { color: "text-red-500", bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-200 dark:border-red-900/50", icon: AlertTriangle };
      default: return { color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10", border: "border-blue-200 dark:border-blue-900/50", icon: ShieldCheck };
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const cat = getCategory(log.action_type);
      if (filter !== "all" && cat !== filter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return log.description?.toLowerCase().includes(q) || log.actor_name?.toLowerCase().includes(q) || log.action_type?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [logs, filter, searchQuery]);

  if (!session) return null;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 w-full px-3 md:px-0">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mt-3 md:mt-0">
        <div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 mb-1">
            <Shield size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Branch Security</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            System Audit Logs
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 font-medium flex items-center gap-1.5">
            Immutable forensic timeline of all local branch actions.
          </p>
        </div>

        <div className="flex items-center bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
          {[
            { id: "all", label: "All Logs" },
            { id: "finance", label: "Financial" },
            { id: "attendance", label: "Attendance" },
            { id: "security", label: "Security" }
          ].map(f => (
            <button 
              key={f.id} onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${filter === f.id ? 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full md:max-w-md shrink-0">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search event, user, or action..." className="w-full bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm" />
      </div>

      {/* ── TIMELINE ── */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 md:p-8 shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Decrypting Logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
            <History size={40} className="text-gray-400 mb-3" />
            <p className="text-sm font-bold text-gray-500">No logs match your current query.</p>
          </div>
        ) : (
          <div className="relative pl-4 md:pl-6 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-8">
            {filteredLogs.map(log => {
              const cat = getCategory(log.action_type);
              const S = getLogStyle(cat);
              const Icon = S.icon;

              return (
                <div key={log.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[23px] md:-left-[31px] top-1.5 w-4 h-4 rounded-full ring-4 ring-white dark:ring-[#0a0a0a] shadow-sm flex items-center justify-center ${S.bg}`}>
                    <div className={`w-2 h-2 rounded-full ${S.color.replace('text-', 'bg-')}`}></div>
                  </div>
                  
                  {/* Log Content */}
                  <div className="pl-2">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${S.bg} ${S.color} ${S.border}`}>
                        <Icon size={10} strokeWidth={3} /> {log.action_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><Clock size={10} /> {new Date(log.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    
                    <p className="text-sm font-bold text-gray-800 dark:text-neutral-200 leading-snug max-w-3xl mb-2">{log.description}</p>
                    
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-50 dark:bg-neutral-900/50 border border-gray-100 dark:border-neutral-800 px-3 py-1.5 rounded-lg w-fit">
                      <Shield size={12} className={log.actor_role === 'admin' ? 'text-red-500' : 'text-blue-500'} />
                      Initiated by: {log.actor_name || "System Automated"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}