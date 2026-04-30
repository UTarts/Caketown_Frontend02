"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { callApi } from "@/lib/apiClient";
import {
  ScanFace,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Power,
  Pause,
  Camera,
  Users,
  ShieldCheck,
  RefreshCw,
  Activity,
  Clock3,
} from "lucide-react";

const MATCH_THRESHOLD = 0.45;
const COOLDOWN_MS = 60000;
const SCAN_INTERVAL_MS = 1200;

function parseDescriptor(input) {
  try {
    if (!input) return null;

    if (input instanceof Float32Array) {
      return input.length === 128 ? input : null;
    }

    if (Array.isArray(input)) {
      const arr = input.map(Number).filter(Number.isFinite);
      return arr.length === 128 ? new Float32Array(arr) : null;
    }

    if (typeof input === "string") {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        const arr = parsed.map(Number).filter(Number.isFinite);
        return arr.length === 128 ? new Float32Array(arr) : null;
      }
      if (parsed && typeof parsed === "object") {
        const arr = Object.values(parsed).map(Number).filter(Number.isFinite);
        return arr.length === 128 ? new Float32Array(arr) : null;
      }
      return null;
    }

    if (typeof input === "object") {
      const arr = Object.values(input).map(Number).filter(Number.isFinite);
      return arr.length === 128 ? new Float32Array(arr) : null;
    }

    return null;
  } catch {
    return null;
  }
}

