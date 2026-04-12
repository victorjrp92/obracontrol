interface ObreroLayoutProps {
  obreroNombre: string;
  contratistaNombre: string;
  children: React.ReactNode;
}

export default function ObreroLayout({
  obreroNombre,
  contratistaNombre,
  children,
}: ObreroLayoutProps) {
  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <img
          src="/seiricon-icon.png"
          alt="Seiricon"
          className="w-8 h-8 flex-shrink-0"
        />
        <div className="min-w-0">
          <div className="text-base font-bold text-slate-900 truncate">
            {obreroNombre}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {contratistaNombre}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">{children}</main>
    </div>
  );
}
