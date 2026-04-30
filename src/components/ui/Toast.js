// src/components/ui/Toast.js
"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = {
  success: { Icon: CheckCircle2, cls: "text-emerald-500" },
  error:   { Icon: XCircle,      cls: "text-red-500" },
  warning: { Icon: AlertCircle,  cls: "text-yellow-500" },
  info:    { Icon: Info,         cls: "text-blue-500" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          const { Icon, cls } = ICONS[t.type] || ICONS.info;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-xl px-4 py-3 animate-in slide-in-from-bottom-4 fade-in duration-300"
            >
              <Icon size={18} className={`shrink-0 mt-0.5 ${cls}`} />
              <p className="text-sm font-medium text-gray-800 dark:text-neutral-200 flex-1">{t.message}</p>
              <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors shrink-0">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx.addToast;
};
