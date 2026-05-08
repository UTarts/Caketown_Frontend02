"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Building2, Users, Settings, LogOut, Banknote, Sun, Moon, 
  ChevronRight, Activity, CalendarDays, History, Menu, X, UserCircle2, Shield, ExternalLink, FileText, ChevronDown
} from "lucide-react";
import { callApi, logout } from "@/lib/apiClient";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Global Context State
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState("");
  const [branchesLoading, setBranchesLoading] = useState(true);

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
      if (parsed.role !== "admin") { router.push("/"); return; }
      setUser(parsed);
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  // Fetch branches for the Global Switcher
  useEffect(() => {
    const fetchBranches = async () => {
      setBranchesLoading(true);
      const res = await callApi("get_branches");
      if (res.status === "success" && res.data?.length > 0) {
        
        // FIX: Removed strict filter so all returned branches display correctly
        const activeBranches = res.data; 
        setBranches(activeBranches);
        
        // Auto-select logic: Check URL first, then fallback to first branch
        const urlBranchId = searchParams.get("branch_id");
        if (urlBranchId && activeBranches.some(b => String(b.id) === urlBranchId)) {
          setActiveBranchId(urlBranchId);
        } else if (activeBranches.length > 0) {
          const defaultId = String(activeBranches[0].id);
          setActiveBranchId(defaultId);
          // If on a branch-specific page without an ID, force redirect to set the ID
          if (pathname !== "/admin" && pathname !== "/admin/settings" && pathname !== "/admin/reports" && pathname !== "/admin/profile") {
             router.replace(`${pathname}?branch_id=${defaultId}`);
          }
        }
      }
      setBranchesLoading(false);
    };
    fetchBranches();
  }, [pathname, searchParams, router]);

  const handleBranchChange = (e) => {
    const newId = e.target.value;
    setActiveBranchId(newId);
    
    // If the user is currently on a branch-specific page, update the URL parameter
    if (pathname !== "/admin" && pathname !== "/admin/settings" && pathname !== "/admin/reports" && pathname !== "/admin/profile") {
      router.push(`${pathname}?branch_id=${newId}`);
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

  // ─── ENTERPRISE NAVIGATION STRUCTURE ───
  const globalNav = [
    { name: "System Overview", path: "/admin", icon: LayoutDashboard, exact: true },
    { name: "Master Settings", path: "/admin/settings", icon: Settings },
    { name: "Global Reports", path: "/admin/reports", icon: FileText },
  ];

  const branchNav = [
    { name: "Live Floor", path: `/admin/live-floor?branch_id=${activeBranchId}`, icon: Activity },
    { name: "Personnel & Profiles", path: `/admin/personnel?branch_id=${activeBranchId}`, icon: Users },
    { name: "Attendance Ledger", path: `/admin/attendance?branch_id=${activeBranchId}`, icon: CalendarDays },
    { name: "Payroll Engine", path: `/admin/payroll?branch_id=${activeBranchId}`, icon: Banknote },
    { name: "Financial Ledger", path: `/admin/finance?branch_id=${activeBranchId}`, icon: History },
  ];

  const isActive = (path, exact = false) => {
    if (exact) return pathname === path;
    const baseNavPath = path.split('?')[0];
    return pathname.startsWith(baseNavPath);
  };

  const SidebarContent = () => (
    <>
      {/* Premium Diagonal Logo Container */}
      <div className="h-24 w-full bg-white shadow-[0_2px_15px_rgba(0,0,0,0.03)] shrink-0 flex flex-col justify-center px-6 relative z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)' }}>
         <img src="/logo.png" alt="Caketown" className="h-10 w-auto object-contain object-center" />
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-6">
        
        {/* Global Section Pushed to Top */}
        <div>
          <p className="px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Global Administration</p>
          <div className="space-y-1">
            {globalNav.map(item => {
              const active = isActive(item.path, item.exact);
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.path} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${active ? "bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white" : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-gray-900 dark:hover:text-white"}`}>
                  <Icon size={16} className={active ? 'text-gray-900 dark:text-white' : ''} strokeWidth={active ? 2.5 : 2} />
                  <span className="flex-1">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Dynamic Branch Context Switcher */}
        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-3">
          <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1.5"><Building2 size={12}/> Active Context</p>
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

        {/* Branch Operations */}
        <div>
          <p className="px-3 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Branch Operations</p>
          <div className="space-y-1">
            {branchNav.map(item => {
              const active = isActive(item.path);
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
        
        {/* User Avatar Clickable */}
        <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-neutral-900 p-1.5 rounded-xl transition-colors text-left min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black text-sm border border-blue-200 dark:border-blue-800 shrink-0">
            {initials}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-black text-gray-900 dark:text-white truncate">{user.name}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate flex items-center gap-1"><Shield size={10}/> Admin</p>
          </div>
        </button>

        {/* UT Arts Branding */}
        <div className="shrink-0 flex flex-col items-end justify-center pl-2 border-l border-gray-100 dark:border-neutral-800">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Powered By</span>
          <a href="https://www.utarts.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            <img src="https://tzaxthrqwfgbrcqmtuec.supabase.co/storage/v1/object/public/images/UTArt_Logo.webp" alt="UT Arts" className="h-5 w-5 rounded-full object-cover border border-gray-200 dark:border-neutral-700" />
            <span className="font-black text-xs text-blue-600 dark:text-blue-400">UT Arts</span>
          </a>
        </div>

        {/* Pop-up Profile Menu */}
        {profileMenuOpen && (
          <div className="absolute bottom-[110%] left-4 right-4 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl p-2 mb-2 animate-in slide-in-from-bottom-2 duration-200 z-50">
            <Link href="/admin/profile" onClick={() => setProfileMenuOpen(false)} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
              <UserCircle2 size={16} /> Profile Settings
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] selection:bg-emerald-500 selection:text-white flex">

      {/* ── Mobile Top Header ──────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-neutral-800 h-16 flex items-center justify-between shadow-sm px-4">
        {/* Mobile Diagonal Logo Container */}
        <div className="absolute top-0 left-0 h-16 w-48 bg-white shadow-[2px_0_10px_rgba(0,0,0,0.1)] z-10 flex flex-col justify-center px-4" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' }}>
          <img src="/logo.png" alt="Caketown" className="h-6 w-auto object-contain object-left" />
          <span className="text-[8px] text-emerald-600 font-black uppercase tracking-widest mt-0.5">Admin</span>
        </div>
        <div className="flex-1"></div>
        
        <div className="flex items-center gap-2 z-20">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2.5 rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors">
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* ── Mobile Slide-out Drawer ──────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
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
      <main className="flex-1 md:ml-72 pt-16 md:pt-0 min-h-screen relative z-0">
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
          {children}
        </div>
      </main>

    </div>
  );
}