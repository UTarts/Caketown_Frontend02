// src/components/ui/PermissionGrid.js
"use client";
import { ALL_PERMISSIONS, PERMISSION_CATEGORIES } from "@/lib/permissions";

export default function PermissionGrid({ selected = [], onChange }) {
  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter(p => p !== id)
      : [...selected, id];
    onChange(next);
  };

  const toggleCategory = (cat) => {
    const catPerms = ALL_PERMISSIONS.filter(p => p.category === cat).map(p => p.id);
    const allSelected = catPerms.every(id => selected.includes(id));
    const next = allSelected
      ? selected.filter(id => !catPerms.includes(id))
      : [...new Set([...selected, ...catPerms])];
    onChange(next);
  };

  return (
    <div className="space-y-5">
      {PERMISSION_CATEGORIES.map(cat => {
        const catPerms = ALL_PERMISSIONS.filter(p => p.category === cat);
        const allChecked = catPerms.every(p => selected.includes(p.id));
        const someChecked = catPerms.some(p => selected.includes(p.id));
        return (
          <div key={cat}>
            {/* Category header */}
            <label className="flex items-center gap-2 mb-2 cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 accent-emerald-500 rounded"
                checked={allChecked}
                ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                onChange={() => toggleCategory(cat)}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">
                {cat}
              </span>
            </label>
            {/* Permission rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
              {catPerms.map(perm => (
                <label
                  key={perm.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-sm font-medium ${
                    selected.includes(perm.id)
                      ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/15 dark:border-emerald-600/40 text-emerald-800 dark:text-emerald-300'
                      : 'bg-gray-50 border-gray-200 dark:bg-black dark:border-neutral-800 text-gray-700 dark:text-neutral-300 hover:border-gray-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-emerald-500 rounded shrink-0"
                    checked={selected.includes(perm.id)}
                    onChange={() => toggle(perm.id)}
                  />
                  {perm.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
