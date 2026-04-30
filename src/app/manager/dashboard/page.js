"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Activity,
  Banknote,
  Clock3,
  FileText,
  Loader2,
  Plus,
  ScanFace,
  Users,
  Wallet,
  CheckCircle2,
  Coffee,
} from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0h 0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function elapsedSince(isoString) {
  return Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
}

function LiveTimer({ punchTime }) {
  const [seconds, setSeconds] = useState(elapsedSince(punchTime));

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(elapsedSince(punchTime));
    }, 1000);
    return () => clearInterval(id);
  }, [punchTime]);

  return (
    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
      {pad(Math.floor(seconds / 3600))}:{pad(Math.floor((seconds % 3600) / 60))}:{pad(seconds % 60)}
    </span>
  );
}

function hasPermission(permissions, key, mode = "read") {
  if (!key) return true;
  const p = permissions?.[key];
  return !!p?.[mode];
}

export default function ManagerDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const [session, setSession] = useState(null);
  const [branchData, setBranchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);

  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [advanceForm, setAdvanceForm] = useState({
    type: "pre_advance",
    amount: "",
    remarks: "",
  });
  const [submittingAdvance, setSubmittingAdvance] = useState(false);

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

  const fetchBranchMaster = async () => {
    if (!session?.branch_id) return;
    setLoading(true);
    const res = await callApi("get_branch_master", { branch_id: session.branch_id });
    if (res.status === "success") {
      setBranchData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session?.branch_id) {
      fetchBranchMaster();
    }
  }, [session]);

  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    if (!advanceTarget) return;
    setSubmittingAdvance(true);

    const res = await callApi("log_advance", {
      user_id: advanceTarget.id,
      branch_id: session.branch_id,
      type: advanceForm.type,
      amount: advanceForm.amount,
      remarks: advanceForm.remarks,
      logged_by: session.id,
    });

    if (res.status === "success") {
      setAdvanceTarget(null);
      setAdvanceForm({ type: "pre_advance", amount: "", remarks: "" });
    } else {
      alert(res.message || "Unable to log transaction.");
    }

    setSubmittingAdvance(false);
  };

  if (!session || loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={34} />
      </div>
    );
  }

  const livePunches = branchData?.live_punches || [];
  const staff = branchData?.staff || [];
  const onFloorCount = livePunches.filter((p) => p.is_active).length;
  const onBreakCount = livePunches.filter((p) => p.on_break).length;

  const tabs = [
    { id: "overview", label: "Live Floor", show: true },
    { id: "finance", label: "Finance", show: hasPermission(permissions, "view_payroll") || hasPermission(permissions, "log_advance", "write") },
    { id: "staff", label: "Staff", show: hasPermission(permissions, "view_staff_list") },
  ].filter((t) => t.show);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            Manager Dashboard
          </p>
          <h1 className="text-3xl font-black text-black dark:text-white">
            {session.branch_name || "Branch Command"}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Live floor monitoring, branch finance controls, and manager tools.
          </p>
        </div>

        {hasPermission(permissions, "manage_terminal", "write") && (
          <button
            onClick={() => router.push("/manager/terminal")}
            className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-emerald-500/20"
          >
            <ScanFace size={18} />
            Open Terminal
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Branch Staff", value: staff.length, icon: Users, color: "text-black dark:text-white" },
          { label: "On Floor", value: onFloorCount, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "On Break", value: onBreakCount, icon: Coffee, color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Off Duty", value: staff.length - onFloorCount, icon: Clock3, color: "text-gray-500" },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-900 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{card.label}</p>
              <card.icon size={16} className="text-gray-400" />
            </div>
            <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto custom-scrollbar border-b border-gray-200 dark:border-neutral-900 pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setTab(item.id);
              router.push(`/manager/dashboard?tab=${item.id}`);
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              tab === item.id
                ? "bg-emerald-500 text-white"
                : "bg-white dark:bg-black border border-gray-200 dark:border-neutral-900 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          {!hasPermission(permissions, "view_live_attendance") ? (
            <div className="rounded-2xl border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/10 p-6 text-sm text-yellow-700 dark:text-yellow-300 font-bold">
              You do not currently have permission to view live attendance.
            </div>
          ) : livePunches.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black p-10 text-center text-gray-400">
              No live attendance activity right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {livePunches.map((punch, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-5 bg-white dark:bg-black shadow-sm ${
                    punch.is_active
                      ? "border-emerald-300 dark:border-emerald-800"
                      : "border-gray-200 dark:border-neutral-900 opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-black text-sm text-black dark:text-white">{punch.name}</p>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">
                        {punch.role}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        punch.is_active
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                          : "bg-gray-100 dark:bg-neutral-900 text-gray-500"
                      }`}
                    >
                      {punch.is_active ? "Active" : "Off"}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-bold">First In</span>
                      <span className="font-mono font-bold">
                        {punch.first_punch
                          ? new Date(punch.first_punch).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>

                    {punch.is_active && punch.last_punch ? (
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-bold">Session Running</span>
                        <LiveTimer punchTime={punch.last_punch} />
                      </div>
                    ) : null}

                    <div className="flex justify-between border-t border-gray-100 dark:border-neutral-900 pt-2">
                      <span className="text-gray-400 font-bold">Total Today</span>
                      <span className="font-mono font-black">{formatDuration(punch.total_seconds)}</span>
                    </div>

                    {parseFloat(punch.break_seconds || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-yellow-600 font-bold">Break</span>
                        <span className="font-mono font-bold text-yellow-600">
                          {formatDuration(punch.break_seconds)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "finance" && (
        <div className="space-y-4">
          {!hasPermission(permissions, "view_payroll") && !hasPermission(permissions, "log_advance", "write") ? (
            <div className="rounded-2xl border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/10 p-6 text-sm text-yellow-700 dark:text-yellow-300 font-bold">
              You do not currently have finance access.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet size={16} className="text-orange-500" />
                    <h3 className="text-sm font-black">Quick Finance Actions</h3>
                  </div>
                  <div className="space-y-3 text-sm text-gray-500">
                    <p>Use this section to log employee advances, shop advance, shop bills, and urgent finance remarks.</p>
                    <p>All entries should be timestamped by the backend and visible to admin later.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={16} className="text-blue-500" />
                    <h3 className="text-sm font-black">Manager Finance Scope</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-500">
                    <li>• Log pre-advance or emergency branch expenses.</li>
                    <li>• Open terminal directly if terminal permission exists.</li>
                    <li>• Review branch live floor and assigned staff list.</li>
                  </ul>
                </div>
              </div>

              {hasPermission(permissions, "log_advance", "write") ? (
                <div className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-neutral-900">
                    <h3 className="text-sm font-black flex items-center gap-2">
                      <Banknote size={16} className="text-emerald-500" />
                      Log Branch Transaction
                    </h3>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {staff.map((employee) => (
                        <button
                          key={employee.id}
                          onClick={() => setAdvanceTarget(employee)}
                          className="text-left rounded-2xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black hover:border-emerald-500 p-4 transition-colors"
                        >
                          <p className="font-black text-sm text-black dark:text-white">{employee.name}</p>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">
                            {employee.role}
                          </p>
                          <p className="text-xs text-gray-500 mt-3 inline-flex items-center gap-2">
                            <Plus size={12} />
                            Log Transaction
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {tab === "staff" && (
        <div className="space-y-4">
          {!hasPermission(permissions, "view_staff_list") ? (
            <div className="rounded-2xl border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/10 p-6 text-sm text-yellow-700 dark:text-yellow-300 font-bold">
              You do not currently have permission to view the branch staff directory.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {staff.map((employee) => (
                <div
                  key={employee.id}
                  className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-sm text-black dark:text-white">{employee.name}</p>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-1">
                        {employee.role}
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-neutral-900 text-gray-500">
                      ID #{String(employee.id).padStart(4, "0")}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Mobile</span>
                      <span className="font-mono font-bold">{employee.mobile_number || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Salary</span>
                      <span className="font-mono font-bold">
                        ₹{parseFloat(employee.monthly_fixed_salary || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shift</span>
                      <span className="font-mono font-bold">
                        {employee.standard_shift_hours || 0}h
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {advanceTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="w-full md:max-w-md rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-900 shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-neutral-900 flex items-center justify-between">
              <h2 className="text-lg font-black">Log Transaction</h2>
              <button
                onClick={() => setAdvanceTarget(null)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAdvanceSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-sm font-bold text-gray-500">
                  Employee:{" "}
                  <span className="text-black dark:text-white">{advanceTarget.name}</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Type
                </label>
                <select
                  value={advanceForm.type}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, type: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
                >
                  <option value="pre_advance">Pre Advance</option>
                  <option value="final_advance">Final Advance</option>
                  <option value="shop_advance">Shop Advance</option>
                  <option value="shop_bill">Shop Bill</option>
                  <option value="deduction">Deduction / Fine</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Amount
                </label>
                <input
                  type="number"
                  min="1"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm font-mono font-bold outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Remarks
                </label>
                <textarea
                  value={advanceForm.remarks}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, remarks: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-black px-4 py-3 text-sm outline-none focus:border-emerald-500 h-24 resize-none"
                  placeholder="Optional note..."
                />
              </div>

              <button
                type="submit"
                disabled={submittingAdvance}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 transition-colors disabled:opacity-50"
              >
                {submittingAdvance ? <Loader2 size={18} className="animate-spin" /> : <Banknote size={18} />}
                Save Transaction
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
