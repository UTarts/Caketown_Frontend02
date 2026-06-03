"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Building2, Users, Settings, LogOut, Banknote, Sun, Moon,
  ChevronRight, Activity, CalendarDays, History, Menu, X, Shield, FileText, ChevronDown, CalendarRange
} from "lucide-react";
import { callApi, logout } from "@/lib/apiClient";

function AdminLayoutContent({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState("");
  const [branchesLoading, setBranchesLoading] = useState(true);

  const desktopProfileRef = useRef(null);
  const mobileProfileRef = useRef(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    const handleClickOutside = (event) => {
      const inDesktop = desktopProfileRef.current && desktopProfileRef.current.contains(event.target);
      const inMobile = mobileProfileRef.current && mobileProfileRef.current.contains(event.target);

      if (!inDesktop && !inMobile) {
        setProfileMenuOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const session = localStorage.getItem("caketown_session");
    if (!session) { router.push("/"); return; }
    try {
      const parsed = JSON.parse(session);
      if (parsed.role !== "admin") { router.push("/"); return; }
      setUser(parsed);
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    const fetchBranches = async () => {
      setBranchesLoading(true);
      const res = await callApi("get_branches");
      if (res.status === "success" && res.data?.length > 0) {
        const activeBranches = res.data;
        setBranches(activeBranches);
        
        const params = new URLSearchParams(window.location.search);
        let urlBranchId = params.get("branch_id");

        // STRICT LOGIC: The layout now ONLY acknowledges physical branches.
        if (!urlBranchId || !activeBranches.some(b => String(b.id) === urlBranchId)) {
          urlBranchId = String(activeBranches[0].id);
          if (!pathname.startsWith("/admin/settings") && !pathname.startsWith("/admin/reports")) {
            router.replace(`${pathname}?branch_id=${urlBranchId}`, { scroll: false });
          }
        }

        setActiveBranchId(urlBranchId);
      }
      setBranchesLoading(false);
    };
    fetchBranches();
  }, [pathname, router]);

  const handleBranchChange = (e) => {
    const newId = e.target.value;
    setActiveBranchId(newId);
    if (!pathname.startsWith("/admin/settings") && !pathname.startsWith("/admin/reports")) {
      router.push(`${pathname}?branch_id=${newId}`, { scroll: false });
    }
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = () => logout(router);

  if (!user) return null;

  const initials = user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  const globalNav = [
    { name: "Admin Dashboard", path: `/admin?branch_id=${activeBranchId}`, icon: LayoutDashboard, exact: true },
  ];

  const branchNav = [
    { name: "Live Floor", path: `/admin/live-floor?branch_id=${activeBranchId}`, icon: Activity },
    { name: "Employees & Profiles", path: `/admin/personnel?branch_id=${activeBranchId}`, icon: Users },
    { name: "Attendance Ledger", path: `/admin/attendance?branch_id=${activeBranchId}`, icon: CalendarDays },
    { name: "Payroll Engine", path: `/admin/payroll?branch_id=${activeBranchId}`, icon: Banknote },
    { name: "Financial Ledger", path: `/admin/finance?branch_id=${activeBranchId}`, icon: History },
  ];

  const settingsDropdown = [
    { name: "Branches", icon: Building2, targetTab: "branches" },
    { name: "Roles & Depts", icon: Building2, targetTab: "departments" },
    { name: "Administrators", icon: Shield, targetTab: "admins" },
    { name: "Leave Matrix", icon: CalendarRange, targetTab: "matrix" },
  ];

  const reportsDropdown = [
    { name: "Staff Payables", icon: FileText, targetTab: "payables" },
    { name: "Branch Finances", icon: Banknote, targetTab: "finances" },
    { name: "Attendance Pulse", icon: Activity, targetTab: "attendance" }
  ];

  const mobileBottomNav = [
    { name: "Overview", path: `/admin?branch_id=${activeBranchId}`, icon: LayoutDashboard, exact: true },
    { name: "Floor", path: `/admin/live-floor?branch_id=${activeBranchId}`, icon: Activity },
    { name: "Staff", path: `/admin/personnel?branch_id=${activeBranchId}`, icon: Users },
    { name: "Ledger", path: `/admin/attendance?branch_id=${activeBranchId}`, icon: CalendarDays },
  ];

  const isActive = (path, exact = false) => {
    if (exact) return pathname === path.split('?')[0];
    const baseNavPath = path.split('?')[0];
    return pathname.startsWith(baseNavPath);
  };

  const handleSettingsClick = (tab) => {
    setMobileMenuOpen(false);
    router.push(`/admin/settings?tab=${tab}`, { scroll: false });
  };

  const handleReportsClick = (tab) => {
    setMobileMenuOpen(false);
    router.push(`/admin/reports?tab=${tab}`, { scroll: false });
  };

  const renderSidebarContent = (menuRef) => (
    <>
      <div className="h-24 w-full bg-white shadow-[0_2px_15px_rgba(0,0,0,0.03)] shrink-0 flex flex-col justify-center px-6 relative z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)' }}>
        <img src="/logo.png" alt="Caketown" className="h-10 w-auto object-contain object-center" onError={(e) => { e.target.style.display = 'none'; }} />
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-6">
        <div>
          <p className="px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Global Administration</p>
          <div className="space-y-1">
            {globalNav.map(item => {
              const active = isActive(item.path, item.exact);
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.path} scroll={false} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${active ? "bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white" : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"}`}>
                  <Icon size={16} className={active ? 'text-gray-900 dark:text-white' : ''} strokeWidth={active ? 2.5 : 2} />
                  <span className="flex-1">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-3">
          <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1.5"><Building2 size={12} /> Active Branch</p>
          <div className="relative">
            {branchesLoading ? (
              <div className="h-10 flex items-center justify-center text-xs text-emerald-600 font-bold animate-pulse bg-white dark:bg-black rounded-xl">Loading...</div>
            ) : branches.length === 0 ? (
              <div className="h-10 flex items-center justify-center text-xs text-red-500 font-bold bg-white dark:bg-black rounded-xl border border-red-100 dark:border-red-900/50">No Branches Setup</div>
            ) : (
              <select value={activeBranchId} onChange={handleBranchChange} className="w-full bg-white dark:bg-black border border-emerald-100 dark:border-emerald-900/50 text-sm font-black text-gray-900 dark:text-white px-3 py-2.5 rounded-xl outline-none cursor-pointer appearance-none truncate shadow-sm">
                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            )}
            {!branchesLoading && branches.length > 0 && <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
          </div>
        </div>

        <div>
          <p className="px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Branch Operations</p>
          <div className="space-y-1">
            {branchNav.map(item => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.path} scroll={false} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${active ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"}`}>
                  <Icon size={16} className={active ? 'text-emerald-600 dark:text-emerald-400' : ''} strokeWidth={active ? 2.5 : 2} />
                  <span className="flex-1">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p className="px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">System Config</p>
          <div className="space-y-1">
            <div>
              <button onClick={() => setSettingsOpen(!settingsOpen)} className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${pathname.startsWith('/admin/settings') ? "bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white" : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"}`}>
                <div className="flex items-center gap-3">
                  <Settings size={16} className={pathname.startsWith('/admin/settings') ? 'text-gray-900 dark:text-white' : ''} strokeWidth={pathname.startsWith('/admin/settings') ? 2.5 : 2} />
                  <span>Master Settings</span>
                </div>
                <ChevronDown size={14} className={`transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
              </button>
              {settingsOpen && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-gray-100 dark:border-neutral-800 space-y-1 overflow-hidden animate-in slide-in-from-top-2">
                  {settingsDropdown.map(item => (
                    <button key={item.targetTab} onClick={() => handleSettingsClick(item.targetTab)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white text-left">
                      <item.icon size={14} /> {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <button onClick={() => setReportsOpen(!reportsOpen)} className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${pathname.startsWith('/admin/reports') ? "bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white" : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"}`}>
                <div className="flex items-center gap-3">
                  <FileText size={16} className={pathname.startsWith('/admin/reports') ? 'text-gray-900 dark:text-white' : ''} strokeWidth={pathname.startsWith('/admin/reports') ? 2.5 : 2} />
                  <span>Global Reports</span>
                </div>
                <ChevronDown size={14} className={`transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`} />
              </button>
              {reportsOpen && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-gray-100 dark:border-neutral-800 space-y-1 overflow-hidden animate-in slide-in-from-top-2">
                  {reportsDropdown.map(item => (
                    <button key={item.targetTab} onClick={() => handleReportsClick(item.targetTab)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white text-left">
                      <item.icon size={14} /> {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-neutral-800 shrink-0 bg-white dark:bg-black z-10 flex items-center justify-between relative" ref={menuRef}>
        <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-neutral-900 p-1.5 rounded-xl transition-colors text-left min-w-0 flex-1 outline-none">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-200 dark:border-emerald-800 shrink-0">
            {initials}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-black text-gray-900 dark:text-white truncate">{user.name}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate flex items-center gap-1"><Shield size={10} /> Admin</p>
          </div>
        </button>

        <div className="shrink-0 flex flex-col items-end justify-center pl-2 border-l border-gray-100 dark:border-neutral-800">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Powered By</span>
          <a href="https://www.utarts.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            <img src="https://tzaxthrqwfgbrcqmtuec.supabase.co/storage/v1/object/public/images/UTArt_Logo.webp" alt="UT Arts" className="h-5 w-5 rounded-full object-cover border border-gray-200 dark:border-neutral-700" />
            <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">UT Arts</span>
          </a>
        </div>

        <div className={`absolute bottom-[110%] left-4 right-4 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl p-2 mb-2 transition-all duration-200 z-[9999] origin-bottom ${profileMenuOpen ? 'opacity-100 pointer-events-auto scale-100 translate-y-0' : 'opacity-0 pointer-events-none scale-95 translate-y-2'}`}>
          <button onClick={() => { toggleTheme(); setProfileMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
            {dark ? <Sun size={16} /> : <Moon size={16} />} Switch to {dark ? "Light" : "Dark"} Mode
          </button>
          <div className="h-px bg-gray-100 dark:bg-neutral-900 my-1"></div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
            <LogOut size={16} /> Secure Logout
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] selection:bg-emerald-500 selection:text-white flex overflow-x-hidden">

      {/* ── Mobile Top Header ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-neutral-800 h-16 flex items-center justify-between shadow-sm pl-[140px] pr-4">
        <div className="absolute top-0 left-0 h-16 w-[130px] bg-white shadow-[2px_0_10px_rgba(0,0,0,0.1)] z-10 flex flex-col justify-center px-4" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>
          <img src="/logo.png" alt="Caketown" className="h-5 w-auto object-contain object-left" onError={(e) => { e.target.style.display = 'none'; }} />
          <span className="text-[8px] text-emerald-600 font-black uppercase tracking-widest mt-0.5">Admin</span>
        </div>
        
        <div className="flex-1 flex justify-end mr-3">
          <div className="relative w-full max-w-[140px]">
            {branchesLoading ? (
              <div className="h-8 flex items-center justify-center text-[10px] text-emerald-600 font-bold animate-pulse bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">Loading...</div>
            ) : branches.length === 0 ? (
              <div className="h-8 flex items-center justify-center text-[10px] text-red-500 font-bold bg-white dark:bg-black rounded-lg border border-red-100 dark:border-red-900/50">No Branches</div>
            ) : (
              <select value={activeBranchId} onChange={handleBranchChange} className="w-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 text-[11px] font-black text-emerald-700 dark:text-emerald-400 pl-2 pr-6 py-1.5 rounded-lg outline-none appearance-none truncate shadow-sm">
                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
              </select>
            )}
            {!branchesLoading && branches.length > 0 && <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-500 pointer-events-none" />}
          </div>
        </div>

        <div className="z-20 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-200 dark:border-emerald-800 shadow-sm shrink-0">
          {initials}
        </div>
      </div>

      {/* ── Mobile Slide-out Drawer ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative w-4/5 max-w-sm bg-white dark:bg-black h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
            <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-neutral-900 rounded-full z-[150] text-gray-600 dark:text-neutral-400"><X size={20} /></button>
            {renderSidebarContent(mobileProfileRef)}
          </div>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-72 bg-white dark:bg-[#050505] border-r border-gray-200 dark:border-neutral-800 flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        {renderSidebarContent(desktopProfileRef)}
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 md:ml-72 pt-16 md:pt-0 min-h-screen relative z-0 pb-28 md:pb-0 overflow-x-hidden w-0 md:w-auto min-w-0">
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-300">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Navbar ── */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-6 duration-500 pb-safe">
        <div className="bg-white/85 dark:bg-[#0a0a0a]/85 backdrop-blur-2xl border border-gray-200/60 dark:border-neutral-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl p-2 flex items-center justify-between">
          {mobileBottomNav.map((item) => {
            const active = isActive(item.path, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.path}
                scroll={false}
                className="relative flex-1 flex flex-col items-center justify-center p-2 rounded-2xl group transition-all"
              >
                {active && (
                  <span className="absolute inset-0 bg-emerald-50 dark:bg-emerald-500/20 rounded-2xl -z-10 animate-in zoom-in-90 duration-200"></span>
                )}
                <Icon size={20} className={`mb-1 transition-colors ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-neutral-400'}`} strokeWidth={active ? 2.5 : 2} />
                <span className={`text-[9px] font-black tracking-wide ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-neutral-500'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="relative flex-1 flex flex-col items-center justify-center p-2 rounded-2xl transition-all"
          >
            <Menu size={20} className="mb-1 text-gray-500 dark:text-neutral-400" strokeWidth={2} />
            <span className="text-[9px] font-black tracking-wide text-gray-500 dark:text-neutral-500">More</span>
          </button>
        </div>
      </div>

    </div>
  );
}

export default function AdminLayoutWrapper({ children }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-black"><div className="animate-pulse font-bold text-gray-500">Loading Configuration...</div></div>}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}