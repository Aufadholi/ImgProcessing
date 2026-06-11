import { useState, useRef, useCallback, useEffect } from "react";
import { uploadImage, getDownloadUrl, getOriginalUrl } from "./api";
import type { JobResponse } from "./api";
import { useJobPolling } from "./hooks/useJobPolling";
import BackgroundCircles from "./components/BackgroundCircles";
import ImageComparisonSlider from "./components/ImageComparisonSlider";

type AppState = "idle" | "uploading" | "polling" | "done";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// ── Starfield dots drawn via inline SVG data-URIs ──
const STAR_COUNTS = [120, 60, 30];

function generateStars(count: number) {
  return Array.from({ length: count }, () => ({
    cx: Math.random() * 100,
    cy: Math.random() * 100,
    r: Math.random() * 0.5 + 0.2,
    opacity: Math.random() * 0.7 + 0.2,
  }));
}

const layers = STAR_COUNTS.map(generateStars);

function StarLayer({
  stars,
  duration,
}: {
  stars: { cx: number; cy: number; r: number; opacity: number }[];
  duration: string;
}) {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: `starMove ${duration} linear infinite` }}
    >
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={`${s.cx}%`}
          cy={`${s.cy}%`}
          r={s.r}
          fill="white"
          opacity={s.opacity}
        />
      ))}
    </svg>
  );
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // local object-URL for instant image preview before upload
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // snapshot of the final job data when processing completes/fails
  const [finalJob, setFinalJob] = useState<import('./api').JobResponse | null>(null);

  const { job, pollingError } = useJobPolling(
    appState === "polling" ? jobId : null
  );

  useEffect(() => {
    if (
      job &&
      (job.status === "completed" || job.status === "failed") &&
      appState === "polling"
    ) {
      setFinalJob(job);
      setAppState("done");
    }
  }, [job, appState]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type))
      return "Format tidak didukung. Gunakan JPG, PNG, atau WebP.";
    if (file.size > MAX_SIZE_BYTES)
      return `Ukuran file terlalu besar. Maksimal ${MAX_SIZE_MB}MB.`;
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
    // revoke previous object-URL to avoid memory leaks
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setAppState("uploading");
    setUploadError(null);
    try {
      const result = await uploadImage(selectedFile);
      setJobId(result.jobId);
      setAppState("polling");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload gagal");
      setAppState("idle");
    }
  }, [selectedFile]);

  const handleReset = () => {
    setAppState("idle");
    setJobId(null);
    setUploadError(null);
    setSelectedFile(null);
    setFinalJob(null);
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const currentStatus: JobResponse["status"] | null = job?.status ?? null;

  const statusConfig: Record<
    JobResponse["status"],
    { label: string; badgeClass: string; dot: string }
  > = {
    pending: { label: "Menunggu", badgeClass: "badge badge-yellow", dot: "#fde047" },
    processing: { label: "Memproses", badgeClass: "badge badge-blue", dot: "#93c5fd" },
    completed: { label: "Selesai", badgeClass: "badge badge-green", dot: "#6ee7b7" },
    failed: { label: "Gagal", badgeClass: "badge badge-red", dot: "#fca5a5" },
  };

  const dropZoneClass = [
    "drop-zone rounded-2xl p-10 text-center cursor-pointer",
    isDragging ? "dragging" : selectedFile ? "has-file" : "",
  ]
    .join(" ")
    .trim();

  return (
    <>
      {/* ── CSS animation for stars ── */}
      <style>{`
        @keyframes starMove {
          from { transform: translateY(0); }
          to   { transform: translateY(-30px); }
        }
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        .float-card {
          animation: floatCard 6s ease-in-out infinite;
        }
        @keyframes nebulaPulse {
          0%, 100% { opacity: 0.25; transform: scale(1);   }
          50%       { opacity: 0.40; transform: scale(1.08); }
        }
        .nebula {
          animation: nebulaPulse 8s ease-in-out infinite;
        }
        @keyframes glowText {
          0%, 100% { text-shadow: 0 0 8px rgba(234,179,8,0.5); }
          50%       { text-shadow: 0 0 22px rgba(234,179,8,0.95), 0 0 44px rgba(168,85,247,0.45); }
        }
        .glow-text {
          animation: glowText 3s ease-in-out infinite;
        }
      `}</style>

      {/* ── Deep space background ── */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 25% 55%, #1a0a2e 0%, #0d0a14 45%, #080408 100%)",
        }}
      />

      {/* Nebula blobs — purple · red · yellow */}
      <div
        className="nebula fixed pointer-events-none z-0"
        style={{
          width: 600,
          height: 600,
          top: "-10%",
          left: "-10%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="nebula fixed pointer-events-none z-0"
        style={{
          width: 500,
          height: 500,
          bottom: "-10%",
          right: "-5%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(239,68,68,0.16) 0%, transparent 70%)",
          filter: "blur(50px)",
          animationDelay: "4s",
        }}
      />
      <div
        className="nebula fixed pointer-events-none z-0"
        style={{
          width: 380,
          height: 380,
          top: "30%",
          right: "12%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(234,179,8,0.12) 0%, transparent 70%)",
          filter: "blur(45px)",
          animationDelay: "2s",
        }}
      />

      {/* Starfield SVG layers */}
      <StarLayer stars={layers[0]} duration="200s" />
      <StarLayer stars={layers[1]} duration="120s" />
      <StarLayer stars={layers[2]} duration="70s" />

      {/* ── Page layout ── */}
      <div className="relative z-10 h-screen flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">

        {/* ── Site header ── */}
        <div className="mb-6 text-center">
          <p
            className="text-xs uppercase tracking-[6px] font-light mb-2"
            style={{ color: "rgba(192,132,252,0.75)" }}
          >
            ✦ &nbsp;Image Processing&nbsp; ✦
          </p>
          <h1
            className="glow-text text-3xl sm:text-4xl font-bold"
            style={{
              background:
                "linear-gradient(135deg, #fde047 0%, #fbbf24 30%, #e879f9 70%, #c084fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.01em",
            }}
          >
            CFactory
          </h1>
          <p className="text-sm mt-1 font-light" style={{ color: "rgba(216,180,254,0.65)" }}>
            Convert &amp; optimize your images at warp speed
          </p>
        </div>

        {/* ── Main card wrapper (BackgroundCircles + Card) ── */}
        <div className="relative flex items-center justify-center w-full max-w-4xl">

          {/* Animated concentric circles behind the card */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 0 }}
          >
            <BackgroundCircles />
          </div>

          {/* Glass card */}
          <div
            className="glass-card float-card relative z-10 w-full rounded-3xl p-8 sm:p-10"
          >
            {/* Card header */}
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: "linear-gradient(135deg,#eab308,#a855f7)",
                    boxShadow: "0 0 8px rgba(168,85,247,0.75)",
                  }}
                />
                <h2 className="text-base font-semibold tracking-wide" style={{ color: "#f0e8ff" }}>
                  Image Processor
                </h2>
              </div>
              <p className="text-xs text-slate-500 pl-4 leading-relaxed">
                Upload JPG, PNG, atau WebP — otomatis dikonversi ke WebP 1280px.
              </p>
            </div>

            {/* ── STATE: IDLE / UPLOADING ── */}
            {(appState === "idle" || appState === "uploading") && (
              <div className="space-y-4">

                {/* Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={dropZoneClass}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />

                  {selectedFile ? (
                    <div className="w-full">
                      {/* ── Actual image preview ── */}
                      <div
                        className="relative w-full overflow-hidden rounded-xl mb-3"
                        style={{ maxHeight: 280 }}
                      >
                        <img
                          src={previewUrl ?? ""}
                          alt="Preview"
                          className="w-full h-full object-contain"
                          style={{ maxHeight: 280, background: "rgba(0,0,0,0.3)" }}
                        />
                        {/* small overlay badge */}
                        <div
                          className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-lg"
                          style={{
                            background: "rgba(234,179,8,0.20)",
                            border: "1px solid rgba(234,179,8,0.40)",
                            color: "#fde047",
                          }}
                        >
                          Preview
                        </div>
                      </div>
                      <p className="text-sm font-medium text-center truncate" style={{ color: "#fde047" }}>
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-center mt-0.5" style={{ color: "rgba(234,179,8,0.60)" }}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* Upload cloud icon */}
                      <div className="flex justify-center mb-3">
                        <svg
                          className="w-10 h-10"
                          style={{ color: "rgba(168,85,247,0.65)" }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <p className="text-sm" style={{ color: "rgba(216,180,254,0.70)" }}>
                        Drag &amp; drop gambar ke sini, atau{" "}
                        <span className="font-medium" style={{ color: "#fbbf24" }}>
                          klik untuk pilih
                        </span>
                      </p>
                      <p className="text-xs mt-1" style={{ color: "rgba(168,85,247,0.40)" }}>
                        JPG · PNG · WebP &mdash; maks. 20 MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Validation / upload error */}
                {uploadError && (
                  <div className="rounded-xl bg-red-900/20 border border-red-500/20 px-4 py-3">
                    <p className="text-sm text-red-400">{uploadError}</p>
                  </div>
                )}

                {/* Upload button */}
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || appState === "uploading"}
                  className="btn-primary w-full py-3 rounded-2xl text-sm font-bold tracking-wide"
                >
                  {appState === "uploading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        />
                      </svg>
                      Mengunggah...
                    </span>
                  ) : (
                    "Upload & Proses"
                  )}
                </button>
              </div>
            )}

            {/* ── STATE: POLLING ── */}
            {appState === "polling" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 space-y-3">
                  {/* Status */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                      Status
                    </p>
                    <div className="flex items-center gap-3">
                      {currentStatus && (
                        <span className={statusConfig[currentStatus].badgeClass}>
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              background: statusConfig[currentStatus].dot,
                              boxShadow: `0 0 6px ${statusConfig[currentStatus].dot}`,
                            }}
                          />
                          {statusConfig[currentStatus].label}
                        </span>
                      )}
                      <svg
                        className="animate-spin h-3.5 w-3.5"
                        style={{ color: "#a855f7" }}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {pollingError && (
                  <div className="rounded-xl bg-red-900/20 border border-red-500/20 px-4 py-3">
                    <p className="text-sm text-red-400">
                      Gagal mengecek status: {pollingError}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── STATE: DONE ── */}
            {appState === "done" && finalJob && (
              <div className="space-y-4">

                {/* Status badge */}
                <div className="flex items-center gap-2">
                  <span className={statusConfig[finalJob.status].badgeClass}>
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: statusConfig[finalJob.status].dot,
                        boxShadow: `0 0 6px ${statusConfig[finalJob.status].dot}`,
                      }}
                    />
                    {statusConfig[finalJob.status].label}
                  </span>
                </div>

                {/* Comparison slider — only when completed */}
                {finalJob.status === "completed" && jobId && (
                  <>
                    <p
                      className="text-[11px] uppercase tracking-widest text-center"
                      style={{ color: "rgba(168,85,247,0.65)" }}
                    >
                      Geser untuk komparasi
                    </p>
                    <ImageComparisonSlider
                      beforeUrl={getOriginalUrl(jobId)}
                      afterUrl={getDownloadUrl(jobId)}
                    />
                  </>
                )}

                {/* File size comparison */}
                {finalJob.status === "completed" && finalJob.originalSize != null && finalJob.processedSize != null && (
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3 flex justify-between text-xs">
                    <div className="text-center">
                      <p className="text-slate-500 uppercase tracking-widest mb-1">Original</p>
                      <p className="font-semibold" style={{ color: "#fde047" }}>
                        {(finalJob.originalSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="flex items-center" style={{ color: "rgba(168,85,247,0.5)" }}>→</div>
                    <div className="text-center">
                      <p className="text-slate-500 uppercase tracking-widest mb-1">WebP</p>
                      <p className="font-semibold" style={{ color: "#86efac" }}>
                        {(finalJob.processedSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-lg"
                        style={{
                          background: "rgba(134,239,172,0.12)",
                          border: "1px solid rgba(134,239,172,0.25)",
                          color: "#86efac",
                        }}
                      >
                        -{Math.round((1 - finalJob.processedSize / finalJob.originalSize) * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Download button */}
                {finalJob.status === "completed" && jobId && (
                  <button
                    onClick={() => window.open(getDownloadUrl(jobId), "_blank")}
                    className="btn-download flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold text-white tracking-wide"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download Hasil
                  </button>
                )}

                {/* Failed */}
                {finalJob.status === "failed" && (
                  <div className="rounded-xl bg-red-900/20 border border-red-500/20 px-4 py-3">
                    <p className="text-sm font-medium text-red-400">
                      Pemrosesan gagal
                    </p>
                    {finalJob.errorMessage && (
                      <p className="text-xs text-red-500/70 mt-1">
                        {finalJob.errorMessage}
                      </p>
                    )}
                  </div>
                )}

                {/* Upload another */}
                <button
                  onClick={handleReset}
                  className="btn-secondary w-full py-3 rounded-2xl text-sm font-medium tracking-wide"
                >
                  Upload Gambar Lain
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-slate-700 tracking-widest uppercase">
          ✦ &nbsp;CFactory &nbsp;✦
        </p>
      </div>
    </>
  );
}