// src/lib/permissions.js

export const ALL_PERMISSIONS = [
  { id: "view_live_attendance", category: "Attendance", label: "View Live Attendance Floor" },
  { id: "view_attendance_history", category: "Attendance", label: "View Attendance History" },
  { id: "edit_attendance", category: "Attendance", label: "Edit / Override Attendance Records" },

  { id: "manage_terminal", category: "Terminal", label: "Operate Biometric Punch Terminal" },
  { id: "register_face", category: "Terminal", label: "Register / Re-register Employee Faces" },

  { id: "view_payroll", category: "Payroll", label: "View Payroll Data" },
  { id: "edit_payroll", category: "Payroll", label: "Edit / Lock Payroll Records" },
  { id: "log_advance", category: "Payroll", label: "Log Employee Advances" },
  { id: "log_shop_bill", category: "Payroll", label: "Log Shop Bills" },
  { id: "log_shop_advance", category: "Payroll", label: "Log Shop Advances" },
  { id: "log_deductions", category: "Payroll", label: "Log Penalties / Deductions" },
  { id: "mark_salary_paid", category: "Payroll", label: "Mark Salary as Paid" },

  { id: "download_salary_slip", category: "Reports", label: "Download Salary Slips (PDF)" },
  { id: "download_attendance_report", category: "Reports", label: "Download Attendance Reports (PDF)" },
  { id: "download_financial_report", category: "Reports", label: "Download Financial Reports (PDF)" },

  { id: "view_employee_profiles", category: "Employee", label: "View Employee Profiles & Details" },
  { id: "manage_employees", category: "Employee", label: "Add / Edit / Delete Employees" },

  { id: "view_branch_stats", category: "Branch", label: "View Branch Statistics" },
  { id: "manage_branches", category: "Branch", label: "Manage Branch Settings" },
];

export const PERMISSION_CATEGORIES = [
  "Attendance",
  "Terminal",
  "Payroll",
  "Reports",
  "Employee",
  "Branch",
];

export function hasPermission(source, permId, mode = "read") {
  if (!source) return false;
  if (source.role === "admin") return true;

  let perms =
    source.feature_permissions ??
    source.permissions ??
    source;

  if (!perms) return false;

  if (typeof perms === "string") {
    try {
      perms = JSON.parse(perms);
    } catch {
      return false;
    }
  }

  if (Array.isArray(perms)) {
    return perms.includes(permId);
  }

  const alias = permId === "register_face" ? "register_faces" : permId;
  const p = perms[permId] || perms[alias];

  if (!p) return false;
  if (typeof p === "boolean") return p;
  return !!p?.[mode] || !!p?.read || !!p?.write;
}