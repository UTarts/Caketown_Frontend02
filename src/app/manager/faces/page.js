"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import {
  Camera,
  RefreshCw,
  Loader2,
  Search,
  UserCircle2,
  CheckCircle2,
  AlertTriangle,
  ScanFace,
} from "lucide-react";

const FACE_API_CDN = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.faceapi) return resolve();
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function hasPermission(permissions, key, mode = "write") {
  const p = permissions?.[key] || permissions?.register_faces;
  return !!p?.[mode] || !!p?.write || !!p?.read;
}

export default function ManagerFacesPage() {
  const router = useRouter();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [session, setSession] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [saving, setSaving] = useState(false);

  const [staff, setStaff] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [statusText, setStatusText] = useState("Loading face engine...");
  const [errorText, setErrorText] = useState("");

  const permissions = useMemo(() => session?.feature_permissions || {}, [session]);

  const selectedUser = useMemo(
    () => staff.find((u) => String(u.id) === String(selectedId)) || null,
    [staff, selectedId]
  );

  const filteredStaff = useMemo(() => {
    const q = query.toLowerCase();
    return staff.filter((u) => {
      const txt = `${u.name || ""} ${u.role || ""} ${u.department || ""} ${u.mobile_number || ""}`.toLowerCase();
      return txt.includes(q);
    });
  }, [staff, query]);

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
    } finally {
      setLoadingPage(false);
    }
  }, [router]);

  const fetchStaff = async (branchId) => {
    setLoadingRoster(true);
    const res = await callApi("get_branch_staff", { branch_id: branchId });
    if (res?.status === "success") {
      setStaff(res.data || []);
      if (!selectedId && res.data?.length) setSelectedId(String(res.data[0].id));
    } else {
      setErrorText(res?.message || "Failed to load branch staff.");
    }
    setLoadingRoster(false);
  };

  const bootFaceEngine = async () => {
    try {
      setErrorText("");
      setStatusText("Loading face engine...");
      await loadScript(FACE_API_CDN);

      const faceapi = window.faceapi;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);

      setModelsReady(true);
      setStatusText("Face models loaded");
    } catch {
      setErrorText("Unable to load face recognition models.");
      setStatusText("Model load failed");
    }
  };

  const startCamera = async () => {
    try {
      setErrorText("");
      setStatusText("Opening camera...");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
      setStatusText("Camera ready");
    } catch {
      setErrorText("Camera access failed. Please allow camera permission.");
      setStatusText("Camera failed");
    }
  };

  useEffect(() => {
    if (!session?.branch_id) return;
    if (!hasPermission(permissions, "register_face", "write")) return;

    bootFaceEngine();
    fetchStaff(session.branch_id);
  }, [session, permissions]);

  useEffect(() => {
    if (!modelsReady) return;
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [modelsReady]);

  const handleRegister = async () => {
    if (!selectedUser) {
      setErrorText("Please select an employee first.");
      return;
    }
    if (!videoRef.current || !window.faceapi) {
      setErrorText("Camera or face engine is not ready.");
      return;
    }

    setSaving(true);
    setErrorText("");
    setStatusText("Scanning face...");

    try {
      const faceapi = window.faceapi;

      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      const canvas = canvasRef.current;
      if (canvas && videoRef.current) {
        const size = {
          width: videoRef.current.videoWidth || 960,
          height: videoRef.current.videoHeight || 540,
        };
        canvas.width = size.width;
        canvas.height = size.height;
        faceapi.matchDimensions(canvas, size);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          const resized = faceapi.resizeResults(detection, size);
          faceapi.draw.drawDetections(canvas, resized);
          faceapi.draw.drawFaceLandmarks(canvas, resized);
        }
      }

      if (!detection) {
        setErrorText("No face detected. Center the face and try again.");
        setStatusText("No face detected");
        setSaving(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      const res = await callApi("register_face", {
        user_id: selectedUser.id,
        branch_id: session.branch_id,
        manager_id: session.id,
        descriptor,
        notes,
      });

      if (res?.status === "success") {
        setStatusText(
          selectedUser.face_registered
            ? `Face re-registered for ${selectedUser.name}`
            : `Face registered for ${selectedUser.name}`
        );
        setNotes("");
        await fetchStaff(session.branch_id);
      } else {
        setErrorText(res?.message || "Failed to save face descriptor.");
        setStatusText("Save failed");
      }
    } catch (err) {
      setErrorText(err?.message || "Unexpected error during face registration.");
      setStatusText("Registration failed");
    } finally {
      setSaving(false);
    }
  };

  if (loadingPage || !session) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={34} />
      </div>
    );
  }

  if (!hasPermission(permissions, "register_face", "write")) {
    return (
      <div className="rounded-3xl border border-yellow-200 bg-yellow-50 text-yellow-800 p-6 dark:bg-yellow-900/10 dark:border-yellow-800 dark:text-yellow-300">
        You do not currently have permission to register employee faces.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-gray-900 dark:text-neutral-100">
      <div className="border-b border-gray-200 dark:border-neutral-900 pb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Biometric Setup
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-black dark:text-white">
          Register / Re-register Faces
        </h1>
        <p className="text-sm text-gray-500 mt-2 max-w-3xl">
          Select an employee, scan a clear face image, and save the biometric descriptor for attendance recognition.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-6">
        <section className="rounded-3xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-neutral-900">
            <div className="flex items-center gap-2 mb-3">
              <UserCircle2 size={16} className="text-emerald-500" />
              <h2 className="text-sm font-black">Branch Staff</h2>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee..."
                className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 px-10 py-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-3 space-y-3">
            {loadingRoster ? (
              <div className="p-6 text-sm text-gray-500">Loading staff...</div>
            ) : filteredStaff.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">No staff found.</div>
            ) : (
              filteredStaff.map((user) => {
                const selected = String(user.id) === String(selectedId);
                return (
                  <button
                    key={user.id}
                    onClick={() => setSelectedId(String(user.id))}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      selected
                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-700"
                        : "border-gray-200 dark:border-neutral-900 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-neutral-950"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-black dark:text-white">{user.name}</p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {user.role} • {user.department || "No department"}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">{user.mobile_number}</p>
                      </div>

                      {user.face_registered ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                          <CheckCircle2 size={12} />
                          Registered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                          <AlertTriangle size={12} />
                          Pending
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 dark:border-neutral-900 bg-white dark:bg-black shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-neutral-900 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-black">
                {selectedUser ? selectedUser.name : "Select an employee"}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {selectedUser
                  ? `${selectedUser.role} • ${selectedUser.department || "No department"}`
                  : "Choose a staff member from the left panel"}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-neutral-900">
                Models: {modelsReady ? "Ready" : "Loading"}
              </span>
              <span className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-neutral-900">
                Camera: {cameraReady ? "Ready" : "Waiting"}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="relative rounded-3xl overflow-hidden border border-gray-200 dark:border-neutral-900 bg-neutral-950">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-video object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes for re-registration..."
                className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 px-4 py-3 text-sm outline-none"
              />

              <button
                onClick={startCamera}
                className="rounded-2xl px-4 py-3 text-sm font-black border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900 flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                Restart Camera
              </button>

              <button
                onClick={handleRegister}
                disabled={!selectedUser || !modelsReady || !cameraReady || saving}
                className="rounded-2xl px-5 py-3 text-sm font-black bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <ScanFace size={16} />}
                {selectedUser?.face_registered ? "Re-register Face" : "Register Face"}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-neutral-900 bg-gray-50 dark:bg-neutral-950 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Camera size={16} className="text-emerald-500" />
                <p className="text-sm font-black">Scanner Status</p>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400">{statusText}</p>
              {errorText ? (
                <p className="mt-2 text-sm font-bold text-red-500">{errorText}</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}