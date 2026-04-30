"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Banknote,
  CalendarDays,
  Clock3,
  FileText,
  Loader2,
  UserCircle2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";

function hasPermission(permissions, key, mode = "read") {
  if (!key) return true;
  const p = permissions?.[key];
  return !!p?.[mode];
}

function markerStyle(status) {
  switch (status) {
    case "P":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300";
    case "H":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300";
    case "N":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300";
    case "A":
      return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-500 dark:bg-neutral-900 dark:text-neutral-400";
  }
}

export default function StaffPortalPage() {
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [attendance, setAttendance] = useState([]);
  const [finance, setFinance] = useState(null);
  const [profile, setProfile] = useState(null);

  const permissions = useMemo(() => session?.feature_permissions || {}, [session]);

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

  useEffect(() => {
    const load = async () => {
      if (!session?.id) return;
      setLoading(true);

      const requests = [callApi("get_user_profile", { user_id: session.id })];

      if (hasPermission(permissions, "view_attendance_history")) {
        requests.push(callApi("get_my_attendance", { user_id: session.id }));
      } else {
        requests.push(Promise.resolve(null));
      }

      if (hasPermission(permissions, "view_payroll") || hasPermission(permissions, "view_financial_history")) {
        requests.push(callApi("get_my_financials", { user_id: session.id }));
      } else {
        requests.push(Promise.resolve(null));
      }

      const [profileRes, attendanceRes, financeRes] = await Promise.all(requests);

      if (profileRes?.status === "success") setProfile(profileRes.data || null);
      if (attendanceRes?.status === "success") setAttendance(attendanceRes.data || []);
      if (financeRes?.status === "success") setFinance(financeRes.data || null);

      setLoading(false);
    };

    load();
  }, [session, permissions]);

  if (!session || loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={34} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Staff Portal
        </p>
        <h1 className="text-3xl font-black text-black dark:text-white">Welcome, {session.name}</h1>
        <p className="text-sm text-gray-500 mt-2">
          View your profile, attendance history, and financial information based on your assigned access.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <UserCircle2 size={16} className="text-emerald-500" />
            <h3 className="text-sm font-black">Profile</h3>
          </div>
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex justify-between gap-3">
              <span>Name</span>
              <span className="font-bold text-black dark:text-white">{profile?.name || session.name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Role</span>
              <span className="font-bold text-black dark:text-white">{profile?.role || session.role}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Branch</span>
              <span className="font-bold text-black dark:text-white">{profile?.branch_name || session.branch_name || "—"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Mobile</span>
              <span className="font-mono font-bold text-black dark:text-white">{profile?.mobile_number || "—"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Shift Hours</span>
              <span className="font-mono font-bold text-black dark:text-white">{profile?.standard_shift_hours || 0}h</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Monthly Salary</span>
              <span className="font-mono font-bold text-black dark:text-white">
                ₹{parseFloat(profile?.monthly_fixed_salary || 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-blue-500" />
            <h3 className="text-sm font-black">Access Summary</h3>
          </div>
          <div className="space-y-3 text-sm">
            {[
              { label: "Attendance History", allowed: hasPermission(permissions, "view_attendance_history") },
              { label: "Payroll View", allowed: hasPermission(permissions, "view_payroll") },
              { label: "Financial History", allowed: hasPermission(permissions, "view_financial_history") },
              { label: "Attendance Report Download", allowed: hasPermission(permissions, "download_attendance_report") },
              { label: "Salary Slip Download", allowed: hasPermission(permissions, "download_salary_slip") },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <span className="text-gray-500">{item.label}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-bold ${item.allowed ? "text-emerald-600" : "text-red-500"}`}>
                  {item.allowed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {item.allowed ? "Allowed" : "Blocked"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-purple-500" />
            <h3 className="text-sm font-black">Quick Overview</h3>
          </div>
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex justify-between">
              <span>Attendance Entries</span>
              <span className="font-black text-black dark:text-white">{attendance.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Month Payable</span>
              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                ₹{parseFloat(finance?.salary_to_pay || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Deduction</span>
              <span className="font-mono font-black text-red-500">
                ₹{parseFloat(finance?.deduction || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Advance</span>
              <span className="font-mono font-black text-orange-600 dark:text-orange-400">
                ₹{parseFloat(finance?.total_advance || 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex items-center gap-2">
          <CalendarDays size={16} className="text-emerald-500" />
          <h2 className="text-sm font-black">Attendance History</h2>
        </div>

        {!hasPermission(permissions, "view_attendance_history") ? (
          <div className="p-6 text-sm font-bold text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/10">
            You do not currently have permission to view attendance history.
          </div>
        ) : attendance.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No attendance history found.</div>
        ) : (
          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px] text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-neutral-900 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">First In</th>
                  <th className="p-4">Last Out</th>
                  <th className="p-4">Work Time</th>
                  <th className="p-4">Break Time</th>
                  <th className="p-4">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-900">
                {attendance.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/60 transition-colors">
                    <td className="p-4 text-sm font-bold text-black dark:text-white">
                      {item.work_date || item.date || "—"}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center justify-center min-w-[34px] px-2 py-1 rounded-lg text-xs font-black ${markerStyle(item.status)}`}>
                        {item.status || "—"}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-sm">{item.first_in || "—"}</td>
                    <td className="p-4 font-mono text-sm">{item.last_out || "—"}</td>
                    <td className="p-4 font-mono text-sm">{item.total_work || item.work_time || "—"}</td>
                    <td className="p-4 font-mono text-sm">{item.break_time || "—"}</td>
                    <td className="p-4 text-sm text-gray-500">{item.remark || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex items-center gap-2">
          <Banknote size={16} className="text-orange-500" />
          <h2 className="text-sm font-black">Financial Details</h2>
        </div>

        {!hasPermission(permissions, "view_payroll") && !hasPermission(permissions, "view_financial_history") ? (
          <div className="p-6 text-sm font-bold text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/10">
            You do not currently have permission to view financial details.
          </div>
        ) : !finance ? (
          <div className="p-10 text-center text-gray-400">No finance record found.</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-5">
            {[
              { label: "Pre Advance", value: finance.pre_advance || 0, color: "text-red-500", icon: Clock3 },
              { label: "Shop Bill", value: finance.shop_bill || 0, color: "text-orange-500", icon: FileText },
              { label: "Total Advance", value: finance.total_advance || 0, color: "text-orange-600 dark:text-orange-400", icon: Banknote },
              { label: "Salary To Pay", value: finance.salary_to_pay || 0, color: "text-emerald-600 dark:text-emerald-400", icon: Banknote },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{card.label}</p>
                  <card.icon size={15} className="text-gray-400" />
                </div>
                <p className={`font-mono font-black text-2xl ${card.color}`}>
                  ₹{parseFloat(card.value || 0).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
