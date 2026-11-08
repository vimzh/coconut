"use client";

// Replay the curve-and-chord sequence when a graph enters the viewport.
import { useEffect, useRef, type SVGProps } from "react";
import { cn } from "@/lib/utils";
import styles from "./animated-graph.module.css";

export function AnimatedGraph({ curve, children, className, ...props }: SVGProps<SVGSVGElement> & { curve: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const graph = ref.current;
    if (!graph) return;

    graph.dataset.motion = "pending";
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= 0.2) graph.dataset.motion = "playing";
      else if (!entry.isIntersecting) graph.dataset.motion = "pending";
    }, { threshold: [0, 0.2] });
    observer.observe(graph);
    return () => observer.disconnect();
  }, [curve]);

  return (
    <svg ref={ref} className={cn(styles.graph, className)} {...props}>
      {children}
      <circle data-graph="tracer" r="4" fill="currentColor" aria-hidden="true" style={{ offsetPath: `path('${curve}')`, offsetRotate: "0deg" }} />
    </svg>
  );
}
