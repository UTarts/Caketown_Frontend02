"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, LogOut, Banknote, Sun, Moon,
  Activity, CalendarDays, History, Menu, X, UserCircle2, Shield, ScanFace, MonitorPlay, MapPin, Wallet
} from "lucide-react";
import { logout } from "@/lib/apiClient";
import { canRead } from "@/lib/permissions";

export default function ManagerLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const profileMenuRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem("caketown_session");
    if (!session) { router.push("/"); return; }

    try {
      const parsed = JSON.parse(session);
      if (parsed.role !== "manager") { router.push("/"); return; }
      setUser(parsed);
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  // ─── Close mobile menu & profile menu on route change ───
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  // ─── Lock body scroll when mobile drawer is open ───
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = () => logout(router);

  if (!user) return null;

  const initials = user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  // ─── NORMALIZE PERMISSIONS (handles any key the session stores them under) ───
  const featurePermissions =
    user.feature_permissions ||
    user.featurepermissions ||
    user.permissions ||
    {};

  // ─── RBAC MANAGER NAVIGATION ───
  const ALL_NAV_ITEMS = [
    { name: "Dashboard",      path: "/manager/dashboard",  icon: LayoutDashboard, perm: null,                      exact: true },
    { name: "Live Floor",     path: "/manager/live-floor", icon: Activity,        perm: "view_live_attendance" },
    { name: "Terminal Ops",   path: "/manager/terminal",   icon: MonitorPlay,     perm: "manage_terminal" },
    { name: "Staff Roster",   path: "/manager/staff",      icon: Users,           perm: "view_staff_list" },
    { name: "Attendance",     path: "/manager/attendance", icon: CalendarDays,    perm: "view_attendance_history" },
    { name: "Payroll",        path: "/manager/payroll",    icon: Banknote,        perm: "view_payroll" },
    { name: "Finance Ledger", path: "/manager/finance",    icon: Wallet,          perm: "view_finance_ledger" },
    { name: "System Logs",    path: "/manager/system",     icon: History,         perm: "view_system_logs" },
  ];

  const authorizedNavItems = ALL_NAV_ITEMS.filter(item =>
    item.perm === null || canRead(featurePermissions, item.perm)
  );

  const isActive = (path, exact = false) => {
    if (exact) return pathname === path;
    const baseNavPath = path.split('?')[0];
    return pathname.startsWith(baseNavPath);
  };

  const SidebarContent = () => (
    <>
      {/* Premium Diagonal Logo Container */}
      <div className="h-24 w-full bg-white shadow-[0_2px_15px_rgba(0,0,0,0.03)] shrink-0 flex flex-col justify-center px-6 relative z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)' }}>
        <img src="/logo.png" alt="Caketown" className="h-10 w-auto object-contain object-center" onError={(e) => { e.target.style.display='none'; }}/>
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-6">
        <div>
          <p className="px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Branch Operations</p>
          <div className="space-y-1">
            {authorizedNavItems.map(item => {
              const active = isActive(item.path, item.exact);
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.path} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${active ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400" : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"}`}>
                  <Icon size={16} className={active ? 'text-blue-600 dark:text-blue-400' : ''} strokeWidth={active ? 2.5 : 2} />
                  <span className="flex-1">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-neutral-800 shrink-0 bg-white dark:bg-black z-10 flex items-center justify-between relative" ref={profileMenuRef}>
        <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-neutral-900 p-1.5 rounded-xl transition-colors text-left min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-sm border border-blue-200 dark:border-blue-800 shrink-0">
            {initials}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-black text-gray-900 dark:text-white truncate">{user.name}</p>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest truncate flex items-center gap-1"><MapPin size={10}/> {user.branch_name || "Manager"}</p>
          </div>
        </button>

        <div className="shrink-0 flex flex-col items-end justify-center pl-2 border-l border-gray-100 dark:border-neutral-800">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Powered By</span>
          <a href="https://www.utarts.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            <img src="https://tzaxthrqwfgbrcqmtuec.supabase.co/storage/v1/object/public/images/UTArt_Logo.webp" alt="UT Arts" className="h-5 w-5 rounded-full object-cover border border-gray-200 dark:border-neutral-700" />
            <span className="font-black text-xs text-blue-600 dark:text-blue-400">UT Arts</span>
          </a>
        </div>

        {profileMenuOpen && (
          <div className="absolute bottom-[110%] left-4 right-4 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl p-2 mb-2 animate-in slide-in-from-bottom-2 duration-200 z-50">
            <Link href="/manager/profile" onClick={() => setProfileMenuOpen(false)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
              <UserCircle2 size={16} /> My Personal Profile
            </Link>
            <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
              {dark ? <Sun size={16} /> : <Moon size={16} />} Switch to {dark ? "Light" : "Dark"} Mode
            </button>
            <div className="h-px bg-gray-100 dark:bg-neutral-900 my-1"></div>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <LogOut size={16} /> Secure Logout
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] selection:bg-blue-500 selection:text-white flex overflow-x-hidden">

      {/* ── Mobile Top Header ──────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-neutral-800 h-16 flex items-center justify-between shadow-sm px-4">
        <div className="absolute top-0 left-0 h-16 w-48 bg-white shadow-[2px_0_10px_rgba(0,0,0,0.1)] z-10 flex flex-col justify-center px-4" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>
          <img src="/logo.png" alt="Caketown" className="h-6 w-auto object-contain object-left" onError={(e) => { e.target.style.display='none'; }} />
          <span className="text-[8px] text-blue-600 font-black uppercase tracking-widest mt-0.5">Manager</span>
        </div>

        <div className="flex-1"></div>
        <Link href="/manager/profile" className="z-20 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-xs border border-blue-200 dark:border-blue-800 shadow-sm">
          {initials}
        </Link>
      </div>

      {/* ── Mobile Slide-out Drawer ──────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-4/5 max-w-sm bg-white dark:bg-black h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
            <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-neutral-900 rounded-full z-50 text-gray-600 dark:text-neutral-400"><X size={20}/></button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* ── Desktop Sidebar ────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-72 bg-white dark:bg-[#050505] border-r border-gray-200 dark:border-neutral-800 flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <SidebarContent />
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="flex-1 md:ml-72 pt-16 md:pt-0 min-h-screen relative z-0 pb-28 md:pb-0 min-w-0 overflow-x-hidden w-full">
        <div className="p-3 sm:p-4 md:p-8 w-full min-w-0 overflow-x-hidden animate-in fade-in duration-500">
          {children}
        </div>
      </main>

      {/* ── HIGH-END MOBILE BOTTOM NAVBAR (Glassmorphic) ──────────────── */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-6 duration-500 pb-safe">
        <div className="bg-white/85 dark:bg-[#0a0a0a]/85 backdrop-blur-2xl border border-gray-200/60 dark:border-neutral-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl p-2 flex items-center justify-between">

          {/* Render top 4 authorized items */}
          {authorizedNavItems.slice(0, 4).map((item) => {
            const active = isActive(item.path, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.path}
                className="relative flex-1 flex flex-col items-center justify-center p-2 rounded-2xl group transition-all"
              >
                {active && (
                  <span className="absolute inset-0 bg-blue-50 dark:bg-blue-500/20 rounded-2xl -z-10 animate-in zoom-in-90 duration-200"></span>
                )}
                <Icon size={20} className={`mb-1 transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-neutral-400'}`} strokeWidth={active ? 2.5 : 2} />
                <span className={`text-[9px] font-black tracking-wide ${active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-neutral-500'}`}>
                  {item.name.split(" ")[0]}
                </span>
              </Link>
            );
          })}

          {/* "More" trigger if more than 4 items */}
          {authorizedNavItems.length > 4 && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="relative flex-1 flex flex-col items-center justify-center p-2 rounded-2xl transition-all"
            >
              <Menu size={20} className="mb-1 text-gray-500 dark:text-neutral-400" strokeWidth={2} />
              <span className="text-[9px] font-black tracking-wide text-gray-500 dark:text-neutral-500">
                More
              </span>
            </button>
          )}

        </div>
      </div>

    </div>
  );
}