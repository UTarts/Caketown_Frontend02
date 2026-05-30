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

function getDepartmentLabel(user) {
  return user?.department || user?.role || "Standard Staff";
}

export default function BranchStaffPage() {
  const router = useRouter();

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

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

  const fetchStaff = async (branchId) => {
    if (!branchId) return;

    setLoading(true);
    try {
      const res = await callApi("get_branch_staff", { branch_id: branchId });
      if (res?.status === "success") {
        setStaff(Array.isArray(res.data) ? res.data : []);
      } else {
        setStaff([]);
      }
    } catch (error) {
      console.error("Staff fetch error:", error);
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
        fetchStaff(parsed.branch_id);
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
          await fetchStaff(session.branch_id);
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

  const canModifyFaces = session
    ? canWrite(session.feature_permissions, "register_face")
    : false;

  const registeredCount = useMemo(
    () => staff.filter((user) => hasRegisteredFace(user)).length,
    [staff]
  );

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Branch Staff
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Total: {staff.length} | Registered: {registeredCount}
              </p>
            </div>

            <button
              onClick={() => fetchStaff(session.branch_id)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.99]"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center px-4 py-16 text-slate-500">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Fetching local roster...</span>
              </div>
            </div>
          ) : staff.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center px-4 py-16 text-slate-500">
              No staff found.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left">
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Name
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Department
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Status
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((user) => {
                      const registered = hasRegisteredFace(user);

                      return (
                        <tr key={user.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{user.name}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {getDepartmentLabel(user)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                registered
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {registered ? "Registered" : "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {canModifyFaces ? (
                              <button
                                onClick={() => openRegistrationModal(user)}
                                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.99] ${
                                  registered
                                    ? "bg-slate-900 hover:bg-slate-800"
                                    : "bg-emerald-600 hover:bg-emerald-700"
                                }`}
                              >
                                <ScanFace className="h-4 w-4" />
                                {registered ? "Re-register" : "Register"}
                              </button>
                            ) : (
                              <span className="text-sm text-slate-400">No access</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-200 md:hidden">
                {staff.map((user) => {
                  const registered = hasRegisteredFace(user);

                  return (
                    <div key={user.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">
                            {user.name}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {getDepartmentLabel(user)}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                            registered
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {registered ? "Registered" : "Pending"}
                        </span>
                      </div>

                      <div className="mt-3">
                        {canModifyFaces ? (
                          <button
                            onClick={() => openRegistrationModal(user)}
                            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99] ${
                              registered
                                ? "bg-slate-900 hover:bg-slate-800"
                                : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            <ScanFace className="h-4 w-4" />
                            {registered ? "Re-register Face" : "Register Face"}
                          </button>
                        ) : (
                          <div className="text-sm text-slate-400">No access</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {registeringUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
          <div className="flex h-full w-full items-end justify-center sm:items-center sm:p-4">
            <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-white sm:h-auto sm:max-h-[92dvh] sm:max-w-md sm:rounded-[28px]">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
                <h2 className="truncate pr-3 text-base font-semibold text-slate-900">
                  {registeringUser.name}
                </h2>

                <button
                  onClick={closeRegistrationModal}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                  aria-label="Close biometric registration"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-xl">
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
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.99]"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>

                  <button
                    onClick={saveFaceDescriptor}
                    disabled={!capturedDescriptor || isSaving || !cameraReady}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-emerald-300"
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

                <div className="mt-3 text-center text-xs text-slate-400">
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