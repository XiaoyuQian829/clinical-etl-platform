"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import FlowStrip from "@/components/FlowStrip";
import RBACGuard from "@/components/RBACGuard";
import { api } from "@/lib/api";

const QUALITY_COLORS: Record<string, string> = {
  PASS: "bg-green-50 text-green-700 border-green-200",
  WARN: "bg-amber-50 text-amber-700 border-amber-200",
  FAIL: "bg-red-50 text-red-700 border-red-200",
};

const TABS = [
  { key: "clean.patients",          label: "clean.patients",          layer: "clean",    desc: "Validated patient demographics" },
  { key: "clean.admissions",        label: "clean.admissions",        layer: "clean",    desc: "Hospital visits with LOS" },
  { key: "clean.diagnoses",         label: "clean.diagnoses",         layer: "clean",    desc: "ICD codes + descriptions" },
  { key: "research.cohort",         label: "research.cohort",         layer: "research", desc: "De-identified research cohort" },
  { key: "raw.lab_events",          label: "raw.lab_events",          layer: "raw",      desc: "107,727 lab results" },
  { key: "raw.chart_events",        label: "raw.chart_events",        layer: "raw",      desc: "668,862 vitals & nurse notes" },
  { key: "raw.prescriptions",       label: "raw.prescriptions",       layer: "raw",      desc: "18,087 medication orders" },
  { key: "raw.microbiology_events", label: "raw.microbiology_events", layer: "raw",      desc: "2,899 culture results" },
  { key: "raw.icu_stays",           label: "raw.icu_stays",           layer: "raw",      desc: "140 ICU stays" },
  { key: "raw.transfers",           label: "raw.transfers",           layer: "raw",      desc: "633 ward transfers" },
] as const;

type TabKey = typeof TABS[number]["key"];

const LAYER_STYLE: Record<string, { dot: string; tab: string; active: string }> = {
  clean:    { dot: "bg-blue-400",   tab: "text-blue-600",  active: "border-blue-500 text-blue-700" },
  research: { dot: "bg-[#51247A]",  tab: "text-[#51247A]", active: "border-[#51247A] text-[#51247A]" },
  raw:      { dot: "bg-gray-400",   tab: "text-gray-500",  active: "border-gray-600 text-gray-700" },
};

const RESEARCH_FILTERS = [
  { key: "age_band",       label: "Age",       options: [["PAEDIATRIC","Paediatric"],["YOUNG_ADULT","Young adult"],["ADULT","Adult"],["ELDERLY","Elderly"]] },
  { key: "gender",         label: "Gender",    options: [["M","Male"],["F","Female"],["UNKNOWN","Unknown"]] },
  { key: "admission_type", label: "Admission", options: [["EMERGENCY","Emergency"],["URGENT","Urgent"],["PLANNED","Planned"],["ELECTIVE","Elective"]] },
];

async function fetchTab(tabKey: TabKey, page: number, limit: number, filters: Record<string, string>) {
  const offset = page * limit;
  if (tabKey === "clean.patients")          return (await api.getCleanPatients(limit, offset)).data;
  if (tabKey === "clean.admissions")        return (await (api as any).get(`/data/clean/admissions?limit=${limit}&offset=${offset}`)).data.data;
  if (tabKey === "clean.diagnoses")         return (await (api as any).get(`/data/clean/diagnoses?limit=${limit}&offset=${offset}`)).data.data;
  if (tabKey === "research.cohort")         return (await api.getResearchCohort({ limit, offset, ...filters })).data;
  // raw tables
  const rawTable = tabKey.replace("raw.", "");
  return (await (api as any).get(`/data/raw/${rawTable}?limit=${limit}&offset=${offset}`)).data.data;
}

