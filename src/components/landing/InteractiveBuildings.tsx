"use client";

import { useEffect, useRef } from "react";

interface InteractiveBuildingsProps {
  className?: string;
}

interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: [number, number, number];
}

const BUILDINGS: Building[] = [
  { x: -80, z: -35, w: 30, d: 30, h: 200, color: [100, 180, 255] },
  { x: -5, z: -50, w: 25, d: 25, h: 155, color: [130, 200, 255] },
  { x: 70, z: -20, w: 28, d: 28, h: 230, color: [80, 160, 240] },
  { x: -45, z: 45, w: 24, d: 24, h: 120, color: [90, 170, 245] },
  { x: 25, z: 55, w: 26, d: 26, h: 170, color: [110, 190, 255] },
  { x: 85, z: 40, w: 22, d: 22, h: 140, color: [95, 175, 250] },
];

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 5], [0, 3], [3, 4], [4, 5], [1, 4],
];

function rotateX(x: number, y: number, z: number, a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

function rotateY(x: number, y: number, z: number, a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}

export default function InteractiveBuildings({ className = "" }: InteractiveBuildingsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rotYAngle = 0.5;
    let time = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.scale(dpr, dpr);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    function draw() {
      const rect = canvas!.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const cx = W / 2;
      const cy = H / 2 + H * 0.08;
      const fov = Math.min(W, H) * 1.4;
      const rotXAngle = 0.35;
      const sp = 5;

      // Scale factor based on canvas size so buildings fill proportionally
      const scale = Math.min(W, H) / 400;

      function proj(x: number, y: number, z: number): [number, number, number] {
        const s = fov / (fov + z);
        return [x * s * scale + cx, y * s * scale + cy, z];
      }

      rotYAngle += 0.003;
      time += 0.015;

      // Clear with transparent so parent bg shows through
      ctx!.clearRect(0, 0, W, H);

      // Ground dots
      for (let gx = -120; gx <= 120; gx += 10) {
        for (let gz = -100; gz <= 100; gz += 10) {
          let [x, y, z] = rotateX(gx, 0, gz, rotXAngle);
          [x, y, z] = rotateY(x, y, z, rotYAngle);
          const [sx, sy, sz] = proj(x, y, z);
          const a = Math.max(0.03, 0.2 - sz / 800);
          ctx!.beginPath();
          ctx!.arc(sx, sy, 0.8 * scale, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(100,180,255,${a.toFixed(2)})`;
          ctx!.fill();
        }
      }

      // Buildings — edges
      for (const b of BUILDINGS) {
        for (let y = 0; y <= b.h; y += sp) {
          for (let bx = b.x - b.w / 2; bx <= b.x + b.w / 2; bx += sp) {
            for (const zOff of [b.z - b.d / 2, b.z + b.d / 2]) {
              let [px, py, pz] = rotateX(bx, -y, zOff, rotXAngle);
              [px, py, pz] = rotateY(px, py, pz, rotYAngle);
              const [sx, sy, sz] = proj(px, py, pz);
              const a = Math.max(0.06, 0.8 - (sz + 250) / 600);
              ctx!.beginPath();
              ctx!.arc(sx, sy, (1 + a * 0.5) * scale, 0, Math.PI * 2);
              ctx!.fillStyle = `rgba(${b.color[0]},${b.color[1]},${b.color[2]},${a.toFixed(2)})`;
              ctx!.fill();
            }
          }
          for (let bz = b.z - b.d / 2; bz <= b.z + b.d / 2; bz += sp) {
            for (const xOff of [b.x - b.w / 2, b.x + b.w / 2]) {
              let [px, py, pz] = rotateX(xOff, -y, bz, rotXAngle);
              [px, py, pz] = rotateY(px, py, pz, rotYAngle);
              const [sx, sy, sz] = proj(px, py, pz);
              const a = Math.max(0.06, 0.8 - (sz + 250) / 600);
              ctx!.beginPath();
              ctx!.arc(sx, sy, (1 + a * 0.5) * scale, 0, Math.PI * 2);
              ctx!.fillStyle = `rgba(${b.color[0]},${b.color[1]},${b.color[2]},${a.toFixed(2)})`;
              ctx!.fill();
            }
          }
        }

        // Windows
        for (let y = 8; y < b.h - 8; y += 14) {
          for (let bx = b.x - b.w / 2 + 4; bx <= b.x + b.w / 2 - 4; bx += 8) {
            const flicker = Math.sin(time * 2 + bx * 0.3 + y * 0.2) * 0.3 + 0.7;
            for (const zOff of [b.z - b.d / 2 - 0.5, b.z + b.d / 2 + 0.5]) {
              let [px, py, pz] = rotateX(bx, -y, zOff, rotXAngle);
              [px, py, pz] = rotateY(px, py, pz, rotYAngle);
              const [sx, sy, sz] = proj(px, py, pz);
              const a = Math.max(0.05, 0.7 - (sz + 250) / 600) * flicker;
              ctx!.beginPath();
              ctx!.arc(sx, sy, 0.9 * scale, 0, Math.PI * 2);
              ctx!.fillStyle = `rgba(220,240,255,${a.toFixed(2)})`;
              ctx!.fill();
            }
          }
        }
      }

      // Connections between building tops
      for (const [ai, bi] of CONNECTIONS) {
        const a = BUILDINGS[ai], b = BUILDINGS[bi];
        let [x1, y1, z1] = rotateX(a.x, -a.h, a.z, rotXAngle);
        [x1, y1, z1] = rotateY(x1, y1, z1, rotYAngle);
        let [x2, y2, z2] = rotateX(b.x, -b.h, b.z, rotXAngle);
        [x2, y2, z2] = rotateY(x2, y2, z2, rotYAngle);
        const [sx1, sy1] = proj(x1, y1, z1);
        const [sx2, sy2] = proj(x2, y2, z2);
        const midY = Math.min(sy1, sy2) - 25 * scale;

        ctx!.beginPath();
        ctx!.moveTo(sx1, sy1);
        ctx!.quadraticCurveTo((sx1 + sx2) / 2, midY, sx2, sy2);
        ctx!.strokeStyle = "rgba(100,200,255,0.2)";
        ctx!.lineWidth = 0.8 * scale;
        ctx!.stroke();

        // Traveling dot
        const t = (Math.sin(time * 1.5 + ai * 0.9) + 1) / 2;
        const tx = (1 - t) ** 2 * sx1 + 2 * (1 - t) * t * ((sx1 + sx2) / 2) + t ** 2 * sx2;
        const ty = (1 - t) ** 2 * sy1 + 2 * (1 - t) * t * midY + t ** 2 * sy2;
        ctx!.beginPath();
        ctx!.arc(tx, ty, 2 * scale, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(100,220,255,0.8)";
        ctx!.fill();
      }

      // Top markers (pulsing circles on building tops)
      for (const b of BUILDINGS) {
        let [x, y, z] = rotateX(b.x, -b.h, b.z, rotXAngle);
        [x, y, z] = rotateY(x, y, z, rotYAngle);
        const [sx, sy] = proj(x, y, z);
        const p = Math.sin(time * 2 + b.x) * 0.5 + 0.5;

        ctx!.beginPath();
        ctx!.arc(sx, sy, (2 + p * 4) * scale, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(100,220,255,${(0.15 + p * 0.15).toFixed(2)})`;
        ctx!.lineWidth = 0.8 * scale;
        ctx!.stroke();

        ctx!.beginPath();
        ctx!.arc(sx, sy, 2 * scale, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(100,220,255,0.85)";
        ctx!.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full ${className}`}
      style={{ background: "transparent" }}
    />
  );
}