function getSession() {
  try {
    const raw = localStorage.getItem("caketown_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

function formatDateLabel(value) {
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function getPunchTypeByIndex(index) {
  return index % 2 === 0 ? "IN" : "OUT";
}

export default function BiometricTerminal() {
  const [session, setSession] = useState(null);
  const [terminalActive, setTerminalActive] = useState(false);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [systemMessage, setSystemMessage] = useState(
    "Terminal offline. Tap Start to begin."
  );
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
  const cooldownMapRef = useRef(new Map());
  const processingRef = useRef(false);

  const stopTerminal = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    processingRef.current = false;
    setTerminalActive(false);
    setCameraReady(false);
    setIsModelsLoaded(false);
    setSystemMessage("Terminal offline.");
  };

  const fetchRecentFromDb = async (branchId, silent = false) => {
    if (!branchId) return;

    if (!silent) setSyncingFeed(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await callApi("get_live_attendance", {
        branch_id: branchId,
        date: today,
      });

      if (res?.status === "success") {
        const people = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.all_people)
          ? res.all_people
          : [];

        setPresentCount(Number(res.present_count || 0));
        setTotalStaff(Number(res.total_staff || people.length || 0));

        const flat = [];

        people.forEach((person) => {
          if (Array.isArray(person.punches)) {
            person.punches.forEach((time, index) => {
              const type = getPunchTypeByIndex(index);
              flat.push({
                id: `${person.id}-${time}-${index}`,
                name: person.name,
                department: person.department || person.role || "Staff",
                type,
                rawTime: time,
                time: formatTime(time),
                dateLabel: formatDateLabel(time),
              });
            });
          }
        });

        flat.sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime));
        setRecentPunches(flat.slice(0, 12));
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (!silent) setSyncingFeed(false);
    }
  };

  useEffect(() => {
    const local = getSession();
    setSession(local);

    if (local?.branch_id) {
      fetchRecentFromDb(local.branch_id);
      const interval = setInterval(() => {
        fetchRecentFromDb(local.branch_id, true);
      }, 15000);

      return () => {
        clearInterval(interval);
        stopTerminal();
      };
    }

    return () => {
      stopTerminal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTerminal = async () => {
    if (!session?.branch_id) {
      setSystemMessage("Branch session missing. Please login again.");
      return;
    }

    setLoading(true);
    setTerminalActive(true);
    setSystemMessage("Loading face models...");

    try {
      const MODEL_URL = "/models";

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      setIsModelsLoaded(true);
      setSystemMessage("Downloading branch face data...");

      const res = await callApi("get_branch_descriptors", {
        branch_id: session.branch_id,
      });

      if (
        res?.status !== "success" ||
        !Array.isArray(res.data) ||
        res.data.length === 0
      ) {
        setSystemMessage("No registered faces found in this branch.");
        setLoading(false);
        return;
      }

      const labeledDescriptors = res.data
        .map((user) => {
          const descriptor = parseDescriptor(user.face_descriptor);
          if (!descriptor) return null;
          return new faceapi.LabeledFaceDescriptors(String(user.id), [descriptor]);
        })
        .filter(Boolean);

      if (!labeledDescriptors.length) {
        setSystemMessage("Registered faces exist, but descriptor format is invalid.");
        setLoading(false);
        return;
      }

      faceMatcherRef.current = new faceapi.FaceMatcher(
        labeledDescriptors,
        MATCH_THRESHOLD
      );

      setRosterCount(labeledDescriptors.length);
      setSystemMessage("Starting camera...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
      setSystemMessage("Terminal online. Ready to scan.");
    } catch (err) {
      console.error(err);
      setSystemMessage("Camera or model error. Check camera permission and try again.");
      setTerminalActive(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleTerminal = async () => {
    if (terminalActive) stopTerminal();
    else await startTerminal();
  };

  const handleVideoOnPlay = () => {
    if (!isModelsLoaded || !faceMatcherRef.current || !videoRef.current || !canvasRef.current) {
      return;
    }

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = {
      width: video.videoWidth || 720,
      height: video.videoHeight || 960,
    };

    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    faceapi.matchDimensions(canvas, displaySize);

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !faceMatcherRef.current || processingRef.current) return;
      if (videoRef.current.readyState < 2) return;

      processingRef.current = true;

      try {
        const detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.5,
            })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detection) {
          setSystemMessage("No face detected. Hold the phone steady.");
          processingRef.current = false;
          return;
        }

        const resized = faceapi.resizeResults(detection, displaySize);

        const previewBox = new faceapi.draw.DrawBox(resized.detection.box, {
          boxColor: "#60a5fa",
          lineWidth: 2,
        });
        previewBox.draw(canvas);

        const bestMatch = faceMatcherRef.current.findBestMatch(detection.descriptor);

        if (!bestMatch || bestMatch.label === "unknown") {
          setSystemMessage("Face not recognized. Please register again.");
          processingRef.current = false;
          return;
        }

        const matchedUserId = String(bestMatch.label);
        const now = Date.now();
        const lastPunch = cooldownMapRef.current.get(matchedUserId);

        if (lastPunch && now - lastPunch < COOLDOWN_MS) {
          const remain = Math.ceil((COOLDOWN_MS - (now - lastPunch)) / 1000);
          setSystemMessage(`Please wait ${remain}s before next punch.`);
          processingRef.current = false;
          return;
        }

        cooldownMapRef.current.set(matchedUserId, now);
        setSystemMessage("Face recognized. Saving punch...");

        const res = await callApi("log_punch", {
          user_id: matchedUserId,
          branch_id: session.branch_id,
        });

        if (res?.status === "success") {
          const punchType = String(res.punch_type || "")
            .toLowerCase()
            .includes("out")
            ? "OUT"
            : "IN";

          const color = punchType === "IN" ? "#10b981" : "#f59e0b";

          const successBox = new faceapi.draw.DrawBox(resized.detection.box, {
            label: `PUNCH ${punchType}`,
            boxColor: color,
            lineWidth: 4,
          });
          successBox.draw(canvas);

          setSystemMessage(`[${punchType}] ${res.user_name}: ${res.message}`);
          await fetchRecentFromDb(session.branch_id, true);
        } else {
          cooldownMapRef.current.delete(matchedUserId);
          setSystemMessage(res?.message || "Punch failed.");
        }
      } catch (err) {
        console.error(err);
        setSystemMessage("Recognition error. Please try again.");
      } finally {
        processingRef.current = false;
      }
    }, SCAN_INTERVAL_MS);
  };

  if (!session) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#f6f7fb] dark:bg-[#0b0f14]">
        <Loader2 className="animate-spin text-emerald-500" size={34} />
      </div>
    );
  }

  const statusTone =
    systemMessage.toLowerCase().includes("failed") ||
    systemMessage.toLowerCase().includes("error")
      ? "text-red-500"
      : systemMessage.toLowerCase().includes("in") ||
        systemMessage.toLowerCase().includes("out")
      ? "text-emerald-500"
      : "text-blue-500";

  return (
    <div className="min-h-screen bg-[#f6f7fb] dark:bg-[#0b0f14] text-slate-900 dark:text-white">
      <div className="mx-auto w-full max-w-md px-3 pb-24 pt-3 sm:px-4">
        <div className="mb-3 rounded-[28px] bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#0b1220] px-4 py-4 text-white shadow-[0_20px_60px_rgba(2,6,23,0.28)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] font-extrabold text-emerald-300">
                Manager Terminal
              </p>
              <h1 className="mt-1 text-[30px] font-black leading-tight">
                Face Attendance
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Fast mobile biometric punch station for branch staff.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                Branch
              </p>
              <p className="mt-1 text-sm font-bold">
                {session?.branch_name || "Branch"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="rounded-[24px] bg-white dark:bg-[#10161d] border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Camera size={16} className="text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Camera
              </span>
            </div>
            <p className="mt-3 text-xl font-black">
              {cameraReady ? "Ready" : "Off"}
            </p>
          </div>

          <div className="rounded-[24px] bg-white dark:bg-[#10161d] border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <ShieldCheck size={16} className="text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Models
              </span>
            </div>
            <p className="mt-3 text-xl font-black">
              {isModelsLoaded ? "Loaded" : "Idle"}
            </p>
          </div>

          <div className="rounded-[24px] bg-white dark:bg-[#10161d] border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Users size={16} className="text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Faces
              </span>
            </div>
            <p className="mt-3 text-xl font-black">{rosterCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-[24px] bg-white dark:bg-[#10161d] border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Activity size={16} className="text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Present
              </span>
            </div>
            <p className="mt-3 text-2xl font-black">{presentCount}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Live punched staff
            </p>
          </div>

          <div className="rounded-[24px] bg-white dark:bg-[#10161d] border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Users size={16} className="text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Total Staff
              </span>
            </div>
            <p className="mt-3 text-2xl font-black">{totalStaff}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Active branch users
            </p>
          </div>
        </div>

        <div className="rounded-[30px] overflow-hidden bg-black border border-slate-200 dark:border-slate-800 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          <div className="relative aspect-[3/4] bg-slate-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onPlay={handleVideoOnPlay}
              className="h-full w-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full"
            />

            {!terminalActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white/90 bg-gradient-to-b from-black/40 to-black/70">
                <ScanFace size={46} className="mb-3 text-emerald-400" />
                <p className="text-xl font-black">Terminal is offline</p>
                <p className="mt-2 text-sm text-white/70">
                  Tap Start below to open camera and begin attendance scanning.
                </p>
              </div>
            )}

            <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
              <div className="rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">
                {terminalActive ? "Live Scan" : "Offline"}
              </div>
              <div className="rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">
                {cameraReady ? "Camera Ready" : "Camera Off"}
              </div>
            </div>

            <div className="absolute bottom-3 left-3 right-3 rounded-[22px] border border-white/10 bg-black/55 px-4 py-3 text-white backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                Status
              </p>
              <div className="mt-1 flex items-start gap-2">
                {loading ? (
                  <Loader2 className="mt-0.5 animate-spin text-emerald-400" size={18} />
                ) : systemMessage.toLowerCase().includes("failed") ||
                  systemMessage.toLowerCase().includes("error") ? (
                  <AlertCircle className="mt-0.5 text-red-400" size={18} />
                ) : systemMessage.toLowerCase().includes("in") ||
                  systemMessage.toLowerCase().includes("out") ? (
                  <CheckCircle2 className="mt-0.5 text-emerald-400" size={18} />
                ) : (
                  <ScanFace className="mt-0.5 text-blue-400" size={18} />
                )}
                <p className="text-sm font-semibold leading-6">{systemMessage}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-3 z-20 mt-3">
          <div className="rounded-[26px] border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#10161d]/95 p-3 shadow-[0_14px_40px_rgba(15,23,42,0.14)] backdrop-blur">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={toggleTerminal}
                disabled={loading}
                className={`min-h-[56px] rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition ${
                  terminalActive
                    ? "bg-red-500 text-white"
                    : "bg-emerald-500 text-white"
                }`}
              >
                {terminalActive ? <Pause size={18} /> : <Power size={18} />}
                {terminalActive ? "Stop Terminal" : "Start Terminal"}
              </button>

              <button
                onClick={() => fetchRecentFromDb(session?.branch_id)}
                disabled={syncingFeed}
                className="min-h-[56px] rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 active:scale-[0.99] transition"
              >
                {syncingFeed ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <RefreshCw size={18} />
                )}
                Refresh Feed
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[28px] bg-white dark:bg-[#10161d] border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-400">
                Recent Punches
              </p>
              <h2 className="mt-1 text-lg font-black">Live Activity</h2>
            </div>
            <div className={`text-sm font-bold ${statusTone}`}>
              {syncingFeed ? "Syncing..." : "Database Feed"}
            </div>
          </div>

          {recentPunches.length === 0 ? (
            <div className="mt-4 rounded-[22px] bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 px-4 py-6 text-center">
              <Clock3 size={22} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No punches found for today.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {recentPunches.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[22px] bg-slate-50 dark:bg-slate-900 px-4 py-3 border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.16em] ${
                            item.type === "IN"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                          }`}
                        >
                          {item.type}
                        </span>
                        <p className="truncate text-sm font-black">{item.name}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.department}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-black">{item.time}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {item.dateLabel}
                      </p>
                    </div>
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