export default function DataPage() {
  const router  = useRouter();
  const [tab,     setTab]     = useState<TabKey>("clean.patients");
  const [data,    setData]    = useState<any>(null);
  const [page,    setPage]    = useState(0);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const limit = 50;

  const load = useCallback(async () => {
    if (!localStorage.getItem("access_token")) { router.push("/login"); return; }
    setData(null);
    try {
      const res = await fetchTab(tab, page, limit, filters);
      setData(res);
    } catch {
      setData({ total: 0, records: [] });
    }
  }, [tab, page, filters, router]);

  useEffect(() => { load(); }, [load]);

  const columns = data?.records?.[0] ? Object.keys(data.records[0]) : [];
  const currentTab = TABS.find(t => t.key === tab)!;
  const layerStyle = LAYER_STYLE[currentTab.layer];

  return (
    <RBACGuard requiredRole="researcher">
      <AppLayout>
        <div className="flex items-center justify-between px-4 sm:px-7 py-3 sm:py-4 bg-white border-b border-gray-200">
          <div>
            <h1 className="text-[16px] sm:text-[18px] font-bold text-gray-900">Data Browser</h1>
            <p className="text-[11px] sm:text-[12px] text-gray-400 mt-0.5 hidden sm:block">{currentTab.desc}</p>
          </div>
          {data && (
            <span className="font-mono text-[11px] text-gray-500">
              <span className="font-bold text-gray-800">{data.total?.toLocaleString()}</span> rows
            </span>
          )}
        </div>

        <FlowStrip active={currentTab.layer === "clean" ? "clean" : currentTab.layer === "research" ? "research" : "raw"} />

        {/* Tab bar — scrollable */}
        <div className="flex gap-0 px-4 sm:px-7 bg-white border-b border-gray-200 overflow-x-auto">
          {TABS.map(t => {
            const ls = LAYER_STYLE[t.layer];
            const active = tab === t.key;
            return (
              <button key={t.key}
                onClick={() => { setTab(t.key); setPage(0); setFilters({}); }}
                className={`flex items-center gap-[5px] px-3 py-[10px] text-[10px] sm:text-[11px] font-mono font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
                  active ? `${ls.active} border-current` : `border-transparent ${ls.tab} hover:opacity-80`
                }`}>
                <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${ls.dot}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Filters — research cohort only */}
        {tab === "research.cohort" && (
          <div className="flex items-center gap-2 px-4 sm:px-7 py-[8px] bg-white border-b border-gray-200 overflow-x-auto">
            <span className="text-[10px] font-semibold text-gray-400 shrink-0">Filter:</span>
            {RESEARCH_FILTERS.map(({ key, label, options }) => (
              <select key={key} value={filters[key] ?? ""}
                onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(0); }}
                className="border border-gray-200 rounded-[5px] px-2 py-[5px] text-[11px] text-gray-600 bg-[#f8f9fb] focus:outline-none focus:border-[#51247A] shrink-0">
                <option value="">{label}: all</option>
                {options.map(([val, display]) => <option key={val} value={val}>{display}</option>)}
              </select>
            ))}
            {Object.values(filters).some(Boolean) && (
              <button onClick={() => { setFilters({}); setPage(0); }} className="text-[11px] text-red-400 hover:text-red-600 shrink-0">Clear</button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-7 py-[8px] bg-[#f8f9fb] border-b border-gray-200 shrink-0">
            <span className="font-mono text-[10px] sm:text-[11px] text-gray-400">
              {data
                ? <><span className="font-semibold text-gray-600">{data.total?.toLocaleString()}</span> records · page {page + 1}</>
                : "Loading…"}
            </span>
            <div className="flex gap-[6px]">
              {["←", "→"].map(lbl => (
                <button key={lbl}
                  onClick={() => setPage(p => lbl === "←" ? Math.max(0, p - 1) : p + 1)}
                  disabled={lbl === "←" ? page === 0 : (page + 1) * limit >= (data?.total ?? 0)}
                  className="text-[11px] px-2 sm:px-[10px] py-[5px] bg-white border border-gray-200 rounded disabled:opacity-40 text-gray-600 hover:bg-gray-50">
                  {lbl}
                </button>
              ))}
            </div>
          </div>

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
                                {isNull ? "—" : String(val).length > 30 ? String(val).slice(0, 30) + "…" : String(val)}
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
            {data && data.records?.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No records found.</div>
            )}
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
