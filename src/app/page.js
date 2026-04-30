"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import { Smartphone, Lock, Loader2, LogIn, AlertCircle } from "lucide-react";

export default function SystemLogin() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [formData, setFormData] = useState({
    mobile_number: "",
    password: ""
  });

  // Optional: Auto-redirect if already logged in (checks local storage)
  useEffect(() => {
    const session = localStorage.getItem("caketown_session");
    if (session) {
      const user = JSON.parse(session);
      routeBasedOnRole(user.role);
    }
  }, []);

  const routeBasedOnRole = (role) => {
    if (role === "admin") {
      router.push("/admin"); 
    } else if (role === "manager") {
      router.push("/manager/dashboard"); 
    } else {
      router.push("/staff/portal");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    
    if (!formData.mobile_number || !formData.password) {
      setErrorMessage("Please enter both mobile number and password.");
      return;
    }

    setIsSubmitting(true);
    
    // Call the login endpoint we built in api.php
    const res = await callApi("login", formData);
    
    if (res.status === "success") {
      // Store the user session securely in the browser
      localStorage.setItem("caketown_session", JSON.stringify(res.user));
      // Route them to the correct area
      routeBasedOnRole(res.user.role);
    } else {
      setErrorMessage(res.message || "Authentication failed.");
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#050505] p-6 font-sans selection:bg-emerald-500/30">
      <div className="w-full max-w-md">
        
        {/* Logo / Header Area */}
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-sm mb-4">
             <LogIn className="text-emerald-600 dark:text-emerald-500" size={32} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Caketown ERP</h1>
          <p className="text-gray-500 dark:text-neutral-400 text-sm font-medium uppercase tracking-widest">
            System Authentication
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-neutral-900/80 border border-gray-200 dark:border-neutral-800 rounded-3xl p-8 shadow-xl dark:shadow-none backdrop-blur-xl">
          
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest">Mobile Number</label>
              <div className="relative">
                <Smartphone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" />
                <input 
                  type="tel" 
                  value={formData.mobile_number}
                  onChange={(e) => setFormData({...formData, mobile_number: e.target.value})}
                  placeholder="Enter registered mobile" 
                  className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-4 pl-12 pr-4 text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest">Security Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" />
                <input 
                  type="password" 
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••" 
                  className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl py-4 pl-12 pr-4 text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium tracking-widest"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-black font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 mt-4 shadow-lg shadow-emerald-500/20"
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : "Authenticate"}
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <p className="text-center text-xs text-gray-400 dark:text-neutral-600 mt-8 font-medium">
          Secure Access Protocol &copy; {new Date().getFullYear()}
        </p>

      </div>
    </div>
  );
}