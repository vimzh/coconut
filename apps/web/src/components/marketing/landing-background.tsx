"use client";

// Fixed decorative shader fills the viewport behind the landing content.
import { useSyncExternalStore } from "react";
import { GrainGradient } from "@paper-design/shaders-react";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function LandingBackground() {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}>
      <GrainGradient
        width="100%"
        height="100%"
        colors={["#3e6274", "#a49c74", "#568b50"]}
        colorBack="#0e0d16"
        softness={0}
        intensity={0.15}
        noise={0.5}
        shape="blob"
        speed={reducedMotion ? 0 : 1}
        scale={1.3}
      />
      <div style={{ position: "absolute", inset: 0, background: "#0e0d1680" }} />
    </div>
  );
}
