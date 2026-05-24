"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as faceapi from "face-api.js";
import { callApi } from "@/lib/apiClient";
import { canRead } from "@/lib/permissions";
import {
  ScanFace, Loader2, AlertCircle, CheckCircle2, Power, Pause,
  Camera, Users, ShieldCheck, RefreshCw, Activity, Clock3, UserCheck, UserX
} from "lucide-react";

// --- Configuration ---
const MATCH_THRESHOLD = 0.45;
const DB_COOLDOWN_MS = 60000; 
const SCAN_INTERVAL_MS = 1200;

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

function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}h ${m}m`;
}

export default function BiometricTerminal() {
  const router = useRouter();
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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const faceMatcherRef = useRef(null);
  const processingRef = useRef(false);
  
  const allPeopleRef = useRef([]);
  const tempLockRef = useRef(new Map());

  useEffect(() => {
    const rawSession = localStorage.getItem("caketown_session");
    if (!rawSession) {
      router.push("/");
      return;
    }
    
    const parsed = JSON.parse(rawSession);
    
    // ─── GATEKEEPER: TERMINAL ACCESS ───
    if (!canRead(parsed.feature_permissions, 'manage_terminal')) {
      router.push("/manager/dashboard");
      return;
    }
    
    setSession(parsed);
    fetchRecentFromDb(parsed.branch_id);
    
    const interval = setInterval(() => fetchRecentFromDb(parsed.branch_id, true), 10000);
    return () => {
      clearInterval(interval);
      stopTerminal();
    };
  }, [router]);

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
                role: person.department || "Staff",
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

      // OPTIMIZATION: Reduced ideal resolution to 480p to save massive compute power on mobile devices.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } },
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

  // OPTIMIZATION: Modified coordinates to perfectly track the mathematically flipped video feed
  const drawPremiumBox = (ctx, box, label, color, canvasWidth) => {
    const { y, width, height } = box;
    
    // Mathematically flip the X coordinate so the UI box matches the CSS-mirrored video
    const x = canvasWidth - box.x - width;
    
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

  const handleVideoOnPlay = () => {
    if (!isModelsLoaded || !faceMatcherRef.current || !videoRef.current || !canvasRef.current) return;
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const video = videoRef.current;
    const canvas = canvasRef.current;

    scanIntervalRef.current = setInterval(async () => {
      if (processingRef.current || video.readyState < 2) return;
      processingRef.current = true;

      const displaySize = { 
        width: video.videoWidth || video.clientWidth || 480, 
        height: video.videoHeight || video.clientHeight || 640 
      };
      
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
      faceapi.matchDimensions(canvas, displaySize);

      try {
        // OPTIMIZATION: Dropped inputSize from 320 to 160. This is a 4x reduction in pixel processing load.
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }))
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
          drawPremiumBox(ctx, resized.detection.box, "UNKNOWN", "#ef4444", canvas.width); 
          setSystemMessage({ text: "Face not recognized.", type: "error" });
          processingRef.current = false;
          return;
        }

        const matchedUserId = String(bestMatch.label);
        const now = Date.now();
        
        const localLock = tempLockRef.current.get(matchedUserId);
        if (localLock && now - localLock < 5000) {
          processingRef.current = false;
          return; 
        }

        const dbPerson = allPeopleRef.current.find(p => String(p.id) === matchedUserId);
        if (dbPerson && dbPerson.last_punch) {
          const lastDbTime = new Date(dbPerson.last_punch).getTime();
          if (now - lastDbTime < DB_COOLDOWN_MS) {
            const remain = Math.ceil((DB_COOLDOWN_MS - (now - lastDbTime)) / 1000);
            drawPremiumBox(ctx, resized.detection.box, `WAIT ${remain}s`, "#f59e0b", canvas.width);
            setSystemMessage({ text: `${dbPerson.name}, please wait ${remain}s.`, type: "idle" });
            processingRef.current = false;
            return;
          }
        }

        tempLockRef.current.set(matchedUserId, now);
        setSystemMessage({ text: "Verifying...", type: "loading" });

        let res;
        try {
          res = await callApi("log_punch", { user_id: matchedUserId, branch_id: session.branch_id });
        } catch (apiErr) {
          setSystemMessage({ text: "Network error saving punch.", type: "error" });
          tempLockRef.current.delete(matchedUserId);
          processingRef.current = false;
          return;
        }

        if (res?.status === "success") {
          const punchType = String(res.punch_type).toUpperCase().includes("OUT") ? "OUT" : "IN";
          const color = punchType === "IN" ? "#10b981" : "#f59e0b"; 
          
          drawPremiumBox(ctx, resized.detection.box, `PUNCH ${punchType}`, color, canvas.width);
          setSystemMessage({ text: `Success: ${res.user_name} punched ${punchType}`, type: "success" });
          
          await fetchRecentFromDb(session.branch_id, true);
        } else {
          tempLockRef.current.delete(matchedUserId); 
          setSystemMessage({ text: res?.message || "Punch failed.", type: "error" });
        }
      } catch (err) {
        setSystemMessage({ text: "Camera processing error.", type: "error" });
      } finally {
        processingRef.current = false;
      }
    }, SCAN_INTERVAL_MS);
  };

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

  if (!session) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#050505]"><Loader2 className="animate-spin text-emerald-500" size={34} /></div>;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-transparent text-gray-900 dark:text-white font-sans flex flex-col md:flex-row selection:bg-emerald-500 selection:text-white relative z-0 animate-in fade-in duration-500 rounded-3xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-sm">
      
      {/* --- LEFT / TOP PORTION: THE CAMERA HERO --- */}
      <div className="w-full md:w-1/2 lg:w-3/5 relative flex flex-col items-center justify-center p-4 md:p-8 border-b md:border-b-0 md:border-r border-gray-200 dark:border-neutral-900 bg-white dark:bg-[#0a0a0a] z-0">
        <div className="w-full max-w-lg aspect-[3/4] md:aspect-auto md:h-[75vh] bg-gray-100 dark:bg-[#111] rounded-[2rem] border border-gray-200 dark:border-neutral-800 overflow-hidden relative shadow-2xl shadow-emerald-500/5">
          
          {/* OPTIMIZATION: Added -scale-x-100 to the video to instantly flip it so it acts like a mirror */}
          <video ref={videoRef} autoPlay muted playsInline onPlay={handleVideoOnPlay} className="absolute inset-0 w-full h-full object-cover md:object-contain bg-gray-900 dark:bg-black z-10 -scale-x-100" />
          
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover md:object-contain z-20" />

          {!terminalActive && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-white/80 dark:bg-black/80 ">
              <div className="w-20 h-20 bg-gray-50 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-4 border border-gray-200 dark:border-neutral-800">
                <ScanFace size={36} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black mb-2 text-gray-900 dark:text-white">Terminal Offline</h2>
              <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-xs">Activate the terminal to initialize biometric models and open the camera.</p>
            </div>
          )}

          <div className="absolute top-4 left-4 right-4 flex justify-between z-30">
            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${terminalActive ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' : 'bg-white/80 dark:bg-neutral-900/80 text-gray-500 dark:text-neutral-400 border-gray-200 dark:border-neutral-800'}`}>
              {terminalActive ? "Live Monitoring" : "Standby"}
            </span>
            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest backdrop-blur-md border ${cameraReady ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30' : 'bg-white/80 dark:bg-neutral-900/80 text-gray-500 dark:text-neutral-400 border-gray-200 dark:border-neutral-800'}`}>
              {cameraReady ? "Camera Ready" : "Camera Off"}
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-30">
            <div className="bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              {systemMessage.type === "loading" ? <Loader2 className="animate-spin text-emerald-500 dark:text-emerald-400 shrink-0" size={24} /> :
               systemMessage.type === "error" ? <AlertCircle className="text-red-500 dark:text-red-400 shrink-0" size={24} /> :
               systemMessage.type === "success" ? <CheckCircle2 className="text-emerald-500 dark:text-emerald-400 shrink-0" size={24} /> :
               <ScanFace className="text-blue-500 dark:text-blue-400 shrink-0" size={24} />}
              <p className="font-bold text-sm leading-tight text-gray-900 dark:text-white">{systemMessage.text}</p>
            </div>
          </div>
        </div>

        <button 
          onClick={terminalActive ? stopTerminal : startTerminal} 
          disabled={loading}
          className={`mt-6 w-full max-w-lg py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50 ${terminalActive ? "bg-red-500 hover:bg-red-600 shadow-red-500/20 text-white border-red-400" : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 text-white border-emerald-400"}`}
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : terminalActive ? <Pause size={20} /> : <Power size={20} />}
          {terminalActive ? "Stop Biometric Terminal" : "Initialize Terminal"}
        </button>
      </div>

      {/* --- RIGHT / BOTTOM PORTION: LIVE STATS & FEED --- */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col p-4 md:p-8 bg-gray-50/50 dark:bg-[#050505] md:max-h-[calc(100vh-80px)] md:overflow-y-auto custom-scrollbar z-0">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-black uppercase tracking-widest mb-1">Live Environment</p>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{session.branch_name}</h1>
          </div>
          <button onClick={() => fetchRecentFromDb(session.branch_id, false)} disabled={syncingFeed} className="p-3 bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 hover:border-emerald-500/50 rounded-xl text-gray-500 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-sm">
            <RefreshCw size={18} className={syncingFeed ? "animate-spin text-emerald-500" : ""} />
          </button>
        </div>

        {/* Environment Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
            <Activity size={16} className="text-emerald-500 mb-2" />
            <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{presentCount}</p>
            <p className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mt-1">Present</p>
          </div>
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
            <Users size={16} className="text-blue-500 mb-2" />
            <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{totalStaff}</p>
            <p className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mt-1">Total Staff</p>
          </div>
          <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
            <ShieldCheck size={16} className="text-purple-500 mb-2" />
            <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{rosterCount}</p>
            <p className="text-[9px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mt-1">Faces</p>
          </div>
        </div>

        {/* Active Session Status Cards */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-xs font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <UserCheck size={14} /> Active Sessions
          </h2>
          
          {(() => {
            const activePeople = allPeopleRef.current.filter(p => p.status === 'working' || p.status === 'on_break');
            if (activePeople.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-3xl p-6 text-center mb-8 shadow-sm">
                  <UserX size={28} className="text-gray-300 dark:text-neutral-700 mb-3" />
                  <p className="text-sm font-bold text-gray-500 dark:text-neutral-400">No active sessions.</p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 gap-3 mb-8">
                {activePeople.map(p => {
                  const breakMins = calculateBreakMinutes(p.punches);
                  return (
                    <div key={p.id} className={`bg-white dark:bg-[#111] border rounded-2xl p-4 shadow-sm transition-colors ${p.status === 'working' ? 'border-emerald-200 dark:border-emerald-900/50 shadow-emerald-500/5' : 'border-gray-200 dark:border-neutral-800'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-black text-sm text-gray-900 dark:text-white">{p.name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest">{p.role}</p>
                        </div>
                        {p.status === 'working' 
                          ? <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">Working</span>
                          : <span className="text-[9px] font-black text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 px-2 py-1 rounded-md">On Break</span>}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-neutral-400 font-bold">Total Duty</span>
                        <span className="font-mono font-black text-gray-900 dark:text-white">{formatDuration(p.total_working_minutes)}</span>
                      </div>
                      {breakMins > 0 && (
                        <div className="flex items-center justify-between text-xs mt-1.5 pt-1.5 border-t border-gray-100 dark:border-neutral-800">
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

          <h2 className="text-xs font-black text-gray-500 dark:text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock3 size={14} /> Punch History
          </h2>
          
          {recentPunches.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-3xl p-8 text-center shadow-sm">
              <Clock3 size={28} className="text-gray-300 dark:text-neutral-700 mb-3" />
              <p className="text-sm font-bold text-gray-500 dark:text-neutral-400">No punches recorded today.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-8">
              {recentPunches.map((item) => (
                <div key={item.id} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`flex items-center justify-center w-10 h-10 rounded-xl font-black text-xs shrink-0 ${
                      item.type === "IN" ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/30" : "bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/30"
                    }`}>
                      {item.type}
                    </span>
                    <div className="truncate">
                      <p className="font-black text-sm text-gray-900 dark:text-white truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest truncate">{item.role}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-mono font-black text-sm text-gray-900 dark:text-white">{item.time}</p>
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