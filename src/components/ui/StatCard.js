// src/components/ui/StatCard.js
"use client";
export default function StatCard({ icon: Icon, label, value, sub, color = "emerald", loading = false }) {
  const colorMap = {
    emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue:    "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple:  "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
    orange:  "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400",
    red:     "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
    gold:    "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  };
  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`p-3 rounded-xl shrink-0 ${colorMap[color] || colorMap.emerald}`}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest truncate">{label}</p>
        {loading ? (
          <div className="h-7 w-20 mt-1 rounded-md bg-gray-100 dark:bg-neutral-800 animate-pulse" />
        ) : (
          <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums leading-tight">{value ?? "—"}</p>
        )}
        {sub && !loading && (
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}
