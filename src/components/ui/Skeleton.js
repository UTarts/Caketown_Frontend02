// src/components/ui/Skeleton.js
"use client";

export function SkeletonLine({ w = "w-full", h = "h-4" }) {
  return <div className={`${w} ${h} rounded-md bg-gray-100 dark:bg-neutral-800 animate-pulse`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3">
      <SkeletonLine w="w-1/2" h="h-5" />
      <SkeletonLine w="w-3/4" />
      <SkeletonLine w="w-full" />
      <SkeletonLine w="w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {[...Array(cols)].map((_, i) => (
              <th key={i} className="p-4">
                <SkeletonLine h="h-3" w="w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, r) => (
            <tr key={r} className="border-t border-gray-100 dark:border-neutral-900">
              {[...Array(cols)].map((_, c) => (
                <td key={c} className="p-4">
                  <SkeletonLine h="h-4" w={c === 0 ? "w-32" : "w-16"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonStatRow({ count = 4 }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-neutral-800 animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            <SkeletonLine h="h-3" w="w-20" />
            <SkeletonLine h="h-6" w="w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
