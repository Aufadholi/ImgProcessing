import { useState, useRef, useCallback, useEffect } from "react";
import { uploadImage, getDownloadUrl } from "./api";
import type { JobResponse } from "./api";
import { useJobPolling } from "./hooks/useJobPolling";

type AppState = "idle" | "uploading" | "polling" | "done";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { job, pollingError } = useJobPolling(
    appState === "polling" || appState === "done" ? jobId : null
  );

  // Kalau polling sudah dapat status final, pindah ke state "done"
  useEffect(() => {
    if (job && (job.status === "completed" || job.status === "failed") && appState === "polling") {
      setAppState("done");
    }
  }, [job, appState]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Format tidak didukung. Gunakan JPG, PNG, atau WebP.";
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `Ukuran file terlalu besar. Maksimal ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      setSelectedFile(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
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

  // Tentukan status label dan warna badge
  const currentStatus: JobResponse["status"] | null = job?.status ?? null;

  const statusConfig: Record<JobResponse["status"], { label: string; color: string }> = {
    pending: { label: "Menunggu", color: "bg-yellow-100 text-yellow-800" },
    processing: { label: "Memproses", color: "bg-blue-100 text-blue-800" },
    completed: { label: "Selesai", color: "bg-green-100 text-green-800" },
    failed: { label: "Gagal", color: "bg-red-100 text-red-800" },
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Image Processor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload gambar JPG, PNG, atau WebP — dikonversi ke WebP 1280px secara otomatis.
          </p>
        </div>

        {/* STATE: IDLE atau UPLOADING */}
        {(appState === "idle" || appState === "uploading") && (
          <div className="space-y-4">

            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                ${isDragging
                  ? "border-blue-400 bg-blue-50"
                  : selectedFile
                    ? "border-green-400 bg-green-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }
              `}
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
                <div>
                  <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">
                    Drag & drop gambar ke sini, atau{" "}
                    <span className="text-blue-500 font-medium">klik untuk pilih</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — maks. 20MB</p>
                </div>
              )}
            </div>

            {/* Error upload/validasi */}
            {uploadError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}

            {/* Tombol Upload */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || appState === "uploading"}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors
                bg-blue-500 text-white hover:bg-blue-600
                disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {appState === "uploading" ? "Mengunggah..." : "Upload & Proses"}
            </button>
          </div>
        )}

        {/* STATE: POLLING */}
        {appState === "polling" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">

              {/* Job ID */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Job ID</p>
                <p className="text-sm font-mono text-gray-700 mt-0.5 break-all">{jobId}</p>
              </div>

              {/* Status */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
                <div className="mt-1 flex items-center gap-2">
                  {currentStatus && (
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[currentStatus].color}`}>
                      {statusConfig[currentStatus].label}
                    </span>
                  )}
                  {/* Spinner */}
                  <svg className="animate-spin h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Error polling */}
            {pollingError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">Gagal mengecek status: {pollingError}</p>
              </div>
            )}
          </div>
        )}

        {/* STATE: DONE */}
        {appState === "done" && job && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">

              {/* Job ID */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Job ID</p>
                <p className="text-sm font-mono text-gray-700 mt-0.5 break-all">{jobId}</p>
              </div>

              {/* Status */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[job.status].color}`}>
                  {statusConfig[job.status].label}
                </span>
              </div>
            </div>

            {/* Completed — tombol download */}
            {job.status === "completed" && jobId && (

              // SESUDAH
              <button
                onClick={() => window.open(getDownloadUrl(jobId), "_blank")}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
              >
                Download Hasil
              </button>
            )}

            {/* Failed — pesan error */}
            {job.status === "failed" && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm font-medium text-red-700">Pemrosesan gagal</p>
                {job.errorMessage && (
                  <p className="text-xs text-red-600 mt-1">{job.errorMessage}</p>
                )}
              </div>
            )}

            {/* Tombol upload lagi */}
            <button
              onClick={handleReset}
              className="w-full py-2.5 rounded-xl text-sm font-medium
                bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Upload Gambar Lain
            </button>
          </div>
        )}
      </div>
    </div>
  );
}