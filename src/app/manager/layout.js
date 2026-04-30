"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ScanFace,
  Banknote,
  Users,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Camera,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard, perm: null },
  { label: "Terminal", href: "/manager/terminal", icon: ScanFace, perm: "manage_terminal" },
  { label: "Faces", href: "/manager/faces", icon: Camera, perm: "register_face" },
  { label: "Finance", href: "/manager/dashboard?tab=finance", icon: Banknote, perm: "view_payroll" },
  { label: "Staff", href: "/manager/dashboard?tab=staff", icon: Users, perm: "view_staff_list" },
];

function hasPermission(permissions, key, mode = "read") {
  if (!key) return true;
  const p = permissions?.[key] || permissions?.register_faces;
  return !!p?.[mode] || !!p?.read || !!p?.write;
}

export default function ManagerLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("caketown_session");
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || parsed.role !== "manager") {
        router.push("/");
        return;
      }
      setSession(parsed);
    } catch {
      router.push("/");
    }
  }, [router]);

  const permissions = useMemo(() => session?.feature_permissions || {}, [session]);
  const allowedNav = NAV_ITEMS.filter((item) => hasPermission(permissions, item.perm));

  const handleLogout = () => {
    localStorage.removeItem("caketown_session");
    router.push("/");
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] dark:bg-black flex items-center justify-center">
        <div className="text-sm font-bold text-gray-500">Loading manager environment...</div>
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
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                  Caketown ERP
                </p>
                <h1 className="text-lg font-black">Manager Console</h1>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black p-4">
              <p className="text-sm font-black text-black dark:text-white">{session.name}</p>
              <p className="text-[11px] text-gray-500 mt-1">{session.branch_name || "Assigned Branch"}</p>
            </div>
          </div>

          <nav className="p-4 space-y-2 flex-1">
            {allowedNav.map((item) => {
              const active = pathname === item.href.split("?")[0];
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
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-neutral-900 bg-white/90 dark:bg-black/80 backdrop-blur-xl">
            <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setOpen(true)}
                  className="lg:hidden p-2 rounded-xl border border-gray-200 dark:border-neutral-800"
                >
                  <Menu size={18} />
                </button>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-600 dark:text-emerald-400">
                    Branch Manager
                  </p>
                  <p className="text-sm font-bold text-black dark:text-white">
                    {session.branch_name || "Branch Dashboard"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-bold">{session.name}</p>
                <p className="text-[11px] text-gray-500">Role: Manager</p>
              </div>
            </div>
          </header>

          <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">{children}</main>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[88%] max-w-sm bg-white dark:bg-neutral-950 border-r border-gray-200 dark:border-neutral-900 shadow-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-600">Caketown ERP</p>
                <h2 className="text-lg font-black">Manager Console</h2>
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
              {allowedNav.map((item) => (
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
              onClick={handleLogout}
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