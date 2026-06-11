// src/components/BackgroundCircles.tsx
// Animated pulsing concentric circles — CFactory brand: purple · yellow · red

export default function BackgroundCircles() {
  return (
    <div className="relative flex justify-center items-center pointer-events-none select-none">
      {/* Outermost ring — deep purple, very faint */}
      <div
        className="absolute rounded-full animate-ping"
        style={{
          width: "1500px",
          height: "1500px",
          border: "2px solid rgba(168,85,247,0.12)",
          animationDuration: "5s",
          animationDelay: "0s",
        }}
      />

      {/* Ring 4 — red-orange */}
      <div
        className="absolute rounded-full animate-ping"
        style={{
          width: "1200px",
          height: "1200px",
          border: "2px solid rgba(239,68,68,0.18)",
          animationDuration: "4.5s",
          animationDelay: "0.4s",
        }}
      />

      {/* Ring 3 — purple mid */}
      <div
        className="absolute rounded-full animate-ping"
        style={{
          width: "900px",
          height: "900px",
          border: "2px solid rgba(168,85,247,0.28)",
          animationDuration: "4s",
          animationDelay: "0.8s",
        }}
      />

      {/* Ring 2 — golden yellow */}
      <div
        className="absolute rounded-full animate-ping"
        style={{
          width: "650px",
          height: "650px",
          border: "2px solid rgba(234,179,8,0.32)",
          animationDuration: "3.5s",
          animationDelay: "1.2s",
        }}
      />

      {/* Inner ring — bright purple */}
      <div
        className="absolute rounded-full animate-ping"
        style={{
          width: "400px",
          height: "400px",
          border: "2.5px solid rgba(192,132,252,0.45)",
          animationDuration: "3s",
          animationDelay: "1.6s",
        }}
      />

      {/* Static glow orb at centre — purple/yellow blend */}
      <div
        className="absolute rounded-full"
        style={{
          width: "220px",
          height: "220px",
          background:
            "radial-gradient(circle, rgba(168,85,247,0.35) 0%, rgba(234,179,8,0.10) 60%, transparent 100%)",
          filter: "blur(22px)",
        }}
      />
    </div>
  );
}
