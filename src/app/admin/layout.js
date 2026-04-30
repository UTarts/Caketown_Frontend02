"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Building2, Users, Settings,
  LogOut, Menu, X, Banknote, Sun, Moon, ChevronRight
} from "lucide-react";
import { logout } from "@/lib/apiClient";

export default function AdminLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]         = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark]         = useState(false);

  useEffect(() => {
    // Theme init
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem("caketown_session");
    if (!session) { router.push("/"); return; }
    const parsed = JSON.parse(session);
    if (parsed.role !== "admin") { router.push("/"); return; }
    setUser(parsed);
  }, [router]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = () => logout(router);

  if (!user) return null;

  const initials = user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  const navItems = [
    { name: "Overview",       path: "/admin",          icon: LayoutDashboard, exact: true },
    { name: "Branches",       path: "/admin/branches", icon: Building2 },
    { name: "All Personnel",  path: "/admin/employees",icon: Users },
    { name: "Payroll & Finance", path: "/admin/payroll", icon: Banknote },
    { name: "Settings",       path: "/admin/settings", icon: Settings },
  ];

  const isActive = (item) =>
    item.exact ? pathname === item.path : pathname.startsWith(item.path);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] flex">

      {/* ── Mobile top bar ─────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-black border-b border-gray-200 dark:border-neutral-800 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-black">C</div>
          <span className="text-base font-black text-gray-900 dark:text-white">Caketown ERP</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors" aria-label="Toggle theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setMenuOpen(true)} className="p-2 text-gray-600 dark:text-neutral-400" aria-label="Open menu">
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* ── Mobile overlay ─────────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
      )}

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-black border-r border-gray-200 dark:border-neutral-800 flex flex-col z-50 transition-transform duration-300 ease-in-out ${
        menuOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0`}>

        {/* Logo */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-black">C</div>
              <span className="text-base font-black text-gray-900 dark:text-white tracking-tight">Caketown ERP</span>
            </div>
            <p className="text-[9px] text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-[0.2em] mt-0.5 pl-9">Admin Portal</p>
          </div>
          <button onClick={() => setMenuOpen(false)} className="md:hidden p-1 text-gray-400" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map(item => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.path}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-semibold group ${
                  active
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Icon size={17} className="shrink-0" />
                <span className="flex-1">{item.name}</span>
                {active && <ChevronRight size={14} className="opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: theme + user + logout */}
        <div className="p-3 border-t border-gray-100 dark:border-neutral-800 space-y-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>

          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-200 dark:border-emerald-800 shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
              <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Admin</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={17} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-[1440px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
