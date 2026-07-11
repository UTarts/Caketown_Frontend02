"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as faceapi from "face-api.js";
import { callApi } from "@/lib/apiClient";
import { canRead, canWrite } from "@/lib/permissions";
import {
  Users,
  X,
  Loader2,
  ScanFace,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  ArrowRight, MoreVertical
} from "lucide-react";

const DETECTION_INTERVAL_MS = 450;
const DETECTION_INPUT_SIZE = 160;
const CAMERA_WIDTH = 480;
const CAMERA_HEIGHT = 640;

function hasRegisteredFace(user) {
  return Boolean(
    user?.face_descriptor ||
      user?.descriptor ||
      user?.has_face ||
      user?.face_registered ||
      user?.biometric_registered ||
      user?.is_face_registered ||
      user?.face_registered_at
  );
}

export default function BranchStaffPage() {
  const router = useRouter();

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]); // NEW: State for branches
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null); 

  // Transfer States
  const [transferModal, setTransferModal] = useState(null);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Biometric States
  const [registeringUser, setRegisteringUser] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanStatus, setScanStatus] = useState("Starting...");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [capturedDescriptor, setCapturedDescriptor] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const mountedRef = useRef(true);
  const latestDescriptorRef = useRef(null);
  const isSavingRef = useRef(false);
  const showSuccessRef = useRef(false);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  useEffect(() => {
    showSuccessRef.current = showSuccess;
  }, [showSuccess]);

  const stopDetectionLoop = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  const releaseMedia = () => {
    stopDetectionLoop();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    latestDescriptorRef.current = null;
  };

  const closeRegistrationModal = () => {
    releaseMedia();
    setRegisteringUser(null);
    setModelsLoaded(false);
    setCameraReady(false);
    setCapturedDescriptor(null);
    setIsSaving(false);
    setShowSuccess(false);
    setScanStatus("Starting...");
  };

  const fetchStaffAndBranches = async (branchId) => {
    if (!branchId) return;

    setLoading(true);
    try {
      // NEW: Fetch branches alongside staff so managers can select a destination
      const [res, branchRes] = await Promise.all([
        callApi("get_branch_staff", { branch_id: branchId }),
        callApi("get_branches")
      ]);

      if (res?.status === "success") {
        const activeStaff = Array.isArray(res.data) ? res.data.filter(u => u.status === 'active') : [];
        setStaff(activeStaff);
      } else {
        setStaff([]);
      }

      if (branchRes?.status === "success") {
        setBranches(branchRes.data || []);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setStaff([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const rawSession = localStorage.getItem("caketown_session");
    if (!rawSession) {
      router.push("/");
      return;
    }

    try {
      const parsed = JSON.parse(rawSession);

      if (!canRead(parsed.feature_permissions, "view_staff_list")) {
        router.push("/manager/dashboard");
        return;
      }

      setSession(parsed);

      if (parsed?.branch_id) {
        fetchStaffAndBranches(parsed.branch_id);
      }
    } catch (error) {
      console.error("Session parse error:", error);
      router.push("/");
    }

    return () => {
      mountedRef.current = false;
      releaseMedia();
    };
  }, [router]);

  // ─── NEW: TRANSFER HANDLER ───
  const handleTransfer = async () => {
    if (!targetBranchId) return alert("Select a target branch.");
    if (!confirm(`Transfer ${transferModal.name} to the new branch? They will immediately be removed from your roster.`)) return;

    setTransferring(true);
    const res = await callApi("transfer_employee_branch", {
      user_id: transferModal.id,
      new_branch_id: targetBranchId,
      actor_id: session.id,
      actor_role: 'manager'
    });
    setTransferring(false);

    if (res.status === "success") {
      setTransferModal(null);
      setTargetBranchId("");
      fetchStaffAndBranches(session.branch_id); // Refresh roster
    } else {
      alert(res.message || "Failed to transfer employee.");
    }
  };

  // BIOMETRIC LOGIC
  const drawFaceGuide = (ctx, box) => {
    const { x, y, width, height } = box;
    const radius = 16;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.shadowColor = "#10b981";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.stroke();

    ctx.shadowBlur = 0;
  };

  const startDetectionLoop = () => {
    stopDetectionLoop();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const displaySize = {
      width: video.videoWidth || CAMERA_WIDTH,
      height: video.videoHeight || CAMERA_HEIGHT,
    };

    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    faceapi.matchDimensions(canvas, displaySize);

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || video.readyState < 2 || isSavingRef.current || showSuccessRef.current) {
        return;
      }

      try {
        const detection = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: DETECTION_INPUT_SIZE,
              scoreThreshold: 0.5,
            })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detection) {
          latestDescriptorRef.current = null;
          setCapturedDescriptor(null);
          setScanStatus("No face detected");
          return;
        }

        const resized = faceapi.resizeResults(detection, displaySize);
        drawFaceGuide(ctx, resized.detection.box);

        latestDescriptorRef.current = detection.descriptor;
        setCapturedDescriptor(detection.descriptor);
        setScanStatus("Face detected");
      } catch (error) {
        console.error("Detection error:", error);
        latestDescriptorRef.current = null;
        setCapturedDescriptor(null);
        setScanStatus("Camera error");
      }
    }, DETECTION_INTERVAL_MS);
  };

  const startCamera = async () => {
    setScanStatus("Starting camera...");
    setCameraReady(false);
    setCapturedDescriptor(null);
    latestDescriptorRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: CAMERA_WIDTH },
          height: { ideal: CAMERA_HEIGHT },
          aspectRatio: { ideal: 3 / 4 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        setScanStatus("Camera unavailable");
        return;
      }

      videoRef.current.srcObject = stream;

      await new Promise((resolve) => {
        const video = videoRef.current;
        if (!video) return resolve();

        if (video.readyState >= 1 && video.videoWidth > 0) {
          resolve();
          return;
        }

        const handleLoaded = () => {
          video.removeEventListener("loadedmetadata", handleLoaded);
          resolve();
        };

        video.addEventListener("loadedmetadata", handleLoaded);
      });

      await videoRef.current.play();

      setCameraReady(true);
      setScanStatus("Camera ready");
      startDetectionLoop();
    } catch (error) {
      console.error("Camera access error:", error);
      setScanStatus("Camera permission denied");
      setCameraReady(false);
    }
  };

  const openRegistrationModal = async (user) => {
    releaseMedia();
    setRegisteringUser(user);
    setModelsLoaded(false);
    setCameraReady(false);
    setCapturedDescriptor(null);
    latestDescriptorRef.current = null;
    setIsSaving(false);
    setShowSuccess(false);
    setScanStatus("Loading models...");

    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      if (!mountedRef.current) return;

      setModelsLoaded(true);
      await startCamera();
    } catch (error) {
      console.error("Model load error:", error);
      setScanStatus("Failed to load models");
    }
  };

  const saveFaceDescriptor = async () => {
    const descriptorToSave = latestDescriptorRef.current || capturedDescriptor;
    if (!descriptorToSave || !registeringUser || !session) return;

    setIsSaving(true);

    try {
      const res = await callApi("register_face", {
        user_id: registeringUser.id,
        manager_id: session.id,
        branch_id: session.branch_id,
        descriptor: JSON.stringify(Array.from(descriptorToSave)),
      });

      if (res?.status === "success") {
        setShowSuccess(true);
        setIsSaving(false);

        setTimeout(async () => {
          releaseMedia();
          setRegisteringUser(null);
          setModelsLoaded(false);
          setCameraReady(false);
          setCapturedDescriptor(null);
          latestDescriptorRef.current = null;
          setShowSuccess(false);
          setScanStatus("Starting...");
          await fetchStaffAndBranches(session.branch_id);
        }, 1000);
      } else {
        setIsSaving(false);
        setScanStatus(res?.message || "Save failed");
      }
    } catch (error) {
      console.error("Register face error:", error);
      setIsSaving(false);
      setScanStatus("Save failed");
    }
  };

  // PERMISSION CHECKS
  const canModifyFaces = session ? canWrite(session.feature_permissions, "register_face") : false;
  const canTransfer = session ? canWrite(session.feature_permissions, "transfer_employee") : false; // NEW

  const registeredCount = useMemo(() => staff.filter((user) => hasRegisteredFace(user)).length, [staff]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-neutral-200">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-neutral-800 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Branch Staff
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
                Total: {staff.length} | Registered: {registeredCount}
              </p>
            </div>

            <button
              onClick={() => fetchStaffAndBranches(session.branch_id)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-neutral-300 transition hover:bg-slate-100 dark:hover:bg-neutral-800 active:scale-[0.99]"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center px-4 py-16 text-slate-500 dark:text-neutral-400">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-[#111] px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Fetching local roster...</span>
              </div>
            </div>
          ) : staff.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center px-4 py-16 text-slate-500 dark:text-neutral-400">
              No staff found.
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full">
                  <thead className="bg-slate-50 dark:bg-[#111]">
                    <tr className="border-b border-slate-200 dark:border-neutral-800 text-left">
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-neutral-400">
                        Name
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-neutral-400">
                        Department & Role
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-neutral-400">
                        Status
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-neutral-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((user) => {
                      const registered = hasRegisteredFace(user);

                      return (
                        <tr key={user.id} className="border-b border-slate-100 dark:border-neutral-800 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{user.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {user.department || "Unassigned"}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                              {user.designation || user.role || "Staff"}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                registered
                                  ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              {registered ? "Registered" : "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right relative">
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setActionMenuId(actionMenuId === user.id ? null : user.id); 
                              }} 
                              className="p-2 bg-slate-100 dark:bg-neutral-900 rounded-xl hover:bg-slate-200 transition-colors"
                            >
                              <MoreVertical size={16} />
                            </button>

                            {actionMenuId === user.id && (
                              <div className="absolute right-6 top-12 w-48 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                {canModifyFaces && (
                                  <button 
                                    onClick={() => { setActionMenuId(null); openRegistrationModal(user); }}
                                    className="w-full text-left px-4 py-3 text-xs font-black text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                                  >
                                    <ScanFace size={14}/> {hasRegisteredFace(user) ? "Re-register Face" : "Register Face"}
                                  </button>
                                )}
                                {canTransfer && (
                                  <button 
                                    onClick={() => { setActionMenuId(null); setTransferModal(user); }}
                                    className="w-full text-left px-4 py-3 text-xs font-black text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 flex items-center gap-2"
                                  >
                                    <ArrowRight size={14}/> Transfer Branch
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE LIST VIEW */}
                {/* MOBILE LIST VIEW */}
                <div className="divide-y divide-slate-200 dark:divide-neutral-800 md:hidden">
                  {staff.map((user) => {
                    const registered = hasRegisteredFace(user);

                    return (
                      <div key={user.id} className="p-4 relative">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900 dark:text-white">
                              {user.name}
                            </div>
                            <div className="mt-1">
                              <p className="text-sm font-medium text-slate-600 dark:text-neutral-300">
                                {user.department || "Unassigned"}
                              </p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                {user.designation || user.role || "Staff"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                                registered
                                  ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  : "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              {registered ? "Registered" : "Pending"}
                            </span>

                            {/* MOBILE MORE OPTIONS BUTTON */}
                            {(canModifyFaces || canTransfer) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMenuId(actionMenuId === user.id ? null : user.id);
                                }}
                                className="p-2 bg-slate-100 dark:bg-neutral-900 rounded-xl text-slate-600 dark:text-neutral-400"
                              >
                                <MoreVertical size={18} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* MOBILE OPTIONS DROPDOWN */}
                        {actionMenuId === user.id && (
                          <div className="mt-3 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            {canModifyFaces && (
                              <button
                                onClick={() => { setActionMenuId(null); openRegistrationModal(user); }}
                                className="w-full text-left px-4 py-3 text-xs font-black text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 border-b border-slate-100 dark:border-neutral-900 flex items-center gap-2"
                              >
                                <ScanFace size={14} /> {registered ? "Re-register Face" : "Register Face"}
                              </button>
                            )}
                            {canTransfer && (
                              <button
                                onClick={() => { setActionMenuId(null); setTransferModal(user); }}
                                className="w-full text-left px-4 py-3 text-xs font-black text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/10 flex items-center gap-2"
                              >
                                <ArrowRight size={14} /> Transfer Employee
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
            </>
          )}
        </div>
      </div>

      {/* ── TRANSFER MODAL ── */}
      {transferModal && (
        <div className="fixed inset-0 z-[150] bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200 dark:border-neutral-800 animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-neutral-900 bg-slate-50/50 dark:bg-[#111] flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-white">Transfer Employee</h3>
              <button onClick={() => setTransferModal(null)} className="p-2 bg-slate-100 dark:bg-neutral-900 rounded-full hover:bg-slate-200 text-slate-500"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-900/30 p-3 rounded-xl flex items-start gap-2">
                <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">Transferring <strong>{transferModal.name}</strong> will immediately remove them from your active roster.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Target Branch</label>
                <select 
                  value={targetBranchId} 
                  onChange={e => setTargetBranchId(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-[#111] border border-slate-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                >
                  <option value="">Select Destination...</option>
                  {branches.filter(b => b.id !== session.branch_id && b.status === 'active').map(b => (
                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleTransfer} 
                disabled={transferring || !targetBranchId} 
                className="w-full py-3.5 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              >
                {transferring ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={3} />}
                Execute Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BIOMETRIC MODAL ── */}
      {registeringUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm">
          <div className="flex h-full w-full items-end justify-center sm:items-center sm:p-4">
            <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-white dark:bg-[#0a0a0a] sm:h-auto sm:max-h-[92dvh] sm:max-w-md sm:rounded-[28px]">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 px-4 py-4 sm:px-5">
                <h2 className="truncate pr-3 text-base font-semibold text-slate-900 dark:text-white">
                  {registeringUser.name}
                </h2>

                <button
                  onClick={closeRegistrationModal}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-400 transition hover:bg-slate-100 dark:hover:bg-neutral-800"
                  aria-label="Close biometric registration"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="relative overflow-hidden rounded-[28px] border border-slate-200 dark:border-neutral-800 bg-slate-950 dark:bg-black shadow-xl">
                  <div className="relative aspect-[3/4] w-full">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />

                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 h-full w-full"
                      style={{ transform: "scaleX(-1)" }}
                    />

                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      </div>
                    )}

                    {showSuccess && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-emerald-950/75 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3 text-center text-white">
                          <div className="rounded-full bg-emerald-500/20 p-4">
                            <CheckCircle2 className="h-12 w-12 text-emerald-300" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={closeRegistrationModal}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-neutral-300 transition hover:bg-slate-100 dark:hover:bg-neutral-800 active:scale-[0.99]"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>

                  <button
                    onClick={saveFaceDescriptor}
                    disabled={!capturedDescriptor || isSaving || !cameraReady}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-emerald-300 dark:disabled:bg-emerald-800/50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <ScanFace className="h-4 w-4" />
                        Capture
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-3 text-center text-xs text-slate-400 dark:text-neutral-500">
                  {cameraReady ? scanStatus : modelsLoaded ? "Starting camera..." : "Loading models..."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}