"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { callApi } from "@/lib/apiClient";
import {
  ScanFace, Loader2, AlertCircle, CheckCircle2, Power, Pause,
  Camera, Users, ShieldCheck, RefreshCw, Activity, Clock3, UserCheck, UserX
} from "lucide-react";

// --- Configuration ---
const MATCH_THRESHOLD = 0.45;
const DB_COOLDOWN_MS = 60000; // 60 seconds strict DB cooldown
const SCAN_INTERVAL_MS = 1200;

// Helper: Safely parse the 128-float array from the database JSON
function parseDescriptor(input) {
  try {
    if (!input) return null;
    if (input instanceof Float32Array) return input.length === 128 ? input : null;
    if (Array.isArray(input)) {
      const arr = input.map(Number).filter(Number.isFinite);
      return arr.length === 128 ? new Float32Array(arr) : null;
    }
    if (typeof input === "string") {
      const parsed = JSON.parse(input);
      const arr = (Array.isArray(parsed) ? parsed : Object.values(parsed)).map(Number).filter(Number.isFinite);
      return arr.length === 128 ? new Float32Array(arr) : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Helper: Get local YYYY-MM-DD accurately (avoids UTC timezone bugs)
function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Helper: Format Duration (Handles minutes)
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}h ${m}m`;
}

export default function BiometricTerminal() {
  const [session, setSession] = useState(null);
  const [terminalActive, setTerminalActive] = useState(false);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [systemMessage, setSystemMessage] = useState({ text: "Terminal offline. Tap Start to begin.", type: "idle" });
  
  const [recentPunches, setRecentPunches] = useState([]);
  const [rosterCount, setRosterCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [presentCount, setPresentCount] = useState(0);
  const [totalStaff, setTotalStaff] = useState(0);
  const [syncingFeed, setSyncingFeed] = useState(false);

  // Refs for camera and logic
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const faceMatcherRef = useRef(null);
  const processingRef = useRef(false);
  
  // Database State Reference (Crucial for DB-driven cooldowns)
  const allPeopleRef = useRef([]);
  const tempLockRef = useRef(new Map());

  // --- Core Lifecycle ---
  useEffect(() => {
    const rawSession = localStorage.getItem("caketown_session");
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      setSession(parsed);
      fetchRecentFromDb(parsed.branch_id);
      
      // Sync with DB every 10 seconds to keep cooldowns accurate
      const interval = setInterval(() => fetchRecentFromDb(parsed.branch_id, true), 10000);
      return () => {
        clearInterval(interval);
        stopTerminal();
      };
    }
  }, []);

  // --- Database Synchronization ---
  const fetchRecentFromDb = async (branchId, silent = false) => {
    if (!branchId) return;
    if (!silent) setSyncingFeed(true);

    try {
      const today = getLocalDate();
      const res = await callApi("get_live_attendance", { branch_id: branchId, date: today });

      if (res?.status === "success") {
        const people = res.data?.all_people || [];
        allPeopleRef.current = people; 
        
        setPresentCount(Number(res.present_count || 0));
        setTotalStaff(Number(res.total_staff || people.length));

        const flat = [];
        people.forEach((person) => {
          if (Array.isArray(person.punches)) {
            person.punches.forEach((time, index) => {
              flat.push({
                id: `${person.id}-${time}-${index}`,
                name: person.name,
                role: person.role || "Staff",
                type: index % 2 === 0 ? "IN" : "OUT",
                rawTime: time,
                time: new Date(time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
              });
            });
          }
        });

        flat.sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime));
        setRecentPunches(flat.slice(0, 10)); 
      }
    } catch (error) {
      console.error("Feed sync error:", error);
    } finally {
      if (!silent) setSyncingFeed(false);
    }
  };

  // --- Terminal Controls ---
  const stopTerminal = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    
    processingRef.current = false;
    setTerminalActive(false);
    setCameraReady(false);
    setSystemMessage({ text: "Terminal offline.", type: "idle" });
  };

  const startTerminal = async () => {
    if (!session?.branch_id) return;
    setLoading(true);
    setTerminalActive(true);
    setSystemMessage({ text: "Loading AI models...", type: "loading" });

    try {
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setIsModelsLoaded(true);
      setSystemMessage({ text: "Fetching branch biometric roster...", type: "loading" });

      const res = await callApi("get_branch_descriptors", { branch_id: session.branch_id });
      if (res?.status !== "success" || !res.data || res.data.length === 0) {
        setSystemMessage({ text: "No registered faces in this branch.", type: "error" });
        setLoading(false);
        return;
      }

      const labeledDescriptors = res.data
        .map((user) => {
          const descriptor = parseDescriptor(user.face_descriptor);
          return descriptor ? new faceapi.LabeledFaceDescriptors(String(user.id), [descriptor]) : null;
        })
        .filter(Boolean);

      faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
      setRosterCount(labeledDescriptors.length);
      setSystemMessage({ text: "Starting camera...", type: "loading" });

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
      setSystemMessage({ text: "Terminal online. Ready to scan.", type: "success" });
    } catch (err) {
      console.error("Camera Init Error:", err);
      setSystemMessage({ text: "Camera error. Check permissions.", type: "error" });
      setTerminalActive(false);
    } finally {
      setLoading(false);
    }
  };

  // --- Premium Canvas Drawing ---
  const drawPremiumBox = (ctx, box, label, color) => {
    const { x, y, width, height } = box;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.rect(x, y, width, height); 
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = color;
    const textWidth = ctx.measureText(label).width;
    ctx.beginPath();
    ctx.rect(x, y - 32, textWidth + 24, 28);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(label, x + 12, y - 12);
  };

  // --- Facial Recognition Loop ---
  const handleVideoOnPlay = () => {
    if (!isModelsLoaded || !faceMatcherRef.current || !videoRef.current || !canvasRef.current) return;
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const video = videoRef.current;
    const canvas = canvasRef.current;

    scanIntervalRef.current = setInterval(async () => {
      if (processingRef.current || video.readyState < 2) return;
      processingRef.current = true;

      // FIX: Robust Dimensions to prevent resizeResults crash
      const displaySize = { 
        width: video.videoWidth || video.clientWidth || 720, 
        height: video.videoHeight || video.clientHeight || 960 
      };
      
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
      faceapi.matchDimensions(canvas, displaySize);

      try {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks().withFaceDescriptor();

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detection) {
          setSystemMessage({ text: "Looking for face...", type: "idle" });
          processingRef.current = false;
          return;
        }

        const resized = faceapi.resizeResults(detection, displaySize);
        const bestMatch = faceMatcherRef.current.findBestMatch(detection.descriptor);

        if (!bestMatch || bestMatch.label === "unknown") {
          drawPremiumBox(ctx, resized.detection.box, "UNKNOWN", "#ef4444"); 
          setSystemMessage({ text: "Face not recognized.", type: "error" });
          processingRef.current = false;
          return;
        }

        const matchedUserId = String(bestMatch.label);
        const now = Date.now();
        
        // 1. Temporary Network Lock
        const localLock = tempLockRef.current.get(matchedUserId);
        if (localLock && now - localLock < 5000) {
          processingRef.current = false;
          return; 
        }

        // 2. TRUE Database-Driven Cooldown Check
        const dbPerson = allPeopleRef.current.find(p => String(p.id) === matchedUserId);
        if (dbPerson && dbPerson.last_punch) {
          const lastDbTime = new Date(dbPerson.last_punch).getTime();
          if (now - lastDbTime < DB_COOLDOWN_MS) {
            const remain = Math.ceil((DB_COOLDOWN_MS - (now - lastDbTime)) / 1000);
            drawPremiumBox(ctx, resized.detection.box, `WAIT ${remain}s`, "#f59e0b");
            setSystemMessage({ text: `${dbPerson.name}, please wait ${remain}s.`, type: "idle" });
            processingRef.current = false;
            return;
          }
        }

        tempLockRef.current.set(matchedUserId, now);
        setSystemMessage({ text: "Verifying...", type: "loading" });

        // Isolate API Error vs FaceAPI Error
        let res;
        try {
          res = await callApi("log_punch", { user_id: matchedUserId, branch_id: session.branch_id });
        } catch (apiErr) {
          console.error("API Network Error:", apiErr);
          setSystemMessage({ text: "Network error saving punch.", type: "error" });
          tempLockRef.current.delete(matchedUserId);
          processingRef.current = false;
          return;
        }

        if (res?.status === "success") {
          const punchType = String(res.punch_type).toUpperCase().includes("OUT") ? "OUT" : "IN";
          const color = punchType === "IN" ? "#10b981" : "#f59e0b"; 
          
          drawPremiumBox(ctx, resized.detection.box, `PUNCH ${punchType}`, color);
          setSystemMessage({ text: `Success: ${res.user_name} punched ${punchType}`, type: "success" });
          
          await fetchRecentFromDb(session.branch_id, true);
        } else {
          tempLockRef.current.delete(matchedUserId); 
          setSystemMessage({ text: res?.message || "Punch failed.", type: "error" });
        }
      } catch (err) {
        console.error("Face Processing Error:", err);
        setSystemMessage({ text: "Camera processing error.", type: "error" });
      } finally {
        processingRef.current = false;
      }
    }, SCAN_INTERVAL_MS);
  };

  // Helper to compute Break Minutes dynamically from raw punches
  const calculateBreakMinutes = (punches) => {
    if (!punches || punches.length < 2) return 0;
    let breakMins = 0;
    for (let i = 1; i + 1 < punches.length; i += 2) {
      const outTime = new Date(punches[i]).getTime();
      const inTime = new Date(punches[i+1]).getTime();
      if (inTime > outTime) {
        breakMins += (inTime - outTime) / 60000;
      }
    }
    return breakMins;
  };

  if (!session) return <div className="min-h-screen flex items-center justify-center bg-[#050505]"><Loader2 className="animate-spin text-emerald-500" size={34} /></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col md:flex-row selection:bg-emerald-500 selection:text-white">
      
      {/* --- LEFT / TOP PORTION: THE CAMERA HERO --- */}
      <div className="w-full md:w-1/2 lg:w-3/5 relative flex flex-col items-center justify-center p-4 md:p-8 border-b md:border-b-0 md:border-r border-neutral-900 bg-black">
        <div className="w-full max-w-lg aspect-[3/4] md:aspect-auto md:h-[80vh] bg-[#111] rounded-[2rem] border border-neutral-800 overflow-hidden relative shadow-2xl shadow-emerald-500/5">
          
          <video ref={videoRef} autoPlay muted playsInline onPlay={handleVideoOnPlay} className="absolute inset-0 w-full h-full object-cover md:object-contain bg-black z-10" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover md:object-contain z-20" />

          {!terminalActive && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/80 backdrop-blur-sm">
              <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center mb-4 border border-neutral-800">
                <ScanFace size={36} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black mb-2">Terminal Offline</h2>
              <p className="text-sm text-neutral-400 max-w-xs">Activate the terminal to initialize biometric models and open the camera.</p>
            </div>
          )}

          <div className="absolute top-4 left-4 right-4 flex justify-between z-30">
            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${terminalActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-neutral-900/80 text-neutral-400 border-neutral-800'}`}>
              {terminalActive ? "Live Monitoring" : "Standby"}
            </span>
            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${cameraReady ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-neutral-900/80 text-neutral-400 border-neutral-800'}`}>
              {cameraReady ? "Camera Ready" : "Camera Off"}
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-30">
            <div className="bg-black/60 backdrop-blur-xl border border-neutral-800 rounded-2xl p-4 flex items-center gap-4">
              {systemMessage.type === "loading" ? <Loader2 className="animate-spin text-emerald-400 shrink-0" size={24} /> :
               systemMessage.type === "error" ? <AlertCircle className="text-red-400 shrink-0" size={24} /> :
               systemMessage.type === "success" ? <CheckCircle2 className="text-emerald-400 shrink-0" size={24} /> :
               <ScanFace className="text-blue-400 shrink-0" size={24} />}
              <p className="font-bold text-sm leading-tight text-white">{systemMessage.text}</p>
            </div>
          </div>
        </div>

        <button 
          onClick={terminalActive ? stopTerminal : startTerminal} 
          disabled={loading}
          className={`mt-6 w-full max-w-lg py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 ${terminalActive ? "bg-red-500 hover:bg-red-600 shadow-red-500/20 text-white" : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 text-white"}`}
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : terminalActive ? <Pause size={20} /> : <Power size={20} />}
          {terminalActive ? "Stop Biometric Terminal" : "Initialize Terminal"}
        </button>
      </div>

      {/* --- RIGHT / BOTTOM PORTION: LIVE STATS & FEED --- */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col p-4 md:p-8 bg-[#0a0a0a] md:max-h-screen md:overflow-y-auto custom-scrollbar">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">Live Environment</p>
            <h1 className="text-2xl font-black">{session.branch_name}</h1>
          </div>
          <button onClick={() => fetchRecentFromDb(session?.branch_id, false)} disabled={syncingFeed} className="p-3 bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 rounded-xl text-neutral-400 hover:text-emerald-400 transition-all">
            <RefreshCw size={18} className={syncingFeed ? "animate-spin text-emerald-500" : ""} />
          </button>
        </div>

        {/* Environment Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <Activity size={16} className="text-emerald-500 mb-2" />
            <p className="text-2xl font-black tabular-nums">{presentCount}</p>
            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Present</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <Users size={16} className="text-blue-500 mb-2" />
            <p className="text-2xl font-black tabular-nums">{totalStaff}</p>
            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Total Staff</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <ShieldCheck size={16} className="text-purple-500 mb-2" />
            <p className="text-2xl font-black tabular-nums">{rosterCount}</p>
            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Faces</p>
          </div>
        </div>

        {/* Active Session Status Cards */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <UserCheck size={14} /> Active Sessions
          </h2>
          
          {(() => {
            const activePeople = allPeopleRef.current.filter(p => p.status === 'working' || p.status === 'on_break');
            if (activePeople.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center bg-neutral-900/50 border border-neutral-800 border-dashed rounded-3xl p-6 text-center mb-8">
                  <UserX size={28} className="text-neutral-600 mb-3" />
                  <p className="text-sm font-bold text-neutral-400">No active sessions.</p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 gap-3 mb-8">
                {activePeople.map(p => {
                  const breakMins = calculateBreakMinutes(p.punches);
                  return (
                    <div key={p.id} className={`bg-neutral-900 border rounded-2xl p-4 transition-colors ${p.status === 'working' ? 'border-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : 'border-neutral-800'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-black text-sm text-white">{p.name}</p>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{p.role}</p>
                        </div>
                        {p.status === 'working' 
                          ? <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">Working</span>
                          : <span className="text-[9px] font-black text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-md">On Break</span>}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400 font-bold">Total Duty</span>
                        <span className="font-mono font-black">{formatDuration(p.total_working_minutes)}</span>
                      </div>
                      {breakMins > 0 && (
                        <div className="flex items-center justify-between text-xs mt-1.5 pt-1.5 border-t border-neutral-800">
                          <span className="text-yellow-600 font-bold">Break Time</span>
                          <span className="font-mono font-black text-yellow-500">{formatDuration(breakMins)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock3 size={14} /> Punch History
          </h2>
          
          {recentPunches.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-neutral-900/50 border border-neutral-800 border-dashed rounded-3xl p-8 text-center">
              <Clock3 size={28} className="text-neutral-600 mb-3" />
              <p className="text-sm font-bold text-neutral-400">No punches recorded today.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-8">
              {recentPunches.map((item) => (
                <div key={item.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`flex items-center justify-center w-10 h-10 rounded-xl font-black text-xs shrink-0 ${
                      item.type === "IN" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}>
                      {item.type}
                    </span>
                    <div className="truncate">
                      <p className="font-black text-sm text-white truncate">{item.name}</p>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest truncate">{item.role}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-mono font-black text-sm text-white">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}