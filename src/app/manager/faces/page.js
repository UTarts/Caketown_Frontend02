"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as faceapi from "face-api.js";
import { callApi } from "@/lib/apiClient";
import {
  ScanFace, Loader2, AlertCircle, CheckCircle2,
  Camera, Users, Search, UserCircle2, AlertTriangle, ShieldCheck
} from "lucide-react";

// --- Configuration ---
const SCAN_INTERVAL_MS = 150; // Faster interval for smooth tracking

// Helper to check permissions
function hasPermission(permissions, key, mode = "write") {
  const p = permissions?.[key] || permissions?.register_face;
  return !!p?.[mode] || !!p?.write;
}

export default function ManagerFacesPage() {
  const router = useRouter();
  
  // State
  const [session, setSession] = useState(null);
  const [staff, setStaff] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [systemMessage, setSystemMessage] = useState({ text: "Initializing engine...", type: "loading" });

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const processingRef = useRef(false);
  const latestDescriptorRef = useRef(null); // Stores the live tracked face

  const permissions = useMemo(() => session?.feature_permissions || {}, [session]);

  const selectedUser = useMemo(
    () => staff.find((u) => String(u.id) === String(selectedId)) || null,
    [staff, selectedId]
  );

  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return staff.filter((u) => 
      `${u.name} ${u.role} ${u.mobile_number}`.toLowerCase().includes(q)
    );
  }, [staff, searchQuery]);

  // ─── INITIALIZATION ────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("caketown_session");
    if (!raw) { router.push("/"); return; }
    
    try {
      const parsed = JSON.parse(raw);
      if (parsed.role !== "manager") { router.push("/"); return; }
      setSession(parsed);
      fetchStaff(parsed.branch_id);
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    if (session?.branch_id && hasPermission(session.feature_permissions, "register_face", "write")) {
      bootFaceEngine();
    }
    return () => stopCamera();
  }, [session]);

  const fetchStaff = async (branchId) => {
    const res = await callApi("get_branch_staff", { branch_id: branchId });
    if (res?.status === "success") {
      setStaff(res.data || []);
    } else {
      setSystemMessage({ text: res?.message || "Failed to load staff.", type: "error" });
    }
    setLoading(false);
  };

  const bootFaceEngine = async () => {
    try {
      setSystemMessage({ text: "Loading AI models...", type: "loading" });
      const MODEL_URL = "/models";
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      
      setModelsReady(true);
      startCamera();
    } catch (err) {
      console.error(err);
      setSystemMessage({ text: "Failed to load face models.", type: "error" });
    }
  };

  const startCamera = async () => {
    try {
      setSystemMessage({ text: "Starting camera...", type: "loading" });
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
      setSystemMessage({ text: "Camera ready. Select an employee.", type: "idle" });
    } catch (err) {
      console.error(err);
      setSystemMessage({ text: "Camera access denied or unavailable.", type: "error" });
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // ─── CAMERA & DETECTION LOOP ──────────────────────────────────────────────
  const drawPremiumBox = (ctx, box, color) => {
    const { x, y, width, height } = box;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.rect(x, y, width, height); 
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const handleVideoOnPlay = () => {
    if (!modelsReady || !videoRef.current || !canvasRef.current) return;
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const video = videoRef.current;
    const canvas = canvasRef.current;

    scanIntervalRef.current = setInterval(async () => {
      if (processingRef.current || video.readyState < 2) return;
      processingRef.current = true;

      const displaySize = { 
        width: video.videoWidth || video.clientWidth || 720, 
        height: video.videoHeight || video.clientHeight || 960 
      };
      
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
      faceapi.matchDimensions(canvas, displaySize);

      try {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
          .withFaceLandmarks().withFaceDescriptor();

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detection) {
          latestDescriptorRef.current = null;
          if (selectedId) setSystemMessage({ text: "Position face in frame...", type: "idle" });
          processingRef.current = false;
          return;
        }

        // We have a face! Save the descriptor for instant capture
        latestDescriptorRef.current = Array.from(detection.descriptor);
        
        const resized = faceapi.resizeResults(detection, displaySize);
        
        // Draw green box if selected, amber if just looking
        const boxColor = selectedId ? "#10b981" : "#f59e0b";
        drawPremiumBox(ctx, resized.detection.box, boxColor);

        if (selectedId && !saving) {
          setSystemMessage({ text: "Face locked. Ready to register.", type: "success" });
        }

      } catch (err) {
        console.error("Detection error:", err);
      } finally {
        processingRef.current = false;
      }
    }, SCAN_INTERVAL_MS);
  };

  // ─── REGISTER API CALL ────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!selectedUser) return;
    if (!latestDescriptorRef.current) {
      alert("No face detected. Please ensure the employee is looking at the camera.");
      return;
    }

    setSaving(true);
    setSystemMessage({ text: "Encrypting and saving biometrics...", type: "loading" });

    try {
      const res = await callApi("register_face", {
        user_id: selectedUser.id,
        branch_id: session.branch_id,
        manager_id: session.id,
        descriptor: latestDescriptorRef.current
      });

      if (res?.status === "success") {
        setSystemMessage({ text: `Biometrics saved for ${selectedUser.name}!`, type: "success" });
        // Refresh roster to update the badge
        await fetchStaff(session.branch_id);
        // Clear selection so they can move to the next person
        setTimeout(() => setSelectedId(""), 2000);
      } else {
        setSystemMessage({ text: res?.message || "Failed to save face.", type: "error" });
      }
    } catch (err) {
      setSystemMessage({ text: "Network error during registration.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (loading || !session) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} strokeWidth={2} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Initializing Setup...</p>
      </div>
    );
  }

  if (!hasPermission(permissions, "register_face", "write")) {
    return (
      <div className="rounded-3xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-500/10 p-8 text-center mt-10">
        <ShieldCheck size={48} className="text-yellow-500 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-black text-yellow-800 dark:text-yellow-400 mb-2">Access Denied</h2>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">You do not have permission to register biometric data.</p>
      </div>
    );
  }

  // To break out of the padding on mobile, we use negative margins
  return (
    <div className="-mx-4 md:mx-0 -mt-4 md:mt-0 flex flex-col md:flex-row bg-gray-50 dark:bg-[#050505] md:bg-white md:dark:bg-[#0a0a0a] min-h-[calc(100vh-64px)] md:min-h-[80vh] md:rounded-[3rem] md:border border-gray-200 dark:border-neutral-800 md:shadow-2xl overflow-hidden animate-in fade-in duration-500 relative z-0">
      
      {/* ── LEFT: CAMERA HERO ── */}
      <div className="w-full md:w-1/2 lg:w-3/5 relative flex flex-col bg-black z-0 min-h-[50vh] md:min-h-full">
        
        {/* Video & Canvas */}
        <video ref={videoRef} autoPlay muted playsInline onPlay={handleVideoOnPlay} className="absolute inset-0 w-full h-full object-cover z-10" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-20" />

        {/* Top Gradient & Title */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/80 to-transparent z-30 p-6 pointer-events-none">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Biometric Setup</p>
          <h2 className="text-2xl font-black text-white">{selectedUser ? selectedUser.name : "Select Employee"}</h2>
        </div>

        {/* Target Overlay (Subtle guide for face) */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none opacity-30">
          <div className="w-64 h-80 border-2 border-dashed border-white rounded-[3rem]"></div>
        </div>

        {/* Bottom Status Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-30 flex flex-col justify-end">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            {systemMessage.type === "loading" ? <Loader2 className="animate-spin text-emerald-400 shrink-0" size={24} /> :
             systemMessage.type === "error" ? <AlertCircle className="text-red-400 shrink-0" size={24} /> :
             systemMessage.type === "success" ? <CheckCircle2 className="text-emerald-400 shrink-0" size={24} /> :
             <ScanFace className="text-blue-400 shrink-0" size={24} />}
            <p className="font-bold text-sm leading-tight text-white">{systemMessage.text}</p>
          </div>
        </div>
      </div>

      {/* ── RIGHT: STAFF ROSTER ── */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col bg-white dark:bg-[#0a0a0a] z-10 h-auto md:h-full flex-1">
        
        <div className="p-5 md:p-6 border-b border-gray-100 dark:border-neutral-900 shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-emerald-500" />
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Active Roster</h2>
          </div>
          
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search personnel..."
              className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4 space-y-2 pb-32 md:pb-4">
          {filteredStaff.length === 0 ? (
            <div className="text-center p-8 text-gray-400 font-bold text-sm">No employees found.</div>
          ) : (
            filteredStaff.map((user) => {
              const isSelected = String(user.id) === String(selectedId);
              return (
                <button
                  key={user.id}
                  onClick={() => setSelectedId(String(user.id))}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                    isSelected 
                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-800 shadow-sm" 
                      : "bg-white dark:bg-[#0a0a0a] border-gray-100 dark:border-neutral-900 hover:border-emerald-200 dark:hover:border-emerald-900/50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="pr-3">
                      <p className={`font-black text-base leading-tight mb-1 ${isSelected ? 'text-emerald-900 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                        {user.name}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.role}</p>
                    </div>
                    {user.face_registered ? (
                      <span className="shrink-0 flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider">
                        <CheckCircle2 size={10} strokeWidth={3} /> Registered
                      </span>
                    ) : (
                      <span className="shrink-0 flex items-center gap-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider">
                        <AlertTriangle size={10} strokeWidth={3} /> Pending
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ── STICKY BOTTOM REGISTRATION BUTTON ── */}
        <div className="sticky bottom-0 left-0 right-0 p-4 md:p-6 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-gray-100 dark:border-neutral-900 pb-safe md:pb-6 z-20">
          <button
            onClick={handleRegister}
            disabled={!selectedUser || !modelsReady || !cameraReady || saving}
            className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            {saving ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ScanFace size={20} strokeWidth={2.5} />
            )}
            {saving ? "Encrypting Biometrics..." : selectedUser ? `Register Face for ${selectedUser.name}` : "Select Employee First"}
          </button>
        </div>

      </div>
    </div>
  );
}