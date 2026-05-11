"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function StaffLayout({ children }) {
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) {
      router.push("/");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      // Allow managers to access it too, so they can test/see their own profile
      if (parsed.role !== "staff" && parsed.role !== "manager") {
        router.push("/");
        return;
      }
      setSession(parsed);
      
      const saved = localStorage.getItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = saved ? saved === "dark" : prefersDark;
      document.documentElement.classList.toggle("dark", isDark);
    } catch {
      router.push("/");
    }
  }, [router]);

  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#050505] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} strokeWidth={2.5} />
        <div className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Initializing App...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#050505] selection:bg-blue-500 selection:text-white relative font-sans">
      <main className="w-full min-w-0 max-w-full">
        {children}
      </main>
    </div>
  );
}