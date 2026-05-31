const LAYERS = [
  { schema: "raw.*",      sub: "source",       color: "text-gray-400" },
  { schema: "clean.*",    sub: "validated",    color: "text-blue-600" },
  { schema: "research.*", sub: "de-id",        color: "text-green-600" },
] as const;

type Layer = "raw" | "clean" | "research" | null;

interface FlowStripProps {
  active?: Layer;
  right?: React.ReactNode;
}

export default function FlowStrip({ active = null, right }: FlowStripProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 px-4 sm:px-7 py-[8px] bg-white border-b border-gray-200 overflow-x-auto">
      <span className="text-[10px] font-semibold text-gray-400 mr-1 shrink-0 hidden sm:block">Data flow</span>
      <span className="text-gray-200 hidden sm:block">·</span>
      {LAYERS.map((l, i) => {
        const isActive = active && l.schema.startsWith(active);
        return (
          <div key={l.schema} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className={`flex items-center gap-[4px] sm:gap-[6px] px-[7px] sm:px-[10px] py-[3px] sm:py-1 rounded border text-[10px] sm:text-[11px] font-mono font-semibold transition-colors ${
              isActive ? "bg-blue-50 border-blue-300" : "bg-[#f8f9fb] border-gray-200"
            }`}>
              <span className={isActive ? l.color : "text-gray-400"}>{l.schema}</span>
              <span className="text-[9px] sm:text-[10px] font-normal font-sans text-gray-400">{l.sub}</span>
            </div>
            {i < LAYERS.length - 1 && (
              <svg className="w-2 h-2 sm:w-3 sm:h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
      {right && <div className="ml-auto flex items-center gap-[6px] text-[10px] sm:text-[11px] text-gray-400 shrink-0 pl-2">{right}</div>}
    </div>
  );
}
