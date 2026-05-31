"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import FlowStrip from "@/components/FlowStrip";
import RBACGuard from "@/components/RBACGuard";
import { api } from "@/lib/api";

const FILTER_OPTS = [
  { key: "age_band",       label: "Age",       options: [["PAEDIATRIC","Paediatric"],["YOUNG_ADULT","Young adult"],["ADULT","Adult"],["ELDERLY","Elderly"]] },
  { key: "gender",         label: "Gender",    options: [["M","Male"],["F","Female"],["UNKNOWN","Unknown"]] },
  { key: "admission_type", label: "Admission", options: [["EMERGENCY","Emergency"],["URGENT","Urgent"],["PLANNED","Planned"],["ELECTIVE","Elective"]] },
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
        <div className="flex items-center justify-between px-4 sm:px-7 py-3 sm:py-4 bg-white border-b border-gray-200">
          <div>
            <h1 className="text-[16px] sm:text-[18px] font-bold text-gray-900">Data Browser</h1>
            <p className="text-[11px] sm:text-[12px] text-gray-400 mt-0.5 hidden sm:block">Browse clean and de-identified research layers.</p>
          </div>
        </div>

        <FlowStrip active={tab === "clean" ? "clean" : "research"} />

        {/* Tabs */}
        <div className="flex gap-0 px-4 sm:px-7 bg-white border-b border-gray-200">
          {([["clean", "clean.patients"], ["research", "research.cohort"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setPage(0); setFilters({ age_band: "", gender: "", admission_type: "" }); }}
              className={`flex items-center gap-[6px] px-[10px] sm:px-[14px] py-3 text-[11px] sm:text-[12px] font-mono font-semibold border-b-2 transition-colors ${
                tab === t ? "border-[#51247A] text-[#51247A]" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}>
              <span className={`w-[5px] h-[5px] rounded-full ${tab === t ? "bg-[#51247A]" : "bg-gray-300"}`} />
              {label}
              <span className="font-mono text-[9px] sm:text-[10px] px-[5px] py-[1px] bg-[#f8f9fb] border border-gray-200 rounded-full text-gray-400">
                {tab === t ? (data?.total ?? "…") : "—"}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        {tab === "research" && (
          <div className="flex items-center gap-2 px-4 sm:px-7 py-[8px] bg-white border-b border-gray-200 overflow-x-auto">
            <span className="text-[10px] font-semibold text-gray-400 shrink-0">Filter:</span>
            {FILTER_OPTS.map(({ key, label, options }) => (
              <select key={key} value={filters[key as keyof typeof filters]}
                onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(0); }}
                className="border border-gray-200 rounded-[5px] px-2 py-[5px] text-[11px] text-gray-600 bg-[#f8f9fb] focus:outline-none focus:border-[#51247A] shrink-0">
                <option value="">{label}: all</option>
                {options.map(([val, display]) => <option key={val} value={val}>{display}</option>)}
              </select>
            ))}
            {hasFilter && (
              <button onClick={() => { setFilters({ age_band: "", gender: "", admission_type: "" }); setPage(0); }}
                className="text-[11px] text-red-400 hover:text-red-600 shrink-0">Clear</button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-7 py-[8px] bg-[#f8f9fb] border-b border-gray-200">
            <span className="font-mono text-[10px] sm:text-[11px] text-gray-400">
              {data ? <><span className="font-semibold text-gray-600">{data.total.toLocaleString()}</span> records</> : "Loading…"}
            </span>
            <div className="flex gap-[6px]">
              {["←", "→"].map(lbl => (
                <button key={lbl} onClick={() => setPage(p => lbl === "←" ? Math.max(0, p - 1) : p + 1)}
                  disabled={lbl === "←" ? page === 0 : (page + 1) * limit >= (data?.total ?? 0)}
                  className="text-[11px] px-2 sm:px-[10px] py-[5px] bg-white border border-gray-200 rounded disabled:opacity-40 text-gray-600 hover:bg-gray-50">
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable table */}
          <div className="flex-1 overflow-auto">
            {data?.records?.[0] && (
              <table className="min-w-full">
                <thead className="bg-[#f8f9fb] border-b border-gray-200 sticky top-0">
                  <tr>
                    {columns.map(c => (
                      <th key={c} className="px-3 sm:px-4 py-2 text-left">
                        <span className="font-mono text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                          {c.replace(/_/g, " ")}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((row: any, ri: number) => (
                    <tr key={ri} className={ri % 2 === 1 ? "bg-[#f8f9fb]" : "bg-white"}>
                      {columns.map((c, ci) => {
                        const val = row[c];
                        const isQuality = c === "data_quality_flag";
                        const isNull = val === null || val === undefined;
                        return (
                          <td key={c} className="px-3 sm:px-4 py-[6px] sm:py-[7px] border-b border-gray-100">
                            {isQuality ? (
                              <span className={`font-sans text-[9px] sm:text-[10px] font-medium px-2 py-[2px] rounded-full border ${QUALITY_COLORS[val] ?? "bg-gray-100 text-gray-500"}`}>
                                {val}
                              </span>
                            ) : (
                              <span className={`font-mono text-[10px] sm:text-[11px] whitespace-nowrap ${isNull ? "text-gray-200" : ci === 0 ? "text-gray-900 font-semibold" : "text-gray-500"}`}>
                                {isNull ? "—" : String(val).length > 25 ? String(val).slice(0, 25) + "…" : String(val)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!data && <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>}
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
