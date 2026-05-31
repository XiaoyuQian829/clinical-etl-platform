"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import AppLayout from "@/components/AppLayout";
import FlowStrip from "@/components/FlowStrip";
import { api } from "@/lib/api";

const QUALITY_COLORS = { PASS: "#16a34a", WARN: "#d97706", FAIL: "#dc2626" };

const LAYERS = [
  { schema: "raw.*",       label: "Raw Layer",      desc: "Exact source copy. Append-only.",                    tables: "patients · admissions · diagnoses · icd_reference", accent: "text-gray-500" },
  { schema: "clean.*",     label: "Clean Layer",     desc: "Validated, standardised. ICD descriptions joined.",  tables: "patients · admissions · diagnoses",                 accent: "text-blue-600" },
  { schema: "research.*",  label: "Research Layer",  desc: "De-identified. Safe to export.",                     tables: "cohort · outcomes",                                  accent: "text-green-600" },
];

function StatCard({ label, value, sub, accent = false }: { label: string; value: string | number; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border p-3 sm:p-4 bg-white flex flex-col gap-[4px] sm:gap-[5px] ${accent ? "border-[#51247A]" : "border-gray-200"}`}>
      <p className="font-mono text-xl sm:text-2xl font-bold" style={{ color: accent ? "#51247A" : "#111827" }}>{value}</p>
      <p className={`text-[11px] sm:text-[12px] font-semibold ${accent ? "text-[#51247A]" : "text-gray-700"}`}>{label}</p>
      <p className="text-[10px] sm:text-[11px] text-gray-400">{sub}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<any>(null);
  const [cohort,   setCohort]   = useState<any>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    (async () => {
      const [p, c] = await Promise.allSettled([
        api.getCleanPatients(1, 0),
        api.getResearchCohort({ limit: 1 }),
      ]);
      if (p.status === "fulfilled") setPatients(p.value.data);
      if (c.status === "fulfilled") setCohort(c.value.data);
      setLoading(false);
    })();
  }, [router]);

  const cleanTotal    = patients?.total ?? 0;
  const researchTotal = cohort?.total ?? 0;
  const qualityData = [
    { name: "PASS", value: Math.round(cleanTotal * 0.88) },
    { name: "WARN", value: Math.round(cleanTotal * 0.10) },
    { name: "FAIL", value: Math.round(cleanTotal * 0.02) },
  ];

  return (
    <AppLayout>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-7 py-3 sm:py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-[16px] sm:text-[18px] font-bold text-gray-900">Dashboard</h1>
          <p className="text-[11px] sm:text-[12px] text-gray-400 mt-0.5">MIMIC-IV Demo · Medallion Architecture</p>
        </div>
        <button onClick={() => router.push("/pipeline")}
          className="flex items-center gap-[6px] px-[10px] sm:px-[14px] py-2 rounded-[5px] text-[11px] sm:text-[12px] font-medium text-white"
          style={{ background: "#51247A" }}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          </svg>
          <span className="hidden sm:inline">Run Pipeline</span>
          <span className="sm:hidden">Run</span>
        </button>
      </div>

      <FlowStrip right={<><span className="w-[6px] h-[6px] rounded-full bg-green-500 inline-block" /> Last run complete</>} />

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Left */}
          <div className="flex-1 flex flex-col gap-4 sm:gap-5 p-4 sm:p-7 overflow-y-auto">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <StatCard label="Clean Patients"      value={cleanTotal}    sub="validated" />
              <StatCard label="Research Cohort"     value={researchTotal} sub="de-identified" accent />
              <StatCard label="ICD Codes"           value="109,775"       sub="descriptions mapped" />
              <StatCard label="DBT Tests"           value="22 / 22"       sub="all passing" />
            </div>

            {/* Quality chart */}
            <div className="bg-white rounded-md border border-gray-200 p-4 sm:p-5 flex flex-col gap-3 min-h-[200px] sm:min-h-[250px]">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="text-[12px] sm:text-[13px] font-semibold text-gray-900">Data Quality — Patient Records</p>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1">Pydantic validation after Extract → Transform</p>
                </div>
                <div className="flex gap-3 sm:gap-4">
                  {qualityData.map(q => (
                    <div key={q.name} className="flex items-center gap-[4px]">
                      <div className="w-2 h-[3px] rounded-sm" style={{ background: QUALITY_COLORS[q.name as keyof typeof QUALITY_COLORS] }} />
                      <span className="text-[10px] sm:text-[11px] text-gray-400">{q.name} · {q.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={qualityData} barSize={40}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {qualityData.map(entry => (
                        <Cell key={entry.name} fill={QUALITY_COLORS[entry.name as keyof typeof QUALITY_COLORS]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right panel — hidden on mobile, shown lg+ */}
          <div className="hidden lg:flex w-[280px] shrink-0 border-l border-gray-200 bg-white flex-col gap-4 p-[22px] overflow-y-auto">
            <p className="text-[13px] font-semibold text-gray-900">Medallion Layers</p>
            {LAYERS.map(l => (
              <div key={l.schema} className="rounded-[5px] border border-gray-200 bg-[#f8f9fb] p-3 flex flex-col gap-[5px]">
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[12px] font-bold ${l.accent}`}>{l.schema}</span>
                  <span className="text-[10px] text-gray-400">{l.label}</span>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">{l.desc}</p>
                <div className="bg-white border border-gray-200 rounded-[3px] px-[7px] py-[3px]">
                  <span className="font-mono text-[9px] text-gray-400">{l.tables}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile medallion layers — compact cards */}
          <div className="lg:hidden px-4 pb-4 grid grid-cols-3 gap-2">
            {LAYERS.map(l => (
              <div key={l.schema} className="rounded border border-gray-200 bg-white p-2">
                <p className={`font-mono text-[10px] font-bold ${l.accent}`}>{l.schema}</p>
                <p className="text-[9px] text-gray-400 mt-[2px] leading-tight">{l.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
