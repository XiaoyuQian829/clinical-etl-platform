"use client";
import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import FlowStrip from "@/components/FlowStrip";
import RBACGuard from "@/components/RBACGuard";
import { api } from "@/lib/api";

// ── Static pipeline definition ──────────────────────────────────────────────
const PIPELINE = [
  {
    key: "extract",
    label: "Extract",
    layer: null,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
      </svg>
    ),
    color: { bg: "#f8f9fb", border: "#d1d5db", text: "#374151", badge: "#6b7280" },
    sources: ["patients.csv", "admissions.csv", "diagnoses_icd.csv", "chartevents.csv", "labevents.csv", "prescriptions.csv", "icustays.csv", "+ 19 more"],
    writes: ["raw.* (26 tables)"],
    transforms: [
      "26 CSV files read with pandas, nulls normalised",
      "Core: patients · admissions · diagnoses_icd",
      "Refs: d_icd_diagnoses (109,775) · d_items · d_labitems · d_hcpcs",
      "Hosp: labevents (107K) · prescriptions · emar · pharmacy · poe",
      "ICU: chartevents (668K) · inputevents · outputevents · icustays",
    ],
    stat: "26 tables · 1,398,531 rows → raw.*",
  },
  {
    key: "transform",
    label: "Transform",
    layer: "raw → clean",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    color: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", badge: "#3b82f6" },
    sources: ["raw.patients", "raw.admissions", "raw.diagnoses"],
    writes: ["clean.patients", "clean.admissions", "clean.diagnoses"],
    transforms: [
      "gender: M/F → 'Male'/'Female', unknown → NULL",
      "los_days: discharge_time − admit_time (hours ÷ 24)",
      "JOIN raw.diagnoses → raw.icd_reference on icd_code",
      "Attach long_title description to every diagnosis row",
      "Cast all date strings to TIMESTAMPTZ",
    ],
    stat: "109,775 ICD codes joined",
  },
  {
    key: "validate",
    label: "Validate",
    layer: "clean layer",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: { bg: "#fefce8", border: "#fde68a", text: "#92400e", badge: "#d97706" },
    sources: ["clean.*"],
    writes: ["validation_report (in-memory)"],
    transforms: [
      "Pydantic CleanPatient model: subject_id int, gender str|None",
      "los_days ≥ 0 constraint; admission_type in accepted set",
      "NOT NULL enforcement on primary keys",
      "22 DBT schema tests: not_null, unique, accepted_values, relationships",
      "Records tagged PASS / WARN / FAIL — FAIL rows quarantined",
    ],
    stat: "22 DBT tests · 88% PASS",
  },
  {
    key: "load",
    label: "Load",
    layer: "clean → research",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 4-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
    color: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", badge: "#16a34a" },
    sources: ["clean.patients", "clean.admissions", "clean.diagnoses"],
    writes: ["research.cohort", "research.outcomes"],
    transforms: [
      "k-Anonymity (k=5): suppress quasi-identifiers if group < 5",
      "subject_id → anonymised_id (SHA-256 hash, salted)",
      "age bucketed: 18–30, 31–45, 46–60, 61–75, 75+",
      "Postcode generalised to state level",
      "research.cohort: PASS-only records, de-identified",
    ],
    stat: "k=5 anonymity · GDPR-aligned",
  },
  {
    key: "dbt",
    label: "DBT",
    layer: "quality gate",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    color: { bg: "#fdf4ff", border: "#e9d5ff", text: "#6b21a8", badge: "#9333ea" },
    sources: ["clean.*", "research.*"],
    writes: ["DBT manifest + test results"],
    transforms: [
      "dbt run: materialise clean + research models",
      "dbt test: 22 tests across all models",
      "not_null(subject_id, admission_id, icd_code)",
      "unique(subject_id) on research.cohort",
      "relationships: diagnoses.subject_id → patients.subject_id",
    ],
    stat: "22 / 22 tests passing",
  },
];

const LAYERS = [
  { label: "Raw Layer", schema: "raw.*", accent: "#6b7280", bg: "#f8f9fb", tables: ["patients", "admissions", "diagnoses", "icd_reference"], desc: "Exact source copy — append-only, no transforms" },
  { label: "Clean Layer", schema: "clean.*", accent: "#2563eb", bg: "#eff6ff", tables: ["patients", "admissions", "diagnoses"], desc: "Validated, standardised, ICD descriptions joined" },
  { label: "Research Layer", schema: "research.*", accent: "#16a34a", bg: "#f0fdf4", tables: ["cohort", "outcomes"], desc: "De-identified (k=5), safe to export and query" },
];

