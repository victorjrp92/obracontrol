"use client";

import { useState, useRef } from "react";
import { Video, X, Loader2 } from "lucide-react";

export interface CapturedVideo {
  blob: Blob;
  preview: string;
  timestamp: Date;
}

interface VideoCaptureProps {
  onChange: (video: CapturedVideo | null) => void;
  initialVideo?: CapturedVideo | null;
}

const MAX_SIZE_MB = 50;

export default function VideoCapture({ onChange, initialVideo = null }: VideoCaptureProps) {
  const [video, setVideo] = useState<CapturedVideo | null>(initialVideo);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`El video excede ${MAX_SIZE_MB}MB. Graba uno más corto.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setProcessing(true);
    try {
      // Verify duration <= 30s
      const duration = await getVideoDuration(file);
      if (duration > 31) {
        setError(`El video dura ${Math.round(duration)}s. Máximo permitido: 30s.`);
        if (inputRef.current) inputRef.current.value = "";
        setProcessing(false);
        return;
      }

      const preview = URL.createObjectURL(file);
      const newVideo: CapturedVideo = {
        blob: file,
        preview,
        timestamp: new Date(),
      };
      setVideo(newVideo);
      onChange(newVideo);
    } catch (err) {
      console.error(err);
      setError("Error procesando video");
    } finally {
      setProcessing(false);
    }
  }

  function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(v.src);
        resolve(v.duration);
      };
      v.onerror = () => reject(new Error("No se pudo leer metadata del video"));
      v.src = URL.createObjectURL(file);
    });
  }

  function removeVideo() {
    if (video) URL.revokeObjectURL(video.preview);
    setVideo(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      {video ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 group">
          <video src={video.preview} controls className="w-full max-h-64 bg-black" />
          <button
            type="button"
            onClick={removeVideo}
            className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="block">
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleFileChange}
            disabled={processing}
            className="hidden"
          />
          <div className="aspect-video sm:aspect-[3/1] rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors">
            {processing ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <>
                <Video className="w-8 h-8 mb-1" />
                <span className="text-xs font-medium">Grabar video (opcional)</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Máximo 30 segundos</span>
              </>
            )}
          </div>
        </label>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
