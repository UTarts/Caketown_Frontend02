// src/components/ui/EmptyState.js
"use client";

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-8">
      {Icon && (
        <div className="mb-4 w-14 h-14 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center text-gray-300 dark:text-neutral-600">
          <Icon size={28} />
        </div>
      )}
      <h3 className="text-base font-bold text-gray-700 dark:text-neutral-300 mb-1">{title}</h3>
      {message && <p className="text-sm text-gray-400 dark:text-neutral-500 max-w-xs">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
