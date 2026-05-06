"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, ScanFace, Users, LogOut, Sun, Moon, ChevronRight, ShieldCheck, UserCircle 
} from "lucide-react";
import { logout } from "@/lib/apiClient";

export default function ManagerLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Theme init
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    // Auth init
    const session = localStorage.getItem("caketown_session");
    if (!session) { router.replace("/"); return; }
    try {
      const parsed = JSON.parse(session);
      if (parsed.role !== "manager") { router.replace("/"); return; }
      setUser(parsed);
    } catch (e) {
      router.replace("/");
    }
  }, [router]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  if (!user) return null;

  const initials = user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  const navItems = [
    { name: "Dashboard", path: "/manager/dashboard", icon: LayoutDashboard },
    { name: "Terminal",  path: "/manager/terminal",  icon: ScanFace },
    { name: "Faces",     path: "/manager/faces",     icon: ShieldCheck },
    { name: "Profile",   path: "/manager/profile",   icon: UserCircle },
  ];

  // Smart check: Is this the terminal page?
  const isTerminal = pathname.includes('/terminal');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] flex selection:bg-emerald-500 selection:text-white">

      {/* ── Mobile Top Bar (With Diagonal Logo) ──────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-neutral-800 h-16 flex items-center justify-between shadow-sm">
        <div className="absolute top-0 left-0 h-16 w-40 bg-white shadow-[2px_0_10px_rgba(0,0,0,0.1)] z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>
          <img src="/logo.png" alt="Caketown" className="w-full h-full object-contain p-2 pr-6" />
        </div>
        <div className="flex-1"></div>
        <button onClick={toggleTheme} className="p-2.5 mr-4 rounded-full bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors z-20">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* ── Desktop Sidebar ────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-72 bg-white dark:bg-black border-r border-gray-200 dark:border-neutral-800 flex-col z-50">
        
        {/* Desktop Diagonal Logo Container */}
        <div className="h-24 w-full bg-white shadow-[0_2px_15px_rgba(0,0,0,0.03)] shrink-0" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)' }}>
           <img src="/logo.png" alt="Caketown Console" className="w-full h-full object-contain p-4 pb-6" />
        </div>
        
        {/* Logo Area */}
        <div className="h-20 px-6 flex items-center border-b border-gray-100 dark:border-neutral-800 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-sm font-black shadow-lg shadow-emerald-500/30">C</div>
              <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Manager Console</span>
            </div>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map(item => {
            const active = pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 font-semibold group ${
                  active
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-100/50 dark:shadow-none"
                    : "text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Icon size={18} className={`shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`} strokeWidth={active ? 2.5 : 2} />
                <span className="flex-1">{item.name}</span>
                {active && <ChevronRight size={16} className="opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Bottom: Theme + User + Logout */}
        <div className="p-4 border-t border-gray-100 dark:border-neutral-800 shrink-0 space-y-3">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>

          <div className="bg-gray-50 dark:bg-neutral-900/50 rounded-2xl p-4 flex flex-col gap-3 border border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-200 dark:border-emerald-800 shrink-0">
                {initials}
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-[10px] text-gray-400 dark:text-neutral-500 uppercase tracking-widest truncate">{user.branch_name}</p>
              </div>
            </div>
            <button
              onClick={() => logout(router)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-100 dark:hover:border-red-900/50 transition-all"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 md:ml-72 pt-16 md:pt-0 pb-24 md:pb-0 min-h-screen">
        <div className={isTerminal ? "w-full h-full" : "p-4 md:p-8 max-w-[1440px] mx-auto animate-in fade-in duration-500"}>
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white/90 dark:bg-black/90 backdrop-blur-2xl border-t border-gray-200 dark:border-neutral-800 z-[100] px-2 pt-2 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-none">
        <div className="flex justify-around items-center mb-2">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.path} className="flex-1 flex flex-col items-center gap-1 p-1">
                <div className={`relative p-2 rounded-xl transition-all duration-300 ${active ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-transparent'}`}>
                  <Icon size={22} className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-neutral-500'} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-bold transition-colors ${active ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-neutral-500'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}