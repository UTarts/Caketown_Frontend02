"use client";
import { useState, useEffect, useRef } from "react";
import { callApi } from "@/lib/apiClient";
import * as faceapi from "face-api.js";
import { Users, Camera, CheckCircle2, AlertCircle, X, Loader2, ScanFace, RefreshCcw } from "lucide-react";

export default function BranchStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  
  const [registeringUser, setRegisteringUser] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scanStatus, setScanStatus] = useState("Initializing Camera...");
  const [isSaving, setIsSaving] = useState(false);
  const [capturedDescriptor, setCapturedDescriptor] = useState(null); // Holds data manually
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const localSession = JSON.parse(localStorage.getItem("caketown_session"));
    setSession(localSession);
    if (localSession?.branch_id) fetchStaff(localSession.branch_id);
  }, []);

  const fetchStaff = async (branchId) => {
    setLoading(true);
    const res = await callApi("get_branch_staff", { branch_id: branchId });
    if (res.status === "success") setStaff(res.data);
    setLoading(false);
  };

  const openRegistrationModal = async (user) => {
    setRegisteringUser(user);
    setCapturedDescriptor(null);
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
    } catch (err) { setScanStatus("Failed to load AI models."); }
  };

  const startCamera = async () => {
    setScanStatus("Align face within the frame...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { setScanStatus("Camera access denied."); }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setRegisteringUser(null);
    setModelsLoaded(false);
    setCapturedDescriptor(null);
  };

  const handleVideoPlay = () => {
    if (!modelsLoaded) return;
    const canvas = canvasRef.current;
    if (canvas && videoRef.current) {
      canvas.innerHTML = faceapi.createCanvasFromMedia(videoRef.current);
      const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);

      const detectionInterval = setInterval(async () => {
        if (!videoRef.current || isSaving) return;
        const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detection) {
          faceapi.draw.drawDetections(canvas, faceapi.resizeResults(detection, displaySize));
          // Store the latest clear frame in state, but DO NOT auto-save
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
      }, 500); 
      
      return () => clearInterval(detectionInterval);
    }
  };

  const saveFaceDescriptor = async () => {
    if (!capturedDescriptor) return;
    setIsSaving(true);
    setScanStatus("Locking to Vault...");
    
    const res = await callApi("register_face", {
      user_id: registeringUser.id,
      manager_id: session.id,
      branch_id: session.branch_id,
      descriptor: JSON.stringify(Array.from(capturedDescriptor)) 
    });

    if (res.status === "success") {
      stopCamera();
      fetchStaff(session.branch_id); 
    } else {
      alert(res.message);
      setScanStatus("Failed to save. Try again.");
    }
    setIsSaving(false);
  };

  return (
    <div className="text-gray-900 dark:text-neutral-200 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col gap-2 border-b border-gray-200 dark:border-neutral-800 pb-6">
          <div className="flex items-center gap-3 text-blue-600 dark:text-blue-500">
            <Users size={20} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase">Branch Operations</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-black dark:text-white tracking-tight">Staff Roster & Biometrics</h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-neutral-500">
            Manage your branch employees and securely register their facial data.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((user) => (
              <div key={user.id} className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-black dark:text-white truncate pr-2">{user.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">UID: {user.id}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-neutral-400 capitalize mb-4">{user.role}</p>
                
                {user.is_registered ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-center gap-2 w-full py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg font-bold text-sm border border-emerald-200 dark:border-emerald-500/20">
                      <CheckCircle2 size={16} /> Biometrics Active
                    </div>
                    {/* Manager Override Button */}
                    <button onClick={() => openRegistrationModal(user)} className="flex items-center justify-center gap-2 w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300 rounded-lg font-bold text-xs transition-colors">
                      <RefreshCcw size={14} /> Update Face Data
                    </button>
                  </div>
                ) : (
                  <button onClick={() => openRegistrationModal(user)} className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-colors">
                    <Camera size={16} /> Register Identity
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* REGISTRATION MODAL */}
        {registeringUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
              
              <div className="p-4 flex justify-between items-center border-b border-gray-200 dark:border-neutral-800">
                <h3 className="font-bold flex items-center gap-2 dark:text-white">
                  <ScanFace size={18} className="text-blue-500"/> Registering: {registeringUser.name}
                </h3>
                <button onClick={stopCamera} className="text-gray-500 hover:text-red-500"><X size={20}/></button>
              </div>

              <div className="relative aspect-video bg-black flex items-center justify-center">
                <video ref={videoRef} onPlay={handleVideoPlay} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                
                {isSaving && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-emerald-400 z-30">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <p className="font-bold text-sm tracking-widest">ENCRYPTING & SAVING...</p>
                  </div>
                )}
              </div>

              {/* Manual Control Panel */}
              <div className="p-4 bg-gray-50 dark:bg-black border-t border-gray-200 dark:border-neutral-800 flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-widest ${capturedDescriptor ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {scanStatus}
                </span>
                
                <button 
                  onClick={saveFaceDescriptor} 
                  disabled={!capturedDescriptor || isSaving}
                  className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:dark:bg-neutral-800 text-white font-bold rounded-xl transition-all active:scale-95"
                >
                  Capture & Lock
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}