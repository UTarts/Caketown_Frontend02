"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, UserCircle2, X } from "lucide-react";

const NAV = [{ label: "My Portal", href: "/staff/portal", icon: LayoutDashboard }];

export default function StaffLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [session, setSession] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("caketown_session");
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || parsed.role !== "staff") {
        router.push("/");
        return;
      }
      setSession(parsed);
    } catch {
      router.push("/");
    }
  }, [router]);

  const logout = () => {
    localStorage.removeItem("caketown_session");
    router.push("/");
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] dark:bg-black flex items-center justify-center">
        <div className="text-sm font-bold text-gray-500">Loading staff portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] dark:bg-black text-gray-900 dark:text-neutral-100">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-72 shrink-0 border-r border-gray-200 dark:border-neutral-900 bg-white/80 dark:bg-neutral-950/70 backdrop-blur-xl flex-col">
          <div className="p-6 border-b border-gray-200 dark:border-neutral-900">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <UserCircle2 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                  Caketown ERP
                </p>
                <h1 className="text-lg font-black">Staff Portal</h1>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black p-4">
              <p className="text-sm font-black">{session.name}</p>
              <p className="text-[11px] text-gray-500 mt-1">{session.branch_name || "Assigned Branch"}</p>
            </div>
          </div>

          <nav className="p-4 space-y-2 flex-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <button
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                    active
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-600 dark:text-neutral-400"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-neutral-900">
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-neutral-900 bg-white/90 dark:bg-black/80 backdrop-blur-xl">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setOpen(true)}
                  className="lg:hidden p-2 rounded-xl border border-gray-200 dark:border-neutral-800"
                >
                  <Menu size={18} />
                </button>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-600 dark:text-emerald-400">
                    Staff Access
                  </p>
                  <p className="text-sm font-bold text-black dark:text-white">{session.branch_name || "Branch Portal"}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-bold">{session.name}</p>
                <p className="text-[11px] text-gray-500">Role: Staff</p>
              </div>
            </div>
          </header>

          <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">{children}</main>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-sm bg-white dark:bg-neutral-950 border-r border-gray-200 dark:border-neutral-900 shadow-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-600">Caketown ERP</p>
                <h2 className="text-lg font-black">Staff Portal</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-900">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black p-4 mb-4">
              <p className="text-sm font-black">{session.name}</p>
              <p className="text-[11px] text-gray-500 mt-1">{session.branch_name || "Assigned Branch"}</p>
            </div>

            <nav className="space-y-2 flex-1">
              {NAV.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    router.push(item.href);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold hover:bg-gray-100 dark:hover:bg-neutral-900"
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              ))}
            </nav>

            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
