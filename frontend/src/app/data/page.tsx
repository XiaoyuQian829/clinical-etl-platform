"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import FlowStrip from "@/components/FlowStrip";
import RBACGuard from "@/components/RBACGuard";
import { api } from "@/lib/api";

const FILTER_OPTS = [
  { key: "age_band",       label: "Age group",       options: [["PAEDIATRIC","Paediatric (0–17)"],["YOUNG_ADULT","Young adult (18–40)"],["ADULT","Adult (41–65)"],["ELDERLY","Elderly (66+)"]] },
  { key: "gender",         label: "Gender",           options: [["M","Male"],["F","Female"],["UNKNOWN","Unknown"]] },
  { key: "admission_type", label: "Admission type",   options: [["EMERGENCY","Emergency"],["URGENT","Urgent"],["PLANNED","Planned"],["ELECTIVE","Elective"]] },
];

const QUALITY_COLORS: Record<string, string> = {
  PASS: "bg-green-50 text-green-700 border-green-200",
  WARN: "bg-amber-50 text-amber-700 border-amber-200",
  FAIL: "bg-red-50 text-red-700 border-red-200",
};

type Tab = "clean" | "research";

export default function DataPage() {
  const router = useRouter();
  const [tab,     setTab]     = useState<Tab>("clean");
  const [data,    setData]    = useState<any>(null);
  const [page,    setPage]    = useState(0);
  const [filters, setFilters] = useState({ age_band: "", gender: "", admission_type: "" });
  const limit = 20;

  useEffect(() => {
    setData(null);
    (async () => {
      try {
        if (tab === "clean") {
          const res = await api.getCleanPatients(limit, page * limit);
          setData(res.data);
        } else {
          const params: Record<string, unknown> = { limit, offset: page * limit };
          if (filters.age_band)       params.age_band       = filters.age_band;
          if (filters.gender)         params.gender         = filters.gender;
          if (filters.admission_type) params.admission_type = filters.admission_type;
          const res = await api.getResearchCohort(params);
          setData(res.data);
        }
      } catch { router.push("/login"); }
    })();
  }, [tab, page, filters, router]);

  const columns  = data?.records?.[0] ? Object.keys(data.records[0]) : [];
  const hasFilter = Object.values(filters).some(Boolean);

  return (
    <RBACGuard requiredRole="researcher">
      <AppLayout>
        {/* Top bar */}
        <div className="flex items-center justify-between px-7 py-4 bg-white border-b border-gray-200">
          <div>
            <h1 className="text-[18px] font-bold text-gray-900">Data Browser</h1>
            <p className="text-[12px] text-gray-400 mt-0.5">Browse clean and de-identified research layers of the warehouse.</p>
          </div>
        </div>

        <FlowStrip active={tab === "clean" ? "clean" : "research"} />

        {/* Tabs */}
        <div className="flex gap-0 px-7 bg-white border-b border-gray-200">
          {([["clean", "clean.patients"], ["research", "research.cohort"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setPage(0); setFilters({ age_band: "", gender: "", admission_type: "" }); }}
              className={`flex items-center gap-[7px] px-[14px] py-3 text-[12px] font-mono font-semibold border-b-2 transition-colors ${
                tab === t ? "border-[#51247A] text-[#51247A]" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}>
              <span className={`w-[6px] h-[6px] rounded-full ${tab === t ? "bg-[#51247A]" : "bg-gray-300"}`} />
              {label}
              <span className="font-mono text-[10px] px-[6px] py-[1px] bg-[#f8f9fb] border border-gray-200 rounded-full text-gray-400">
                {tab === t ? (data?.total ?? "…") : "—"}
              </span>
            </button>
          ))}
        </div>

        {/* Filters (research only) */}
        {tab === "research" && (
          <div className="flex items-center gap-[10px] px-7 py-[10px] bg-white border-b border-gray-200">
            <span className="text-[11px] font-semibold text-gray-400">Filter:</span>
            {FILTER_OPTS.map(({ key, label, options }) => (
              <select key={key} value={filters[key as keyof typeof filters]}
                onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(0); }}
                className="border border-gray-200 rounded-[5px] px-3 py-[6px] text-[12px] text-gray-600 bg-[#f8f9fb] focus:outline-none focus:border-[#51247A]">
                <option value="">{label}: all</option>
                {options.map(([val, display]) => <option key={val} value={val}>{display}</option>)}
              </select>
            ))}
            {hasFilter && (
              <button onClick={() => { setFilters({ age_band: "", gender: "", admission_type: "" }); setPage(0); }}
                className="text-[11px] text-red-400 hover:text-red-600">
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-7 py-[9px] bg-[#f8f9fb] border-b border-gray-200">
            <span className="font-mono text-[11px] text-gray-400">
              {data ? <><span className="font-semibold text-gray-600">{data.total.toLocaleString()}</span> records{hasFilter && " (filtered)"}  ·  showing {page * limit + 1}–{Math.min((page + 1) * limit, data.total)}</> : "Loading…"}
            </span>
            <div className="flex gap-[6px]">
              {["← Prev", "Next →"].map(lbl => (
                <button key={lbl} onClick={() => setPage(p => lbl.includes("Prev") ? Math.max(0, p - 1) : p + 1)}
                  disabled={lbl.includes("Prev") ? page === 0 : (page + 1) * limit >= (data?.total ?? 0)}
                  className="text-[11px] px-[10px] py-[5px] bg-white border border-gray-200 rounded disabled:opacity-40 text-gray-600 hover:bg-gray-50">
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Header */}
          {data?.records?.[0] && (
            <div className="flex px-7 bg-[#f8f9fb] border-b border-gray-200">
              {columns.map(c => (
                <div key={c} className="flex-1 min-w-[80px] py-2 pr-4">
                  <span className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-wide">{c.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {data ? (
              data.records.map((row: any, ri: number) => (
                <div key={ri} className={`flex px-7 border-b border-gray-100 ${ri % 2 === 1 ? "bg-[#f8f9fb]" : "bg-white"}`}>
                  {columns.map((c, ci) => {
                    const val = row[c];
                    const isQuality = c === "data_quality_flag";
                    const isNull = val === null || val === undefined;
                    return (
                      <div key={c} className="flex-1 min-w-[80px] py-[7px] pr-4 flex items-center">
                        {isQuality ? (
                          <span className={`font-sans text-[10px] font-medium px-2 py-[2px] rounded-full border ${QUALITY_COLORS[val] ?? "bg-gray-100 text-gray-500"}`}>
                            {val}
                          </span>
                        ) : (
                          <span className={`font-mono text-[11px] ${isNull ? "text-gray-200" : ci === 0 ? "text-gray-900 font-semibold" : "text-gray-500"}`}>
                            {isNull ? "—" : String(val).length > 30 ? String(val).slice(0, 30) + "…" : String(val)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
            )}
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