// ── Sub-components ───────────────────────────────────────────────────────────
function Arrow() {
  return (
    <div className="hidden sm:flex items-center justify-center shrink-0 w-6">
      <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function StepCard({ step, status, expanded, onToggle }: {
  step: typeof PIPELINE[0];
  status?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isDone    = status === "complete";
  const isRunning = status === "running";
  const isFailed  = status === "failed";
  const c = step.color;

  return (
    <div
      className={`flex-1 min-w-[140px] rounded-lg border cursor-pointer transition-all select-none ${
        isDone    ? "border-green-300" :
        isRunning ? "border-blue-300 animate-pulse" :
        isFailed  ? "border-red-300" :
                    ""
      }`}
      style={{ borderColor: isDone ? undefined : isRunning ? undefined : isFailed ? undefined : c.border, background: c.bg }}
      onClick={onToggle}
    >
      <div className="p-3 sm:p-4 flex flex-col gap-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md p-[6px] bg-white border" style={{ borderColor: c.border, color: c.text }}>
              {step.icon}
            </div>
            <div>
              <p className="text-[13px] font-bold" style={{ color: c.text }}>{step.label}</p>
              {step.layer && <p className="text-[9px] font-mono" style={{ color: c.badge }}>{step.layer}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isDone    && <span className="text-[9px] font-medium px-2 py-[2px] rounded-full bg-green-100 text-green-700 border border-green-200">done</span>}
            {isRunning && <span className="text-[9px] font-medium px-2 py-[2px] rounded-full bg-blue-100 text-blue-700 border border-blue-200">running</span>}
            {isFailed  && <span className="text-[9px] font-medium px-2 py-[2px] rounded-full bg-red-100 text-red-700 border border-red-200">failed</span>}
            <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} style={{ color: c.badge }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Stat badge */}
        <span className="text-[9px] font-mono px-2 py-[2px] rounded-full self-start" style={{ color: c.badge, background: "rgba(255,255,255,0.7)", border: `1px solid ${c.border}` }}>
          {step.stat}
        </span>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-1 flex flex-col gap-3 border-t pt-3" style={{ borderColor: c.border }}>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: c.badge }}>Reads from</p>
              <div className="flex flex-wrap gap-1">
                {step.sources.map(s => (
                  <span key={s} className="font-mono text-[9px] px-[6px] py-[2px] rounded bg-white border" style={{ borderColor: c.border, color: c.text }}>{s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: c.badge }}>Writes to</p>
              <div className="flex flex-wrap gap-1">
                {step.writes.map(s => (
                  <span key={s} className="font-mono text-[9px] px-[6px] py-[2px] rounded bg-white border" style={{ borderColor: c.border, color: c.text }}>{s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: c.badge }}>Transformations</p>
              <ul className="flex flex-col gap-[3px]">
                {step.transforms.map((t, i) => (
                  <li key={i} className="flex items-start gap-[6px]">
                    <span className="w-[3px] h-[3px] rounded-full mt-[5px] shrink-0" style={{ background: c.badge }} />
                    <span className="text-[10px] leading-snug" style={{ color: c.text }}>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [running,   setRunning]   = useState(false);
  const [runId,     setRunId]     = useState<string | null>(null);
  const [status,    setStatus]    = useState<any>(null);
  const [history,   setHistory]   = useState<any[]>([]);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function triggerPipeline() {
    setRunning(true);
    setStatus(null);
    setExpanded(null);
    setError(null);
    try {
      const res = await api.runPipeline();
      const id  = res.data?.run_id;
      setRunId(id);
      setHistory(h => [{ run_id: id, started_at: new Date().toISOString(), status: "running" }, ...h]);
      pollRef.current = setInterval(async () => {
        try {
          const s = await api.getPipelineStatus(id);
          setStatus(s.data);
          if (s.data?.status !== "running") {
            clearInterval(pollRef.current!);
            setRunning(false);
            setHistory(h => h.map(r => r.run_id === id ? { ...r, ...s.data } : r));
          }
        } catch { clearInterval(pollRef.current!); setRunning(false); }
      }, 5000);
    } catch (e: any) {
      setRunning(false);
      setError(e?.response?.data?.detail ?? "Failed to reach API — check backend connection.");
    }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const allDone = status?.status === "complete";

  function toggle(key: string) {
    setExpanded(e => e === key ? null : key);
  }

  return (
    <RBACGuard requiredRole="admin">
      <AppLayout>
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 sm:px-7 py-3 sm:py-4 bg-white border-b border-gray-200">
          <div>
            <h1 className="text-[16px] sm:text-[18px] font-bold text-gray-900">ETL Pipeline</h1>
            <p className="text-[11px] sm:text-[12px] text-gray-400 mt-0.5">MIMIC-IV · Medallion Architecture · Click any step to expand</p>
          </div>
          <button onClick={triggerPipeline} disabled={running}
            className="flex items-center gap-[6px] px-[10px] sm:px-[14px] py-2 rounded-[5px] text-[11px] sm:text-[12px] font-medium text-white disabled:opacity-50"
            style={{ background: "#51247A" }}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            {running ? "Running…" : "Run Pipeline"}
          </button>
        </div>

        <FlowStrip right={allDone ? <><span className="w-[6px] h-[6px] rounded-full bg-green-500 inline-block" /> Complete</> : undefined} />

        {error && (
          <div className="mx-4 sm:mx-7 mt-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-5 p-4 sm:p-7 overflow-y-auto">

          {/* ── Medallion layer overview ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Medallion Architecture</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {LAYERS.map(l => (
                <div key={l.schema} className="rounded-lg border p-3 sm:p-4" style={{ background: l.bg, borderColor: "#e5e7eb" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] sm:text-[11px] font-bold" style={{ color: l.accent }}>{l.schema}</span>
                    <span className="text-[9px] text-gray-400 hidden sm:block">{l.label}</span>
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-gray-500 leading-snug mb-2 hidden sm:block">{l.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {l.tables.map(t => (
                      <span key={t} className="font-mono text-[8px] sm:text-[9px] px-[5px] py-[1px] rounded bg-white border border-gray-200 text-gray-500">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Pipeline steps ── */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pipeline Steps — click to expand</p>

            {/* Desktop: horizontal flow with arrows */}
            <div className="hidden sm:flex items-start gap-0">
              {PIPELINE.map((step, i) => (
                <div key={step.key} className="flex items-start flex-1 min-w-0">
                  <StepCard step={step} status={status?.steps?.[step.key]} expanded={expanded === step.key} onToggle={() => toggle(step.key)} />
                  {i < PIPELINE.length - 1 && <Arrow />}
                </div>
              ))}
            </div>

            {/* Mobile: vertical stack */}
            <div className="sm:hidden flex flex-col gap-2">
              {PIPELINE.map((step, i) => (
                <div key={step.key}>
                  <StepCard step={step} status={status?.steps?.[step.key]} expanded={expanded === step.key} onToggle={() => toggle(step.key)} />
                  {i < PIPELINE.length - 1 && (
                    <div className="flex justify-center py-1">
                      <svg className="w-4 h-4 text-gray-300 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Post-run record counts ── */}
          {allDone && status?.records && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Records Loaded</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[["patients","patients"], ["admissions","admissions"], ["diagnoses","diagnoses"]].map(([k, lbl]) => (
                  <div key={k} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-white border border-green-200 rounded-lg px-3 sm:px-5 py-3">
                    <span className="font-mono text-[20px] sm:text-[24px] font-bold text-green-600">{(status.records[k] ?? 0).toLocaleString()}</span>
                    <span className="text-[10px] sm:text-[12px] text-gray-400">{lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Run history ── */}
          {history.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Run History</p>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {history.map(r => (
                  <div key={r.run_id} className="flex items-center gap-2 px-4 py-[9px] border-b border-gray-100 last:border-0">
                    <span className="font-mono text-[10px] sm:text-[11px] text-gray-400 w-[80px] sm:w-[100px] truncate">{r.run_id}</span>
                    <span className="font-mono text-[10px] sm:text-[11px] text-gray-400 flex-1 truncate">{new Date(r.started_at).toLocaleString()}</span>
                    <span className={`text-[10px] font-medium px-2 py-[2px] rounded-full shrink-0 ${
                      r.status === "complete" ? "bg-green-50 text-green-600 border border-green-200" :
                      r.status === "failed"   ? "bg-red-50 text-red-600 border border-red-200" :
                                                "bg-blue-50 text-blue-600 border border-blue-200"
                    }`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
