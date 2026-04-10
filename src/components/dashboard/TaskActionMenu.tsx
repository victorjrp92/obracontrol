"use client";

import { useState } from "react";
import { AlertTriangle, Calendar } from "lucide-react";
import RetrasoModal from "./RetrasoModal";
import ExtensionModal from "./ExtensionModal";

interface TaskActionMenuProps {
  tareaId: string;
  canExtend: boolean;
}

export default function TaskActionMenu({ tareaId, canExtend }: TaskActionMenuProps) {
  const [showRetraso, setShowRetraso] = useState(false);
  const [showExtension, setShowExtension] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowRetraso(true)}
          className="inline-flex items-center gap-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Registrar retraso
        </button>
        {canExtend && (
          <button
            onClick={() => setShowExtension(true)}
            className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            Solicitar extensión
          </button>
        )}
      </div>

      {showRetraso && <RetrasoModal tareaId={tareaId} onClose={() => setShowRetraso(false)} />}
      {showExtension && <ExtensionModal tareaId={tareaId} onClose={() => setShowExtension(false)} />}
    </>
  );
}
