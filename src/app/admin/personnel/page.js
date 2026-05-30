"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Users, Search, Plus, Loader2, Edit2, Shield, 
  MapPin, X, Save, History, FileText, ChevronDown, 
  AlertTriangle, CreditCard, Stethoscope, Briefcase, 
  FileSignature, PowerOff, MoreVertical, Key, Activity, 
  UploadCloud, Trash2, UserCircle2, ArrowRight, ArrowLeft, CheckCircle2, Download, CalendarDays, Banknote, RefreshCcw, Printer, Calendar
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.caketowncafe.co.in"; 
const pad = (n) => String(n).padStart(2, "0");

const safeParse = (str, fallback = {}) => {
  if (!str) return fallback;
  try { 
    let parsed = typeof str === "string" ? JSON.parse(str) : str; 
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return parsed;
  } catch { return fallback; }
};

const parseDocuments = (docData) => {
  const parsed = safeParse(docData, null);
  if (Array.isArray(parsed)) return { aadhaar_front: null, aadhaar_back: null, others: parsed.map(d => ({ ...d, title: "Legacy Document" })) };
  return parsed || { aadhaar_front: null, aadhaar_back: null, others: [] };
};

const calculateAge = (dob) => {
  if (!dob) return "";
  const diff = Date.now() - new Date(dob).getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
};
const normalizePermissionShape = (raw = {}) => {
  const source = safeParse(raw, {});
  const normalized = {};

  Object.entries(source || {}).forEach(([key, value]) => {
    const normalizedKey = String(key)
      .replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
      .replace(/\s+/g, "_")
      .toLowerCase();

    normalized[normalizedKey] = {
      read: !!value?.read,
      write: !!value?.write,
    };
  });

  return normalized;
};
// ─── NEW: TENURE CALCULATOR ───
const calculateTenure = (joiningDate) => {
  if (!joiningDate) return "Unknown";
  const start = new Date(joiningDate);
  const now = new Date();
  if (isNaN(start)) return "Unknown";
  
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  
  if (years === 0 && months === 0) return "Joined this month";
  return `${years > 0 ? `${years} Yr ` : ''}${months} Mo`;
};

const Asterisk = () => <span className="text-red-500 ml-1">*</span>;

