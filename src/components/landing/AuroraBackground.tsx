"use client";

import { ReactNode } from "react";

interface AuroraBackgroundProps {
  children: ReactNode;
  className?: string;
}

/**
 * Aurora animated background — dark blue base with subtle animated blue/purple gradients.
 * Uses CSS-only animation for performance.
 */
export default function AuroraBackground({ children, className = "" }: AuroraBackgroundProps) {
  return (
    <div className={`aurora-wrap ${className}`}>
      <div className="aurora-layer aurora-mask" aria-hidden="true" />
      <div className="aurora-content">{children}</div>
    </div>
  );
}
