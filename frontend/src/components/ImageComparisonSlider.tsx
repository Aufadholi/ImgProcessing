// src/components/ImageComparisonSlider.tsx
// Drag-to-reveal before/after image comparison slider.
// Left side  = original (before)   │  Right side = processed WebP (after)

import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  beforeUrl: string; // original image
  afterUrl: string;  // processed WebP
}

export default function ImageComparisonSlider({ beforeUrl, afterUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50); // 0–100 %
  const [dragging, setDragging] = useState(false);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, raw)));
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => { if (dragging) updatePosition(e.clientX); },
    [dragging, updatePosition]
  );
  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (dragging) updatePosition(e.touches[0].clientX);
    },
    [dragging, updatePosition]
  );
  const stopDrag = useCallback(() => setDragging(false), []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", stopDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stopDrag);
    };
  }, [onMouseMove, onTouchMove, stopDrag]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl select-none"
      style={{
        aspectRatio: "16/9",
        cursor: dragging ? "col-resize" : "default",
        border: "1px solid rgba(168,85,247,0.25)",
        boxShadow: "0 4px 30px rgba(0,0,0,0.60)",
        background: "#0a0614",
      }}
    >
      {/* ── AFTER image (right / full width, clipped on left) ── */}
      <img
        src={afterUrl}
        alt="After processing"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ pointerEvents: "none" }}
      />

      {/* ── BEFORE image (left, clipped to slider position) ── */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeUrl}
          alt="Before processing"
          draggable={false}
          className="w-full h-full object-contain"
          style={{
            minWidth: containerRef.current?.offsetWidth ?? 400,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ── Labels ── */}
      <div
        className="absolute top-3 left-3 text-xs font-semibold uppercase tracking-widest px-2 py-1 rounded-lg"
        style={{
          background: "rgba(234,179,8,0.18)",
          border: "1px solid rgba(234,179,8,0.35)",
          color: "#fde047",
          opacity: position > 15 ? 1 : 0,
          transition: "opacity 0.2s",
        }}
      >
        Before
      </div>
      <div
        className="absolute top-3 right-3 text-xs font-semibold uppercase tracking-widest px-2 py-1 rounded-lg"
        style={{
          background: "rgba(168,85,247,0.18)",
          border: "1px solid rgba(168,85,247,0.35)",
          color: "#d8b4fe",
          opacity: position < 85 ? 1 : 0,
          transition: "opacity 0.2s",
        }}
      >
        After · WebP
      </div>

      {/* ── Divider line ── */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: `${position}%`,
          width: "2px",
          transform: "translateX(-50%)",
          background: "linear-gradient(to bottom, #fbbf24, #a855f7)",
          boxShadow: "0 0 10px rgba(168,85,247,0.60), 0 0 4px rgba(234,179,8,0.60)",
          pointerEvents: "none",
        }}
      />

      {/* ── Drag handle ── */}
      <div
        className="absolute top-1/2 flex items-center justify-center rounded-full"
        style={{
          left: `${position}%`,
          transform: "translate(-50%, -50%)",
          width: 40,
          height: 40,
          background: "linear-gradient(135deg, #eab308, #a855f7)",
          boxShadow: "0 0 16px rgba(168,85,247,0.55), 0 0 6px rgba(234,179,8,0.55)",
          cursor: "col-resize",
          zIndex: 10,
          userSelect: "none",
        }}
        onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
        onTouchStart={(e) => { e.preventDefault(); setDragging(true); }}
      >
        {/* ◀ ▶ arrows */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M6 9L3 6M6 9L3 12M6 9H2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 9L15 6M12 9L15 12M12 9H16" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