// ─── UPGRADED: PHP FORCED DOWNLOAD PROTOCOL ───
const getFileUrl = (path) => {
  if (!path) return "";
  let base = API_BASE_URL;
  if (base.endsWith("/api.php")) base = base.replace("/api.php", "");
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

const forceDownload = (fileUrl, fileName) => {
  // Extract just the relative path from the full URL
  const rawPath = fileUrl.replace(API_BASE_URL, '').replace('/api.php', '').replace(/^\//, '');
  // Route it to the new PHP force download action
  const downloadUrl = `${API_BASE_URL}/api.php?action=force_download&path=${encodeURIComponent(rawPath)}`;
  
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = fileName || "document";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const SearchableDropdown = ({ options, value, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={wrapperRef}>
      <div
        className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value ? <span className="truncate">{value}</span> : <span className="text-gray-400 truncate">{placeholder}</span>}
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-2" />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-60 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-gray-100 dark:border-neutral-800">
            <input
              autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search options..."
              className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
            />
          </div>
          <div className="overflow-y-auto custom-scrollbar">
            {filtered.length > 0 ? filtered.map(opt => (
              <div
                key={opt}
                className="px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                onClick={() => { onChange(opt); setIsOpen(false); setSearch(""); }}
              >
                {opt}
              </div>
            )) : <div className="p-4 text-xs text-gray-500 text-center font-bold">No results found.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const ALL_PERMISSIONS = [
  {
    category: "Dashboard & Analytics",
    items: [
      { id: "view_dashboard", label: "View Manager Dashboard", read: true, write: false },
      { id: "view_reports", label: "Access Master Reports", read: true, write: false },
    ],
  },
  {
    category: "Staff & Personnel",
    items: [
      { id: "view_staff_list", label: "View Staff Roster", read: true, write: false },
      { id: "view_staff_profile", label: "View Staff Profiles", read: true, write: false },
      { id: "manage_staff", label: "Add / Edit Staff Details", read: false, write: true },
      { id: "deactivate_staff", label: "Deactivate Personnel", read: false, write: true },
    ],
  },
  {
    category: "Attendance & Biometrics",
    items: [
      { id: "view_live_attendance", label: "View Live Floor Status", read: true, write: false },
      { id: "view_attendance_history", label: "View Attendance History", read: true, write: false },
      { id: "edit_attendance", label: "Override / Edit Attendance", read: true, write: true },
      { id: "manage_terminal", label: "Manage Biometric Terminal", read: true, write: true },
      { id: "register_face", label: "Register Employee Face", read: true, write: true },
    ],
  },
  {
    category: "Leave Management",
    items: [
      { id: "view_leaves", label: "View Leave Applications", read: true, write: false },
      { id: "manage_leaves", label: "Approve / Reject Leaves", read: false, write: true },
    ],
  },
  {
    category: "Payroll & Finance",
    items: [
      { id: "view_payroll", label: "View Payroll Ledgers", read: true, write: false },
      { id: "process_payroll", label: "Process / Pay Salaries", read: false, write: true },
      { id: "download_salary_slip", label: "Download Salary Slips", read: true, write: false },
      { id: "log_advance", label: "Log Standard Advances", read: false, write: true },
      { id: "log_shop_bill", label: "Log Shop Bills / Fines", read: false, write: true },
      { id: "view_finance_ledger", label: "View Master Finance Ledger", read: true, write: false },
      { id: "delete_finance_record", label: "Void / Delete Finance Records", read: false, write: true },
    ],
  },
  {
    category: "System & Security",
    items: [
      { id: "view_system_logs", label: "View Branch System Logs", read: true, write: false },
    ],
  },
];

const BLANK_FORM = {
  role: "staff", branch_id: "", name: "", mobile_number: "", password: "", 
  department: "", designation: "", gender: "", aadhar_number: "",
  salary: "", max_paid_leaves: 4, shift_hours: 10, permissions: {},
  personal_info: { dob: "", joining_date: "", education: "", marital_status: "", father_name: "", address: "", pincode: "", blood_group: "", medical: "", experience: "" },
  bank_details: { account_number: "", ifsc: "", upi: "", bank_name: "" },
  emergency_contacts: [{ name: "", relation: "", phone: "", address: "" }],
  reference_details: { name: "", contact: "", remarks: "" },
  documents: { aadhaar_front: null, aadhaar_back: null, others: [] }
};

export default function PersonnelCommandPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branch_id = searchParams.get("branch_id");

  const [session, setSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]); 
  const [orgStructure, setOrgStructure] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMenuId, setActionMenuId] = useState(null);

  const [viewMode, setViewMode] = useState("active"); 

  const [activeModal, setActiveModal] = useState(null); 
  const [selectedUser, setSelectedUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  
  const [docViewer, setDocViewer] = useState(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [profileTab, setProfileTab] = useState("basic");
  
  const [formData, setFormData] = useState(BLANK_FORM);
  const [initialFormData, setInitialFormData] = useState(null); 
  
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(null); 
  const [newDocTitle, setNewDocTitle] = useState("");

  // ─── NEW: MONITOR STATE ───
  const [monitorMonth, setMonitorMonth] = useState(new Date().getMonth() + 1);
  const [monitorYear, setMonitorYear] = useState(new Date().getFullYear());
  const [monitorTab, setMonitorTab] = useState("overview");
  const [monitorData, setMonitorData] = useState({ logs: [], finance: null, attendance: [] });
  const [monitorLoading, setMonitorLoading] = useState(false);
  
  const [deactivateReason, setDeactivateReason] = useState("");

  useEffect(() => {
    const closeMenu = () => setActionMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) { router.push("/"); return; }
    const parsed = JSON.parse(raw);
    if (parsed.role !== "admin") { router.push("/"); return; }
    setSession(parsed);
  }, [router]);

  const fetchData = useCallback(async () => {
    if (!branch_id) return;
    setLoading(true);
    
    const [uRes, orgRes, bRes] = await Promise.all([
      callApi("get_users"),
      callApi("get_departments_roles"),
      callApi("get_branches")
    ]);

    if (uRes.status === "success") {
      const allBranchUsers = (uRes.data || []).filter(u => String(u.branch_id) === String(branch_id));
      setUsers(allBranchUsers);
    }
    
    if (orgRes.status === "success") setOrgStructure(orgRes.data || []);
    if (bRes.status === "success") setBranches(bRes.data || []);
    
    setLoading(false);
  }, [branch_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeUsers = useMemo(() => users.filter(u => u.status === 'active'), [users]);
  const deactivatedUsers = useMemo(() => users.filter(u => u.status === 'inactive'), [users]);
  
  const displayedUsers = useMemo(() => {
    const sourceList = viewMode === "active" ? activeUsers : deactivatedUsers;
    return sourceList.filter(u => 
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.mobile_number?.includes(searchQuery) ||
      u.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeUsers, deactivatedUsers, viewMode, searchQuery]);

  const deptCount = new Set(activeUsers.map(u => u.department).filter(Boolean)).size;
  const manager = activeUsers.find(u => u.role === 'manager');
  const managerName = manager ? manager.name : "No Manager Assigned";
  const managerContact = manager ? manager.mobile_number : "—";

  const availableDepartments = orgStructure.map(d => d.name);
  const selectedDeptObj = orgStructure.find(d => d.name === formData.department);
  const availableRoles = selectedDeptObj ? selectedDeptObj.roles : [];

  const getWizardSteps = () => {
    const steps = [
      { id: "basic", label: "Identity", icon: Shield },
      { id: "contract", label: "Contract", icon: FileSignature },
    ];
    if (formData.role === 'manager') steps.push({ id: "permissions", label: "Access", icon: Key });
    steps.push(
      { id: "bank", label: "Bank", icon: CreditCard },
      { id: "personal", label: "Personal", icon: Stethoscope },
      { id: "emergency", label: "Emergency", icon: AlertTriangle },
      { id: "reference", label: "References", icon: Briefcase },
      { id: "documents", label: "Documents", icon: UploadCloud }
    );
    return steps;
  };

  const steps = getWizardSteps();
  const currentStep = activeModal === 'create' ? steps[currentStepIndex] : steps.find(s => s.id === profileTab);
  const activeTabId = activeModal === 'create' ? currentStep?.id : profileTab;

  const handleNextStep = () => {
    const form = document.getElementById("profileForm");
    if (form && !form.reportValidity()) return; 
    if (currentStepIndex < steps.length - 1) setCurrentStepIndex(prev => prev + 1);
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) setCurrentStepIndex(prev => prev - 1);
  };

  const openCreate = () => {
    setFormData({ ...BLANK_FORM, branch_id });
    setCurrentStepIndex(0);
    setActiveModal("create");
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.documents.aadhaar_front || !formData.documents.aadhaar_back) {
      alert("Aadhaar Front and Back documents are mandatory. Please upload them before creating the employee.");
      return;
    }
    setSaving(true);
    const payload = {
      ...formData,
      adminid: session.id,
      permissions: normalizePermissionShape(formData.permissions),
    };
    const res = await callApi("create_user", payload);
    if (res.status === "success") { setActiveModal(null); fetchData(); } 
    else alert(res.message || "Failed to create employee.");
    setSaving(false);
  };

  const openProfile = async (user, initialTab = "basic") => {
    setProfileLoading(true);
    const res = await callApi("get_user_profile", { user_id: user.id });
    setProfileLoading(false);

    if (res.status === "success") {
      const fullUser = res.data;
      setSelectedUser(fullUser);
      const resolvedCap = (fullUser.max_paid_leaves_cap ?? fullUser.max_paid_leaves) ?? 4;
      
      const parsedData = {
        ...fullUser,
        permissions: normalizePermissionShape(
          fullUser.feature_permissions || fullUser.featurepermissions || fullUser.permissions || {}
        ),
        salary: fullUser.monthly_fixed_salary || fullUser.salary || "",
        max_paid_leaves: resolvedCap,
        shift_hours: fullUser.standard_shift_hours || fullUser.shift_hours || 10,
        bank_details: safeParse(fullUser.bank_details, BLANK_FORM.bank_details),
        emergency_contacts: safeParse(fullUser.emergency_contacts, BLANK_FORM.emergency_contacts),
        personal_info: safeParse(fullUser.personal_info, BLANK_FORM.personal_info),
        reference_details: safeParse(fullUser.reference_details, BLANK_FORM.reference_details),
        documents: parseDocuments(fullUser.documents) 
      };

      setFormData(parsedData);
      setInitialFormData(parsedData); 
      setSaveSuccess(false);
      setProfileTab(initialTab);
      setActiveModal("profile");
    } else {
      alert("Failed to fetch full employee profile data.");
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...formData,
      userid: formData.id,
      adminid: session.id,
      permissions: normalizePermissionShape(formData.permissions),
    };
    const res = await callApi("update_user", payload);
    setSaving(false);

    if (res.status === "success") { 
      fetchData(); 
      setInitialFormData(formData); 
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } 
    else alert(res.message || "Failed to update profile");
  };

  const handleFileUpload = async (e, slotType) => {
    const file = e.target.files[0];
    if (!file) return;

    if (slotType === 'other' && !newDocTitle.trim()) {
      alert("Please provide a title for the document first.");
      return;
    }

    setUploadingDoc(slotType);
    const data = new FormData();
    data.append("action", "upload_document");
    data.append("document", file);
    data.append("user_id", formData.id || "new");

    try {
      const response = await fetch(`${API_BASE_URL}/api.php`, { method: "POST", body: data });
      const result = await response.json();
      
      if (result.status === "success") {
        const docRecord = { url: result.url, name: result.filename || file.name, uploaded_at: new Date().toISOString() };
        setFormData(prev => {
          const updatedDocs = JSON.parse(JSON.stringify(prev.documents)); 
          if (slotType === 'front') updatedDocs.aadhaar_front = docRecord;
          else if (slotType === 'back') updatedDocs.aadhaar_back = docRecord;
          else updatedDocs.others.push({ ...docRecord, title: newDocTitle });
          return { ...prev, documents: updatedDocs };
        });
        setNewDocTitle(""); 
      } else alert(result.message || "Upload failed");
    } catch (error) { alert("Network error during upload."); }
    setUploadingDoc(null);
  };

  const removeDocument = (slotType, index = null) => {
    setFormData(prev => {
      const updatedDocs = JSON.parse(JSON.stringify(prev.documents));
      if (slotType === 'front') updatedDocs.aadhaar_front = null;
      else if (slotType === 'back') updatedDocs.aadhaar_back = null;
      else if (slotType === 'other' && index !== null) {
        updatedDocs.others = updatedDocs.others.filter((_, i) => i !== index);
      }
      return { ...prev, documents: updatedDocs };
    });
  };

  // ─── UPGRADED: MONITOR FETCH ENGINE ───
  const fetchMonitorData = async (userId, m, y) => {
    setMonitorLoading(true);
    const [logsRes, finRes, attRes] = await Promise.all([
      callApi("get_system_logs", { target_user_id: userId, per_page: 200 }),
      callApi("get_my_financials", { user_id: userId, month: m, year: y }),
      callApi("get_my_attendance", { user_id: userId, month: m, year: y })
    ]);

    setMonitorData({
      logs: logsRes.status === "success" ? logsRes.data : [],
      finance: finRes.status === "success" ? finRes.data : null,
      attendance: attRes.status === "success" ? attRes.data : []
    });
    setMonitorLoading(false);
  };

  const openMonitor = async (user) => {
    const now = new Date();
    setMonitorMonth(now.getMonth() + 1);
    setMonitorYear(now.getFullYear());
    setMonitorTab("overview");
    setSelectedUser(user);
    
    // Fetch missing profile data instantly just for accurate tenure joining_date if needed
    if (!user.personal_info) {
      const res = await callApi("get_user_profile", { user_id: user.id });
      if (res.status === "success") setSelectedUser(res.data);
    }
    
    setActiveModal("monitor");
    fetchMonitorData(user.id, now.getMonth() + 1, now.getFullYear());
  };

  const handleMonitorMonthChange = (m, y) => {
    setMonitorMonth(m);
    setMonitorYear(y);
    fetchMonitorData(selectedUser.id, m, y);
  };

  // ─── NEW: PDF EXPORT REPORT ───
  const exportDossierPDF = () => {
    const printWindow = window.open('', '_blank');
    const html = `
      <html>
        <head>
          <title>Employee Dossier - ${selectedUser.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; line-height: 1.6; margin: 0; padding: 40px; background: #fff; }
            .header { border-bottom: 3px solid #111; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { margin: 0; font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
            .subtitle { color: #666; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
            h2 { margin-top: 40px; border-bottom: 1px solid #ccc; padding-bottom: 10px; font-size: 18px; color: #333; text-transform: uppercase; letter-spacing: 1px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px; }
            .stat-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px; }
            .val { font-size: 16px; font-weight: 900; }
            table { w-full; border-collapse: collapse; margin-top: 10px; width: 100%; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 12px; }
            th { text-transform: uppercase; color: #666; font-size: 10px; letter-spacing: 1px; background: #f8f9fa; }
            .log-item { padding: 10px 0; border-bottom: 1px solid #eee; }
            .log-desc { font-size: 13px; font-weight: bold; }
            .log-date { font-size: 10px; color: #666; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="subtitle">Complete Employee Dossier & Report</div>
            <h1>${selectedUser.name}</h1>
            <p><strong>Department:</strong> ${selectedUser.department || 'N/A'} &nbsp;|&nbsp; <strong>Role:</strong> ${selectedUser.role} &nbsp;|&nbsp; <strong>Status:</strong> ${selectedUser.status.toUpperCase()}</p>
            <p><strong>Period:</strong> ${new Date(monitorYear, monitorMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>

          <h2>Month-to-Date Snapshot</h2>
          <div class="grid">
            <div class="stat-box"><div class="label">Duty Days Verified</div><div class="val">${monitorData.finance?.present || 0}</div></div>
            <div class="stat-box"><div class="label">Paid Leaves Used</div><div class="val">${monitorData.finance?.paid_leaves || 0}</div></div>
            <div class="stat-box"><div class="label">Total Advances</div><div class="val">₹${parseFloat(monitorData.finance?.total_advance || 0).toLocaleString("en-IN")}</div></div>
            <div class="stat-box"><div class="label">Net Payable Salary</div><div class="val">₹${parseFloat(monitorData.finance?.salary_to_pay || 0).toLocaleString("en-IN")}</div></div>
          </div>

          <h2>Financial Transactions Log</h2>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Remarks</th></tr></thead>
            <tbody>
              ${monitorData.finance?.advance_history?.map(txn => `
                <tr>
                  <td>${new Date(txn.created_at).toLocaleDateString()}</td>
                  <td>${txn.type.replace('_', ' ')}</td>
                  <td>₹${parseFloat(txn.amount).toLocaleString("en-IN")}</td>
                  <td>${txn.remarks || '-'}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">No financial transactions found.</td></tr>'}
            </tbody>
          </table>

          <h2>Attendance Log</h2>
          <table>
            <thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th></tr></thead>
            <tbody>
              ${monitorData.attendance?.map(day => `
                <tr>
                  <td>${new Date(day.work_date || day.date).toLocaleDateString()}</td>
                  <td>${day.status === "F" || day.status === "P" ? "Full Day" : day.status === "H" ? "Half Day" : "Absent"}</td>
                  <td>${day.first_in ? new Date(day.first_in).toLocaleTimeString() : '-'}</td>
                  <td>${day.last_out ? new Date(day.last_out).toLocaleTimeString() : '-'}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">No attendance punches found.</td></tr>'}
            </tbody>
          </table>

          <h2>System Event Audit Trail</h2>
          ${monitorData.logs?.map(log => `
            <div class="log-item">
              <div class="log-desc">${log.description}</div>
              <div class="log-date">${new Date(log.created_at).toLocaleString()}</div>
            </div>
          `).join('') || '<p>No system logs found for this user.</p>'}
          
          <div style="margin-top: 50px; font-size: 10px; color: #999; text-align: center;">
            Generated securely by Master Command Engine on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    // Delay print to allow fonts to load
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const openDeactivate = (user) => {
    setSelectedUser(user);
    setDeactivateReason("");
    setActiveModal("deactivate");
  };

  const handleDeactivate = async () => {
    if(!deactivateReason) return alert("Reason is required for auditing.");
    setSaving(true);
    const res = await callApi("deactivate_user", { user_id: selectedUser.id, admin_id: session.id, reason: deactivateReason });
    if (res.status === "success") { setActiveModal(null); fetchData(); }
    setSaving(false);
  };

  const openReactivate = (user) => {
    setSelectedUser(user);
    setActiveModal("reactivate");
  };

  const handleReactivate = async () => {
    setSaving(true);
    const res = await callApi("reactivate_user", { user_id: selectedUser.id, admin_id: session.id });
    if (res.status === "success") { setActiveModal(null); fetchData(); }
    setSaving(false);
  };

  const togglePerm = (permId, mode) => {
    setFormData(prev => {
      const current = prev.permissions?.[permId] || { read: false, write: false };
      return { ...prev, permissions: { ...prev.permissions, [permId]: { ...current, [mode]: !current[mode] } } };
    });
  };

  const PermissionsGrid = () => (
    <div className="space-y-5">
      {ALL_PERMISSIONS.map(cat => (
        <div key={cat.category} className="bg-gray-50/50 dark:bg-[#111]/50 p-4 rounded-3xl border border-gray-100 dark:border-neutral-900">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 pl-2">{cat.category}</p>
          <div className="space-y-2">
            {cat.items.map(perm => {
              const cur = formData.permissions?.[perm.id] || { read: false, write: false };
              return (
                <div key={perm.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${cur.read || cur.write ? "bg-white dark:bg-black border-purple-200 dark:border-purple-800 shadow-sm" : "bg-transparent border-transparent"}`}>
                  <span className={`text-xs font-bold ${cur.read || cur.write ? "text-purple-900 dark:text-purple-300" : "text-gray-600 dark:text-neutral-400"}`}>{perm.label}</span>
                  <div className="flex items-center gap-4 bg-gray-100 dark:bg-neutral-900 p-1.5 rounded-xl w-fit">
                    {perm.read && (
                      <label className={`flex items-center gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${cur.read ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500"}`}>
                        <input type="checkbox" className="hidden" checked={cur.read} onChange={() => togglePerm(perm.id, "read")} /> Read
                      </label>
                    )}
                    {perm.write && (
                      <label className={`flex items-center gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${cur.write ? "bg-white dark:bg-neutral-800 text-purple-600 shadow-sm" : "text-gray-500"}`}>
                        <input type="checkbox" className="hidden" checked={cur.write} onChange={() => togglePerm(perm.id, "write")} /> Write
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 text-gray-900 dark:text-neutral-200">
      
      {profileLoading && (
        <div className="fixed inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center">
          <Loader2 size={40} className="animate-spin text-blue-500" />
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500 mb-1">
            <Users size={14} className="shrink-0" />
            <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Master Database</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Personnel Command
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 font-medium">
            Manage comprehensive profiles, banking details, documents, and historical audits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Active Staff</p>
            <Users size={16} className="text-blue-500" />
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{activeUsers.length}</p>
        </div>
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Branch Manager</p>
            <Shield size={16} className="text-purple-500" />
          </div>
          <p className="text-lg font-black text-gray-900 dark:text-white truncate">{managerName}</p>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{managerContact}</p>
        </div>
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Active Departments</p>
            <Briefcase size={16} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">{deptCount}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-gray-100 dark:border-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-[#050505]/50">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl w-full sm:w-auto shrink-0 shadow-inner">
               <button onClick={() => setViewMode('active')} className={`flex-1 sm:flex-none px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'active' ? 'bg-white dark:bg-black shadow-sm text-blue-600 dark:text-blue-500' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Active Personnel</button>
               <button onClick={() => setViewMode('deactivated')} className={`flex-1 sm:flex-none px-4 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'deactivated' ? 'bg-white dark:bg-black shadow-sm text-red-600 dark:text-red-500' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Deactivated Space</button>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search personnel..." 
                className="w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>
          {viewMode === 'active' && (
            <button onClick={openCreate} className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-lg shadow-blue-500/20 shrink-0">
              <Plus size={16} strokeWidth={3}/> New Employee
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
        ) : displayedUsers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
            {viewMode === 'active' ? 'No active personnel found.' : 'The deactivated space is empty.'}
          </div>
        ) : (
          <div className="w-full overflow-x-auto overflow-y-visible custom-scrollbar pb-32">
            <table className="w-full text-left min-w-[1100px] border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-[#050505] border-b border-gray-300 dark:border-neutral-700 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="p-4 sticky left-0 z-10 bg-gray-50/95 dark:bg-[#050505]/95 backdrop-blur-sm shadow-[2px_0_8px_rgba(0,0,0,0.05)] border-r border-gray-300 dark:border-neutral-700">Employee</th>
                  <th className="p-4 border-r border-gray-300 dark:border-neutral-700">Department & Role</th>
                  <th className="p-4 border-r border-gray-300 dark:border-neutral-700">Contact</th>
                  <th className="p-4 text-right border-r border-gray-300 dark:border-neutral-700">Fixed Salary</th>
                  {viewMode === 'deactivated' ? (
                     <th className="p-4 border-r border-gray-300 dark:border-neutral-700 text-red-500">Deactivation Reason</th>
                  ) : (
                     <th className="p-4 text-center border-r border-gray-300 dark:border-neutral-700">Leave Cap</th>
                  )}
                  <th className="p-4 text-center border-r border-gray-300 dark:border-neutral-700">Shift Target</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 dark:divide-neutral-700">
                {displayedUsers.map(user => (
                  <tr key={user.id} className={`hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 group transition-colors ${actionMenuId === user.id ? 'relative z-50' : 'relative z-0'}`}>
                    <td className="p-4 sticky left-0 z-10 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50/50 dark:group-hover:bg-[#111] border-r border-gray-300 dark:border-neutral-700 shadow-[2px_0_8px_rgba(0,0,0,0.02)] transition-colors">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-black text-sm text-gray-900 dark:text-white">{user.name}</p>
                        {viewMode === 'deactivated' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Deactivated"></span>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${user.role === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400'}`}>{user.role}</span>
                    </td>
                    <td className="p-4 border-r border-gray-300 dark:border-neutral-700">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{user.department || "Unassigned"}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-0.5">{user.designation || "No Designation"}</p>
                    </td>
                    <td className="p-4 font-mono text-xs font-bold text-gray-600 dark:text-neutral-400 border-r border-gray-300 dark:border-neutral-700">{user.mobile_number}</td>
                    <td className="p-4 text-right font-mono font-black text-sm text-gray-900 dark:text-white border-r border-gray-300 dark:border-neutral-700">₹{parseFloat(user.monthly_fixed_salary || 0).toLocaleString("en-IN")}</td>
                    
                    {viewMode === 'deactivated' ? (
                       <td className="p-4 border-r border-gray-300 dark:border-neutral-700 max-w-[200px]">
                         <p className="text-xs font-bold text-red-600 dark:text-red-400 truncate">{user.deactivation_reason || "Unknown"}</p>
                       </td>
                    ) : (
                       <td className="p-4 text-center font-mono font-black text-sm text-blue-600 dark:text-blue-400 border-r border-gray-300 dark:border-neutral-700">{(user.max_paid_leaves_cap ?? user.max_paid_leaves) ?? 4}</td>
                    )}

                    <td className="p-4 text-center font-mono font-black text-sm text-gray-600 dark:text-neutral-300 border-r border-gray-300 dark:border-neutral-700">{user.standard_shift_hours || 10}h</td>
                    
                    <td className="p-4 text-center relative">
                      <button 
                        onClick={(e) => { 
                          e.preventDefault();
                          e.stopPropagation(); 
                          e.nativeEvent.stopImmediatePropagation();
                          setActionMenuId(actionMenuId === user.id ? null : user.id); 
                        }} 
                        className="p-2 bg-gray-100 dark:bg-neutral-900 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {actionMenuId === user.id && (
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 w-48 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col animate-in zoom-in-95 duration-100">
                          {viewMode === 'active' ? (
                            <>
                              <button onClick={() => openProfile(user, "basic")} className="flex items-center gap-3 px-4 py-3 text-xs font-black text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors text-left border-b border-gray-100 dark:border-neutral-900">
                                <Edit2 size={14} className="text-blue-500"/> Edit Profile
                              </button>
                              <button onClick={() => openMonitor(user)} className="flex items-center gap-3 px-4 py-3 text-xs font-black text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors text-left border-b border-gray-100 dark:border-neutral-900">
                                <Activity size={14} className="text-emerald-500"/> Smart Monitor
                              </button>
                              {user.role === 'manager' && (
                                <button onClick={() => openProfile(user, "permissions")} className="flex items-center gap-3 px-4 py-3 text-xs font-black text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors text-left border-b border-gray-100 dark:border-neutral-900">
                                  <Shield size={14} className="text-purple-500"/> Access Control
                                </button>
                              )}
                              <button onClick={() => openDeactivate(user)} className="flex items-center gap-3 px-4 py-3 text-xs font-black text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left">
                                <PowerOff size={14} /> Deactivate
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => openProfile(user, "basic")} className="flex items-center gap-3 px-4 py-3 text-xs font-black text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors text-left border-b border-gray-100 dark:border-neutral-900">
                                <Search size={14} className="text-blue-500"/> View Identity Record
                              </button>
                              <button onClick={() => openMonitor(user)} className="flex items-center gap-3 px-4 py-3 text-xs font-black text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors text-left border-b border-gray-100 dark:border-neutral-900">
                                <History size={14} className="text-emerald-500"/> Historical Audit
                              </button>
                              <button onClick={() => openReactivate(user)} className="flex items-center gap-3 px-4 py-3 text-xs font-black text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-left">
                                <RefreshCcw size={14} /> Reactivate / Rehire
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(activeModal === 'create' || activeModal === 'profile') && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-72 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-6xl h-[95vh] md:h-[90vh] flex flex-col rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            
            <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex justify-between items-center bg-gray-50/50 dark:bg-[#111] shrink-0">
              <div className="flex-1">
                <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  {activeModal === 'create' ? <Plus size={20} className="text-blue-500"/> : <UserCircle2 size={20} className="text-blue-500"/>} 
                  {activeModal === 'create' ? "Establish New Personnel" : "Master Profile Record"}
                </h2>
                {activeModal === 'profile' && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Editing: <span className="text-blue-500">{selectedUser?.name}</span> {selectedUser?.status === 'inactive' && <span className="text-red-500 ml-2">(Deactivated / Locked)</span>}</p>}
                
                {activeModal === 'create' && (
                  <div className="mt-4 flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {steps.map((s, idx) => (
                      <div key={s.id} className={`flex items-center gap-2 shrink-0 ${idx !== 0 ? 'before:w-4 before:h-px before:bg-gray-300 dark:before:bg-neutral-700' : ''}`}>
                         <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black transition-colors ${currentStepIndex >= idx ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-neutral-800 text-gray-500'}`}>
                           {currentStepIndex > idx ? <CheckCircle2 size={12}/> : idx + 1}
                         </span>
                         <span className={`text-[10px] font-black uppercase tracking-widest ${currentStepIndex === idx ? 'text-blue-500' : 'text-gray-500'}`}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors self-start"><X size={18} /></button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
              
              <div className="w-full md:w-56 lg:w-64 bg-gray-50 dark:bg-[#050505] border-b md:border-b-0 md:border-r border-gray-100 dark:border-neutral-900 p-4 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0 snap-x">
                {steps.map((tab, idx) => {
                  const isActive = activeTabId === tab.id;
                  return (
                    <button 
                      key={tab.id} type="button"
                      onClick={() => {
                        if (activeModal === 'create') setCurrentStepIndex(idx);
                        else setProfileTab(tab.id);
                      }}
                      className={`snap-start shrink-0 md:w-full flex flex-col md:flex-row md:items-center gap-2 md:gap-3 p-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all ${isActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 md:bg-transparent hover:bg-gray-200 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-800 md:border-transparent'}`}
                    >
                      <tab.icon size={16} className={isActive ? "opacity-100" : "opacity-60"} /> 
                      <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-white dark:bg-[#0a0a0a] min-w-0">
                <form id="profileForm" onSubmit={activeModal === 'create' ? handleCreateSubmit : handleSaveProfile} className="space-y-6 max-w-3xl pb-safe">
                  
                  <fieldset disabled={selectedUser?.status === 'inactive' && activeModal === 'profile'} className="contents">
                    
                    {activeTabId === "basic" && (
                      <div className="space-y-5 animate-in fade-in">
                        <div className="mb-6">
                          <h3 className="text-base font-black text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2">Core Identity</h3>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">Primary details and access levels.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Full Legal Name <Asterisk/></label>
                            <input type="text" value={formData.name || ""} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" required />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Mobile / Login ID <Asterisk/></label>
                            <input type="tel" value={formData.mobile_number || ""} onChange={e => setFormData({...formData, mobile_number: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" required />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Assigned Branch <Asterisk/></label>
                            <div className="relative">
                              <select value={formData.branch_id || branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 appearance-none">
                                {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Department <Asterisk/></label>
                            <SearchableDropdown 
                              options={availableDepartments} 
                              value={formData.department} 
                              placeholder="Select Department"
                              disabled={selectedUser?.status === 'inactive'}
                              onChange={v => setFormData({...formData, department: v, designation: ""})} 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Designation / Role <Asterisk/></label>
                            <SearchableDropdown 
                              options={availableRoles} 
                              value={formData.designation} 
                              placeholder="Select Role"
                              disabled={!formData.department || selectedUser?.status === 'inactive'}
                              onChange={v => setFormData({...formData, designation: v})} 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Aadhaar Number <Asterisk/></label>
                            <input type="text" value={formData.aadhar_number || ""} onChange={e => setFormData({...formData, aadhar_number: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" required />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Gender</label>
                            <div className="relative">
                              <select value={formData.gender || ""} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 appearance-none">
                                <option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          <div className="space-y-1.5 sm:col-span-2 pt-4 border-t border-gray-100 dark:border-neutral-900">
                            <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest pl-1">
                              {activeModal === 'create' ? "Set Initial Password" : "Reset Password"} {activeModal === 'create' && <Asterisk/>}
                            </label>
                            <input type="password" value={formData.password || ""} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={activeModal === 'create' ? "Required" : "Leave blank to keep existing password"} required={activeModal === 'create'} className="w-full bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl px-4 py-3 text-sm font-bold font-mono text-gray-900 dark:text-white outline-none focus:border-red-500" />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTabId === "contract" && (
                      <div className="space-y-5 animate-in fade-in">
                        <div className="mb-6">
                          <h3 className="text-base font-black text-emerald-600 border-b border-gray-100 dark:border-neutral-800 pb-2">Financial Contract & Shift</h3>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">Core logic for the payroll engine.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">System Architecture Role <Asterisk/></label>
                            <div className="relative">
                              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 appearance-none">
                                <option value="staff">Staff / Floor Worker (Fixed Access)</option>
                                <option value="manager">Branch Manager (Modular Access)</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                            {formData.role === 'staff' && <p className="text-[10px] font-bold text-gray-400 mt-1 pl-1">Staff workers receive the fixed Employee App view.</p>}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Monthly Salary (₹) <Asterisk/></label>
                            <input type="number" value={formData.salary || ""} onChange={e => setFormData({...formData, salary: e.target.value})} className="w-full bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/50 rounded-xl px-4 py-3 text-base font-black font-mono text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50" required />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Target Shift (Hrs) <Asterisk/></label>
                            <input type="number" step="0.5" value={formData.shift_hours || ""} onChange={e => setFormData({...formData, shift_hours: e.target.value})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold font-mono text-gray-900 dark:text-white outline-none focus:border-emerald-500" required />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Leave Cap / Tier</label>
                            <div className="relative">
                              <select value={formData.max_paid_leaves ?? 4} onChange={e => setFormData({...formData, max_paid_leaves: parseInt(e.target.value)})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500 appearance-none">
                                <option value={0}>0 (No Paid Leaves)</option>
                                <option value={2}>2 (Tier-B)</option>
                                <option value={4}>4 (Tier-A)</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTabId === "permissions" && formData.role === 'manager' && (
                      <div className="space-y-5 animate-in fade-in">
                        <div className="mb-6">
                          <h3 className="text-base font-black text-purple-600 border-b border-gray-100 dark:border-neutral-800 pb-2">Modular Access Control</h3>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">Assign specific administrative tools to this manager.</p>
                        </div>
                        <PermissionsGrid />
                      </div>
                    )}

                    {activeTabId === "bank" && (
                      <div className="space-y-5 animate-in fade-in">
                        <div className="mb-6">
                          <h3 className="text-base font-black text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2 flex items-center gap-2"><CreditCard size={18} className="text-blue-500"/> Financial Routing</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Bank Name</label>
                            <input type="text" value={formData.bank_details?.bank_name || ""} onChange={e => setFormData({...formData, bank_details: {...formData.bank_details, bank_name: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Account Number</label>
                            <input type="text" value={formData.bank_details?.account_number || ""} onChange={e => setFormData({...formData, bank_details: {...formData.bank_details, account_number: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono font-black text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">IFSC Code</label>
                            <input type="text" value={formData.bank_details?.ifsc || ""} onChange={e => setFormData({...formData, bank_details: {...formData.bank_details, ifsc: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono font-bold uppercase text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">UPI ID (Optional)</label>
                            <input type="text" value={formData.bank_details?.upi || ""} onChange={e => setFormData({...formData, bank_details: {...formData.bank_details, upi: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTabId === "personal" && (
                      <div className="space-y-5 animate-in fade-in">
                        <div className="mb-6">
                          <h3 className="text-base font-black text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2 flex items-center gap-2"><Stethoscope size={18} className="text-emerald-500"/> Personal & Health Data</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Date of Birth</label>
                            <div className="flex gap-2">
                              <input type="date" value={formData.personal_info?.dob || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, dob: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                              <div className="w-16 shrink-0 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl flex flex-col items-center justify-center">
                                <span className="text-[10px] font-black text-blue-600/70 uppercase">Age</span>
                                <span className="font-mono font-black text-blue-700">{calculateAge(formData.personal_info?.dob)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Joining Date</label>
                            <input type="date" value={formData.personal_info?.joining_date || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, joining_date: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Father's Name</label>
                            <input type="text" value={formData.personal_info?.father_name || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, father_name: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Permanent Address</label>
                            <textarea value={formData.personal_info?.address || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, address: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-blue-500 resize-none h-16 custom-scrollbar" />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Pincode</label>
                            <input type="text" value={formData.personal_info?.pincode || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, pincode: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Marital Status</label>
                            <div className="relative">
                              <select value={formData.personal_info?.marital_status || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, marital_status: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 appearance-none">
                                <option value="">Select...</option><option value="Single">Single</option><option value="Married">Married</option><option value="Divorced">Divorced</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Blood Group</label>
                            <div className="relative">
                              <select value={formData.personal_info?.blood_group || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, blood_group: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 appearance-none">
                                <option value="">Select...</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="O+">O+</option><option value="O-">O-</option><option value="AB+">AB+</option><option value="AB-">AB-</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Educational Qualification</label>
                            <input type="text" value={formData.personal_info?.education || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, education: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                          </div>

                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Medical Conditions / Allergies</label>
                            <textarea value={formData.personal_info?.medical || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, medical: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-blue-500 resize-none h-16 custom-scrollbar" />
                          </div>
                          
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Previous Work Experience</label>
                            <textarea value={formData.personal_info?.experience || ""} onChange={e => setFormData({...formData, personal_info: {...formData.personal_info, experience: e.target.value}})} className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-blue-500 resize-none h-20 custom-scrollbar" />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTabId === "emergency" && (
                      <div className="space-y-5 animate-in fade-in">
                        <div className="mb-6 flex items-center justify-between">
                          <h3 className="text-base font-black text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2 flex items-center gap-2"><AlertTriangle size={18} className="text-red-500"/> Emergency Contacts</h3>
                          <button type="button" onClick={() => {
                            const newContacts = [...formData.emergency_contacts, { name: "", relation: "", phone: "", address: "" }];
                            setFormData({...formData, emergency_contacts: newContacts});
                          }} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black uppercase rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                            <Plus size={14}/> Add
                          </button>
                        </div>
                        <div className="space-y-6">
                          {formData.emergency_contacts.map((contact, index) => (
                            <div key={index} className="p-5 border border-gray-200 dark:border-neutral-800 rounded-2xl bg-gray-50/50 dark:bg-[#111]/50 relative">
                              {index > 0 && <button type="button" onClick={() => {
                                  const newC = formData.emergency_contacts.filter((_, i) => i !== index);
                                  setFormData({...formData, emergency_contacts: newC});
                                }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X size={16}/></button>}
                              
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Contact #{index + 1}</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Name</label>
                                  <input type="text" value={contact.name} onChange={e => {
                                    const newC = [...formData.emergency_contacts]; newC[index].name = e.target.value;
                                    setFormData({...formData, emergency_contacts: newC});
                                  }} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-red-500" />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Relation</label>
                                  <input type="text" value={contact.relation} onChange={e => {
                                    const newC = [...formData.emergency_contacts]; newC[index].relation = e.target.value;
                                    setFormData({...formData, emergency_contacts: newC});
                                  }} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-red-500" />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Phone Number</label>
                                  <input type="tel" value={contact.phone} onChange={e => {
                                    const newC = [...formData.emergency_contacts]; newC[index].phone = e.target.value;
                                    setFormData({...formData, emergency_contacts: newC});
                                  }} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-red-500" />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                  <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Address</label>
                                  <textarea value={contact.address} onChange={e => {
                                    const newC = [...formData.emergency_contacts]; newC[index].address = e.target.value;
                                    setFormData({...formData, emergency_contacts: newC});
                                  }} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-red-500 resize-none h-16 custom-scrollbar" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTabId === "reference" && (
                      <div className="space-y-5 animate-in fade-in">
                        <div className="mb-6">
                          <h3 className="text-base font-black text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2 flex items-center gap-2"><Briefcase size={18} className="text-orange-500"/> Employment Reference</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 p-5 border border-orange-100 dark:border-orange-900/30 bg-orange-50/30 dark:bg-orange-900/10 rounded-2xl">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Referrer Name</label>
                            <input type="text" value={formData.reference_details?.name || ""} onChange={e => setFormData({...formData, reference_details: {...formData.reference_details, name: e.target.value}})} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-orange-500" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Referrer Contact</label>
                            <input type="tel" value={formData.reference_details?.contact || ""} onChange={e => setFormData({...formData, reference_details: {...formData.reference_details, contact: e.target.value}})} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-orange-500" />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest pl-1">Context / Remarks</label>
                            <textarea value={formData.reference_details?.remarks || ""} onChange={e => setFormData({...formData, reference_details: {...formData.reference_details, remarks: e.target.value}})} className="w-full bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-orange-500 resize-none h-20 custom-scrollbar" />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTabId === "documents" && (
                      <div className="space-y-5 animate-in fade-in">
                        <div className="mb-6 flex items-center justify-between">
                          <h3 className="text-base font-black text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2 flex items-center gap-2"><UploadCloud size={18} className="text-purple-500"/> Secure Documents Vault</h3>
                        </div>

                        <div className="bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 p-5 rounded-2xl space-y-4">
                          <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-1.5"><Shield size={12}/> Mandatory Identification</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            
                            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl p-4 flex items-center justify-between shadow-sm group">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-[#111] flex items-center justify-center shrink-0 border border-gray-100 dark:border-neutral-800">
                                  {formData.documents.aadhaar_front ? <CheckCircle2 size={18} className="text-emerald-500" /> : <FileText size={18} className="text-gray-400" />}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-gray-900 dark:text-white">Aadhaar (Front) <Asterisk/></p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {formData.documents.aadhaar_front && (
                                  <>
                                    <button type="button" onClick={() => setDocViewer(formData.documents.aadhaar_front)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Secure View"><Search size={14}/></button>
                                    <button type="button" onClick={() => forceDownload(getFileUrl(formData.documents.aadhaar_front.url), formData.documents.aadhaar_front.name)} className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Force Download"><Download size={14}/></button>
                                    {selectedUser?.status !== 'inactive' && <button type="button" onClick={() => removeDocument('front')} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Delete"><Trash2 size={14}/></button>}
                                  </>
                                )}
                                {!formData.documents.aadhaar_front && selectedUser?.status !== 'inactive' && (
                                  <label className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer relative" title="Upload">
                                    {uploadingDoc === 'front' ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14}/>}
                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'front')} disabled={uploadingDoc} accept="image/*,.pdf" />
                                  </label>
                                )}
                              </div>
                            </div>

                            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-xl p-4 flex items-center justify-between shadow-sm group">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-[#111] flex items-center justify-center shrink-0 border border-gray-100 dark:border-neutral-800">
                                  {formData.documents.aadhaar_back ? <CheckCircle2 size={18} className="text-emerald-500" /> : <FileText size={18} className="text-gray-400" />}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-gray-900 dark:text-white">Aadhaar (Back) <Asterisk/></p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {formData.documents.aadhaar_back && (
                                  <>
                                    <button type="button" onClick={() => setDocViewer(formData.documents.aadhaar_back)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Secure View"><Search size={14}/></button>
                                    <button type="button" onClick={() => forceDownload(getFileUrl(formData.documents.aadhaar_back.url), formData.documents.aadhaar_back.name)} className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Force Download"><Download size={14}/></button>
                                    {selectedUser?.status !== 'inactive' && <button type="button" onClick={() => removeDocument('back')} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Delete"><Trash2 size={14}/></button>}
                                  </>
                                )}
                                {!formData.documents.aadhaar_back && selectedUser?.status !== 'inactive' && (
                                  <label className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer relative" title="Upload">
                                    {uploadingDoc === 'back' ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14}/>}
                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'back')} disabled={uploadingDoc} accept="image/*,.pdf" />
                                  </label>
                                )}
                              </div>
                            </div>

                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 pl-1 border-b border-gray-100 dark:border-neutral-800 pb-2">Additional Records</h4>
                          {selectedUser?.status !== 'inactive' && (
                            <div className="flex items-center gap-3 mb-4">
                              <input type="text" value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} placeholder="e.g. Bank Passbook, Resume..." className="flex-1 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-purple-500" />
                              <label className={`px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black font-black text-xs rounded-xl flex items-center gap-2 transition-all ${newDocTitle.trim() ? 'cursor-pointer hover:bg-black active:scale-95 shadow-lg' : 'opacity-50 cursor-not-allowed'}`}>
                                {uploadingDoc === 'other' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14}/>} Add Document
                                <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'other')} disabled={uploadingDoc || !newDocTitle.trim()} accept="image/*,.pdf" />
                              </label>
                            </div>
                          )}

                          <div className="space-y-3">
                            {formData.documents.others?.length === 0 ? (
                              <div className="p-6 border border-dashed border-gray-200 dark:border-neutral-800 rounded-2xl bg-gray-50 dark:bg-[#111] text-center">
                                <p className="text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase">No additional documents.</p>
                              </div>
                            ) : (
                              formData.documents.others?.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-[#0a0a0a] shadow-sm">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-[#111] text-gray-500 flex items-center justify-center shrink-0 border border-gray-100 dark:border-neutral-800"><FileText size={14} /></div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{doc.title || doc.name}</p>
                                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{new Date(doc.uploaded_at).toLocaleDateString("en-IN")}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button type="button" onClick={() => setDocViewer(doc)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Secure View"><Search size={14} /></button>
                                    <button type="button" onClick={() => forceDownload(getFileUrl(doc.url), doc.name)} className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Force Download"><Download size={14} /></button>
                                    {selectedUser?.status !== 'inactive' && <button type="button" onClick={() => removeDocument('other', idx)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </fieldset>
                </form>
              </div>
            </div>

            <div className="p-4 md:p-5 border-t border-gray-100 dark:border-neutral-900 shrink-0 bg-gray-50/50 dark:bg-[#050505] rounded-b-3xl flex justify-between items-center">
              
              {activeModal === 'profile' && (
                <div className="w-full flex items-center justify-between">
                  <div>
                    {selectedUser?.status === 'inactive' && <span className="text-xs font-black text-red-500 uppercase tracking-widest bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/30">Read-Only Mode</span>}
                  </div>
                  <div className="flex items-center justify-end">
                    {saveSuccess ? (
                      <button type="button" disabled className="w-full md:w-auto px-8 py-3.5 bg-emerald-500 text-white text-sm font-black rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 animate-in zoom-in-95 duration-200">
                        <CheckCircle2 size={18} strokeWidth={2.5} /> Changes Saved
                      </button>
                    ) : (
                      <button 
                        type="submit" form="profileForm" 
                        disabled={saving || uploadingDoc || JSON.stringify(formData) === JSON.stringify(initialFormData) || selectedUser?.status === 'inactive'} 
                        className="w-full md:w-auto px-8 py-3.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 animate-in fade-in"
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} />} Save Profile Data
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeModal === 'create' && (
                <div className="w-full flex justify-between">
                  <button type="button" onClick={handlePrevStep} disabled={currentStepIndex === 0} className="px-6 py-3.5 bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-neutral-300 text-sm font-black rounded-xl transition-all disabled:opacity-0 flex items-center gap-2">
                     <ArrowLeft size={16}/> Back
                  </button>

                  {currentStepIndex === steps.length - 1 ? (
                    <button type="submit" form="profileForm" disabled={saving || uploadingDoc} className="px-8 py-3.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} strokeWidth={2.5} />} Create Employee
                    </button>
                  ) : (
                    <button type="button" onClick={handleNextStep} className="px-8 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-black rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                      Next Step <ArrowRight size={16} strokeWidth={2.5}/>
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          IN-APP DOCUMENT VIEWER MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {docViewer && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[400] flex flex-col animate-in fade-in duration-200">
          <div className="p-4 flex justify-between items-center bg-black/50 text-white shrink-0 shadow-lg border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                <FileText size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="font-black text-sm">{docViewer.name || docViewer.title || "Secure Document"}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-widest">In-App Secure Viewer</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => forceDownload(getFileUrl(docViewer.url), docViewer.name)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-black transition-colors shadow-lg active:scale-95">
                <Download size={14} strokeWidth={3} /> Download
              </button>
              <button onClick={() => setDocViewer(null)} className="p-2 bg-white/10 hover:bg-red-500 hover:text-white rounded-xl transition-colors active:scale-95">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-4 md:p-8 flex items-center justify-center">
            {docViewer.url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
              <img src={getFileUrl(docViewer.url)} alt="Document" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-300" />
            ) : (
              <iframe src={getFileUrl(docViewer.url)} className="w-full h-full max-w-5xl bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300" title="Document Viewer" />
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 3: THE SMART MONITOR (AUDIT) WITH EXPORT ENGINE
      ══════════════════════════════════════════════════════════════════ */}
      {activeModal === 'monitor' && selectedUser && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-72 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 w-full max-w-5xl h-[95vh] md:h-[85vh] flex flex-col rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            
            <div className="p-4 md:p-5 border-b border-gray-100 dark:border-neutral-900 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gray-50/50 dark:bg-[#111] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                  <Activity size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900 dark:text-white leading-tight">{selectedUser.name}</h2>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Dossier & Monitor Data</p>
                </div>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                
                {/* PDF EXPORT BUTTON */}
                <button onClick={exportDossierPDF} className="flex items-center gap-2 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-black shadow-md hover:scale-[0.98] transition-transform shrink-0">
                  <Printer size={14} /> Export Dossier
                </button>

                {/* MONTH / YEAR SWITCHER */}
                <div className="flex items-center bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-lg p-1 shrink-0">
                  <Calendar size={14} className="text-gray-400 mx-2" />
                  <select value={monitorMonth} onChange={(e) => handleMonitorMonthChange(parseInt(e.target.value), monitorYear)} className="bg-transparent text-xs font-bold text-gray-700 dark:text-neutral-300 outline-none cursor-pointer py-1">
                    {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("en-IN", { month: "short" })}</option>)}
                  </select>
                  <select value={monitorYear} onChange={(e) => handleMonitorMonthChange(monitorMonth, parseInt(e.target.value))} className="bg-transparent text-xs font-bold text-gray-700 dark:text-neutral-300 outline-none cursor-pointer py-1 border-l border-gray-200 dark:border-neutral-800 pl-1 ml-1">
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <button onClick={() => setActiveModal(null)} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-700 text-gray-500 transition-colors shrink-0"><X size={16} /></button>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
              <div className="w-full md:w-48 lg:w-56 bg-gray-50 dark:bg-[#050505] border-b md:border-b-0 md:border-r border-gray-100 dark:border-neutral-900 p-3 md:p-4 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0 snap-x">
                {[
                  { id: "overview", icon: Activity, label: "Month Snapshot" },
                  { id: "attendance", icon: CalendarDays, label: "Punches & Duty" },
                  { id: "finance", icon: Banknote, label: "Financial Logs" },
                  { id: "system", icon: History, label: "Audit Trail" },
                ].map(tab => (
                  <button 
                    key={tab.id} onClick={() => setMonitorTab(tab.id)}
                    className={`snap-start shrink-0 md:w-full flex items-center gap-2 md:gap-3 p-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all ${monitorTab === tab.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 md:bg-transparent hover:bg-gray-200 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-800 md:border-transparent'}`}
                  >
                    <tab.icon size={16} className={monitorTab === tab.id ? "opacity-100" : "opacity-60"} /> 
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 bg-white dark:bg-[#0a0a0a] min-w-0 relative">
                {monitorLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm z-10">
                    <Loader2 className="animate-spin text-emerald-500 mb-2" size={32}/>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Fetching Ledgers...</p>
                  </div>
                ) : (
                  <div className="space-y-6 pb-safe">
                    
                    {monitorTab === "overview" && (
                      <div className="space-y-6 animate-in fade-in">
                        
                        {/* TENURE & IDENTITY BLOCK */}
                        <div className="bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 p-4 rounded-2xl flex flex-wrap gap-6 items-center">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Organization Tenure</p>
                            <p className="font-black text-lg text-gray-900 dark:text-white">{calculateTenure(selectedUser?.personal_info?.joining_date)}</p>
                          </div>
                          <div className="w-px h-8 bg-gray-300 dark:bg-neutral-700 hidden sm:block"></div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Joined Date</p>
                            <p className="font-bold text-sm text-gray-700 dark:text-neutral-300">
                              {selectedUser?.personal_info?.joining_date ? new Date(selectedUser.personal_info.joining_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not Logged'}
                            </p>
                          </div>
                          <div className="w-px h-8 bg-gray-300 dark:bg-neutral-700 hidden sm:block"></div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Fixed Salary</p>
                            <p className="font-mono font-bold text-sm text-gray-700 dark:text-neutral-300">₹{parseFloat(selectedUser.monthly_fixed_salary || 0).toLocaleString("en-IN")}</p>
                          </div>
                        </div>

                        <h3 className="text-base font-black text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2 flex items-center justify-between">
                          <span className="flex items-center gap-2"><Activity size={16} className="text-emerald-500"/> Month Performance</span>
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white dark:bg-[#111] p-4 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Duty Days</p>
                            <p className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400">{monitorData.finance?.present || 0}</p>
                          </div>
                          <div className="bg-white dark:bg-[#111] p-4 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Paid Leaves</p>
                            <p className="font-mono font-black text-2xl text-blue-600 dark:text-blue-400">{monitorData.finance?.paid_leaves || 0}</p>
                          </div>
                          <div className="bg-white dark:bg-[#111] p-4 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Advances Taken</p>
                            <p className="font-mono font-black text-xl text-orange-600 dark:text-orange-400">₹{parseFloat(monitorData.finance?.total_advance || 0).toLocaleString("en-IN")}</p>
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/30">
                            <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-500 uppercase tracking-widest mb-1">Net Payable</p>
                            <p className="font-mono font-black text-2xl text-emerald-700 dark:text-emerald-400">₹{parseFloat(monitorData.finance?.salary_to_pay || 0).toLocaleString("en-IN")}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {monitorTab === "attendance" && (
                      <div className="space-y-4 animate-in fade-in">
                        <h3 className="text-base font-black text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2 flex items-center gap-2"><CalendarDays size={16} className="text-blue-500"/> Verified Punches</h3>
                        {monitorData.attendance.length === 0 ? <p className="text-sm font-bold text-gray-400">No attendance data for this month.</p> : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {monitorData.attendance.map((day, i) => (
                              <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 p-3 rounded-xl">
                                <div>
                                  <span className="font-black text-gray-900 dark:text-white mr-2">{new Date(day.work_date || day.date).getDate()}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    {new Date(day.work_date || day.date).toLocaleDateString("en-IN", { weekday: "short" })}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <p className="font-mono font-black text-xs text-gray-900 dark:text-white">
                                    {day.first_in ? new Date(day.first_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"} to {day.last_out ? new Date(day.last_out).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                  </p>
                                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mt-0.5">{day.status === "F" || day.status === "P" ? "Full Day" : day.status === "H" ? "Half Day" : "Absent"}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {monitorTab === "finance" && (
                      <div className="space-y-4 animate-in fade-in">
                        <h3 className="text-base font-black text-gray-900 dark:text-white border-b border-gray-100 dark:border-neutral-800 pb-2 flex items-center gap-2"><Banknote size={16} className="text-orange-500"/> Financial Ledger</h3>
                        {monitorData.finance?.advance_history?.length === 0 ? <p className="text-sm font-bold text-gray-400">No financial transactions this month.</p> : (
                          <div className="space-y-3">
                            {monitorData.finance?.advance_history?.map(txn => (
                              <div key={txn.id} className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-4 rounded-2xl">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-lg">₹{parseFloat(txn.amount).toLocaleString("en-IN")}</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-800/50 dark:text-orange-200/50">{txn.type.replace('_', ' ')}</span>
                                </div>
                                <p className="text-xs font-bold text-gray-700 dark:text-neutral-300">{txn.remarks || "No remarks"}</p>
                                <p className="text-[10px] font-bold text-gray-500 mt-2">{new Date(txn.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {monitorTab === "system" && (
                      <div className="space-y-4 animate-in fade-in">
                        <div className="border-b border-gray-100 dark:border-neutral-800 pb-2 mb-4">
                          <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2"><History size={16} className="text-purple-500"/> Security & Audit Trail</h3>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Showing isolated events where this user was the actor or target.</p>
                        </div>
                        {monitorData.logs.length === 0 ? <p className="text-sm font-bold text-gray-400">No logs found.</p> : (
                          <div className="relative pl-4 border-l-2 border-gray-100 dark:border-neutral-800/80 space-y-6">
                            {monitorData.logs.map(log => (
                              <div key={log.id} className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full ring-4 ring-white dark:bg-[#0a0a0a] bg-purple-500 shadow-sm" />
                                <div className="pl-2">
                                  <p className="text-sm font-bold text-gray-900 dark:text-neutral-100 mb-1">{log.description}</p>
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    {new Date(log.created_at).toLocaleString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 4: DEACTIVATE / DELETE SAFEGUARD
      ══════════════════════════════════════════════════════════════════ */}
      {activeModal === 'deactivate' && selectedUser && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-72 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-red-200 dark:border-red-900/50 w-full max-w-sm rounded-3xl shadow-2xl p-6 md:p-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-2 text-red-500 border-4 border-red-100 dark:border-red-900/30">
              <PowerOff size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">Deactivate {selectedUser.name}?</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 font-medium">
              This will instantly lock login access and move their profile to the Deactivated Space. Historical payroll and logs will remain perfectly intact.
            </p>
            
            <textarea 
              value={deactivateReason} onChange={e => setDeactivateReason(e.target.value)}
              placeholder="e.g., Resigned, Terminated for X..." required
              className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-xl p-3 text-sm outline-none focus:border-red-500 resize-none h-20 text-left"
            />
            <div className="flex items-center gap-1.5 px-1 pb-1">
              <Asterisk/><span className="text-[10px] font-bold text-red-500 uppercase">Reason required for Master Audit Log</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm">Cancel</button>
              <button onClick={handleDeactivate} disabled={saving || !deactivateReason} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-all shadow-lg active:scale-95 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={16} /> : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 5: REACTIVATE SAFEGUARD
      ══════════════════════════════════════════════════════════════════ */}
      {activeModal === 'reactivate' && selectedUser && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-72 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 shadow-[-10px_0_40px_rgba(0,0,0,0.2)]">
          <div className="bg-white dark:bg-[#0a0a0a] border border-blue-200 dark:border-blue-900/50 w-full max-w-sm rounded-3xl shadow-2xl p-6 md:p-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-2 text-blue-500 border-4 border-blue-100 dark:border-blue-900/30">
              <RefreshCcw size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">Reactivate / Rehire?</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 font-medium">
              You are about to restore <strong>{selectedUser.name}</strong> to the Active Workforce. They will immediately regain login access and appear in active attendance sheets.
            </p>
            
            <div className="flex gap-3 pt-4">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm">Cancel</button>
              <button onClick={handleReactivate} disabled={saving} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl transition-all shadow-lg active:scale-95 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={16} /> : "Restore Access"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}