"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/apiClient";
import { canRead, canWrite } from "@/lib/permissions";
import * as faceapi from "face-api.js";
import { 
  Users, Camera, CheckCircle2, AlertCircle, X, 
  Loader2, ScanFace, RefreshCcw, Shield, ShieldAlert 
} from "lucide-react";

export default function BranchStaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  
  // Biometric Modal States
  const [registeringUser, setRegisteringUser] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scanStatus, setScanStatus] = useState("Initializing Secure Camera...");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false); // New Success State
  const [capturedDescriptor, setCapturedDescriptor] = useState(null); 
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const rawSession = localStorage.getItem("caketown_session");
    if (!rawSession) { router.push("/"); return; }
    
    const parsed = JSON.parse(rawSession);
    
    // ─── GATEKEEPER: READ ACCESS ───
    if (!canRead(parsed.feature_permissions, 'view_staff_list')) {
      router.push("/manager/dashboard");
      return;
    }
    
    setSession(parsed);
    if (parsed?.branch_id) fetchStaff(parsed.branch_id);
  }, [router]);

  const fetchStaff = async (branchId) => {
    setLoading(true);
    const res = await callApi("get_branch_staff", { branch_id: branchId });
    if (res.status === "success") setStaff(res.data);
    setLoading(false);
  };

  const openRegistrationModal = async (user) => {
    setRegisteringUser(user);
    setCapturedDescriptor(null);
    setShowSuccess(false);
    setScanStatus("Loading AI Models...");
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      startCamera();
    } catch (err) { setScanStatus("Failed to load AI models. Check network."); }
  };

  const startCamera = async () => {
    setScanStatus("Align face within the frame...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { setScanStatus("Camera access denied. Please allow permissions."); }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setRegisteringUser(null);
    setModelsLoaded(false);
    setCapturedDescriptor(null);
    setShowSuccess(false);
  };

  const handleVideoPlay = () => {
    if (!modelsLoaded) return;
    const canvas = canvasRef.current;
    if (canvas && videoRef.current) {
      canvas.innerHTML = faceapi.createCanvasFromMedia(videoRef.current);
      const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);

      const detectionInterval = setInterval(async () => {
        if (!videoRef.current || isSaving || showSuccess) return;
        const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          faceapi.draw.drawDetections(canvas, faceapi.resizeResults(detection, displaySize));
          if (detection.detection.score > 0.85) {
            setCapturedDescriptor(detection.descriptor);
            setScanStatus("Face aligned. Ready to capture.");
          } else {
            setCapturedDescriptor(null);
            setScanStatus("Please hold still...");
          }
        } else {
          setCapturedDescriptor(null);
        }
      }, 400); 
      
      return () => clearInterval(detectionInterval);
    }
  };

  const saveFaceDescriptor = async () => {
    if (!capturedDescriptor) return;
    setIsSaving(true);
    setScanStatus("Locking biometric data to Vault...");
    
    const res = await callApi("register_face", {
      user_id: registeringUser.id,
      manager_id: session.id,
      branch_id: session.branch_id,
      descriptor: JSON.stringify(Array.from(capturedDescriptor)) 
    });

    if (res.status === "success") {
      setIsSaving(false);
      setShowSuccess(true); // Trigger UI Success State
      setScanStatus("Face registered successfully.");
      
      // Wait 1.5 seconds so the user can see the success message, then close and refresh
      setTimeout(() => {
        stopCamera();
        fetchStaff(session.branch_id); 
      }, 1500);

    } else {
      alert(res.message);
      setScanStatus("Failed to save. Try again.");
      setIsSaving(false);
    }
  };

  if (!session) return null;

  // ─── GATEKEEPER: WRITE ACCESS ───
  const canModifyFaces = canWrite(session.feature_permissions, 'register_face');

  return (
    <div className="text-gray-900 dark:text-neutral-200 font-sans animate-in fade-in duration-500 pb-24 px-3 md:px-0">
      <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto">
        
        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white/60 dark:bg-neutral-900/40 p-5 md:p-6 rounded-3xl backdrop-blur-xl border border-gray-200/60 dark:border-neutral-800/60 shadow-sm mt-3 md:mt-0">
          <div>
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-500 mb-1">
              <Users size={14} className="shrink-0" />
              <span className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase truncate">Branch Operations</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Staff Roster & Biometrics
            </h1>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1.5 font-medium max-w-md">
              Manage employees and securely assign their facial recognition vectors for the terminal.
            </p>
          </div>

          {!canModifyFaces && (
            <div className="bg-yellow-50 dark:bg-yellow-500/10 px-4 py-2.5 rounded-xl border border-yellow-200 dark:border-yellow-900/50 flex items-center gap-2 text-yellow-700 dark:text-yellow-500 text-xs font-bold shrink-0">
               <ShieldAlert size={16}/> Read-Only Mode
            </div>
          )}
        </div>

        {/* ── RESPONSIVE LIST / TABLE ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="animate-spin text-purple-500" size={40} strokeWidth={2.5} />
            <p className="text-sm font-bold text-gray-500 tracking-widest uppercase">Fetching Local Roster...</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-3xl shadow-sm overflow-hidden">
            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-5 border-b border-gray-100 dark:border-neutral-900 bg-gray-50/50 dark:bg-[#050505]/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <div className="col-span-5">Employee Details</div>
              <div className="col-span-4 text-center">Biometric Status</div>
              <div className="col-span-3 text-right">Vault Action</div>
            </div>

            {/* List Body */}
            <div className="divide-y divide-gray-100 dark:divide-neutral-900">
              {staff.map((user) => (
                <div key={user.id} className="flex flex-col md:grid md:grid-cols-12 gap-4 p-5 md:items-center hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors group">
                  
                  {/* Mobile: Top Section (Name & Dept) | Desktop: Column 1 */}
                  <div className="col-span-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-neutral-800 text-gray-500 flex items-center justify-center text-sm font-black border border-gray-200 dark:border-neutral-700 shrink-0 shadow-inner">
                      {user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-base text-gray-900 dark:text-white truncate">{user.name}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-0.5 truncate">{user.department || "Standard Staff"}</p>
                    </div>
                  </div>
                  
                  {/* Mobile: Middle Section (Status Badge) | Desktop: Column 2 */}
                  <div className="col-span-4 flex md:justify-center">
                    {user.face_registered ? ( // FIXED FROM is_registered
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl font-black text-[10px] uppercase tracking-widest border border-emerald-200 dark:border-emerald-900/50">
                        <CheckCircle2 size={14} /> Registered Active
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 rounded-xl font-black text-[10px] uppercase tracking-widest border border-gray-200 dark:border-neutral-800 border-dashed">
                         <AlertCircle size={14} /> Unregistered
                      </div>
                    )}
                  </div>

                  {/* Mobile: Bottom Section (Action Button) | Desktop: Column 3 */}
                  <div className="col-span-3 flex md:justify-end mt-2 md:mt-0">
                    {canModifyFaces ? (
                      user.face_registered ? ( // FIXED FROM is_registered
                        <button onClick={() => openRegistrationModal(user)} className="w-full md:w-auto px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-300 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-gray-200 dark:border-neutral-700">
                          <RefreshCcw size={14} /> Re-Scan
                        </button>
                      ) : (
                        <button onClick={() => openRegistrationModal(user)} className="w-full md:w-auto px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 active:scale-95 flex items-center justify-center gap-2">
                          <Camera size={16} /> Register Face
                        </button>
                      )
                    ) : (
                      <div className="w-full md:w-auto px-4 py-2 bg-transparent text-gray-400 dark:text-neutral-600 text-[10px] font-black uppercase tracking-widest text-center md:text-right">
                        Action Locked
                      </div>
                    )}
                  </div>

                </div>
              ))}
              {staff.length === 0 && (
                <div className="p-12 text-center text-gray-400 font-bold">No staff assigned to this branch.</div>
              )}
            </div>
          </div>
        )}

        {/* ── MOBILE-OPTIMIZED REGISTRATION MODAL ── */}
        {registeringUser && canModifyFaces && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end md:items-center justify-center sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-t-[2rem] md:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300 max-h-[90dvh] relative">
              
              <div className="p-5 flex justify-between items-center bg-gray-50/50 dark:bg-neutral-900/50 border-b border-gray-100 dark:border-neutral-800 shrink-0">
                <div>
                  <h3 className="font-black flex items-center gap-2 text-gray-900 dark:text-white">
                    <ScanFace size={18} className="text-purple-500"/> Secure Vault Entry
                  </h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Registering: {registeringUser.name}</p>
                </div>
                {!isSaving && !showSuccess && (
                  <button onClick={stopCamera} className="p-2 bg-gray-200 dark:bg-neutral-800 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors"><X size={16} className="text-gray-600 dark:text-neutral-300" /></button>
                )}
              </div>

              {/* Video Area */}
              <div className="relative aspect-[3/4] md:aspect-square bg-black flex items-center justify-center overflow-hidden shrink-0">
                <video ref={videoRef} onPlay={handleVideoPlay} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
                
                {/* Face Target Guide overlay */}
                <div className="absolute inset-0 border-[8px] border-black/30 pointer-events-none md:rounded-3xl z-10"></div>
                
                {/* Saving Overlay */}
                {isSaving && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-purple-400 z-30 animate-in fade-in">
                    <Loader2 className="animate-spin mb-4" size={48} strokeWidth={2.5}/>
                    <p className="font-black text-sm tracking-[0.2em] uppercase">Encrypting to Vault</p>
                  </div>
                )}

                {/* HIGH-END SUCCESS OVERLAY */}
                {showSuccess && (
                  <div className="absolute inset-0 bg-emerald-500/90 backdrop-blur-md flex flex-col items-center justify-center text-white z-40 animate-in zoom-in-95 duration-200">
                    <CheckCircle2 className="mb-4" size={64} strokeWidth={2.5} />
                    <p className="font-black text-lg tracking-[0.2em] uppercase">Identity Locked</p>
                  </div>
                )}
              </div>

              {/* Control Panel (Fixed to bottom for mobile) */}
              <div className="p-5 bg-white dark:bg-[#0a0a0a] border-t border-gray-100 dark:border-neutral-800 flex flex-col gap-4 shrink-0 pb-safe">
                <div className="flex items-center justify-center gap-2 text-center">
                  {capturedDescriptor ? <CheckCircle2 size={16} className="text-emerald-500" /> : (!showSuccess && !isSaving && <Loader2 size={16} className="animate-spin text-gray-500" />)}
                  <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${capturedDescriptor || showSuccess ? 'text-emerald-500' : 'text-gray-500 dark:text-neutral-400'}`}>
                    {scanStatus}
                  </span>
                </div>
                
                <button 
                  onClick={saveFaceDescriptor} 
                  disabled={!capturedDescriptor || isSaving || showSuccess}
                  className="w-full py-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:dark:bg-[#111] disabled:dark:text-neutral-600 disabled:dark:border-neutral-800 disabled:shadow-none text-white border border-transparent font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]"
                >
                  Capture & Assign Identity
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}