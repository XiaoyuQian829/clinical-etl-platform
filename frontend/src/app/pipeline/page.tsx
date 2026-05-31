"use client";
import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import FlowStrip from "@/components/FlowStrip";
import RBACGuard from "@/components/RBACGuard";
import { api } from "@/lib/api";

const STEPS = [
  { key: "extract",   label: "Extract",   desc: "Read raw CSV files",                detail: "patients · admissions · diagnoses" },
  { key: "transform", label: "Transform", desc: "Standardise and clean fields",       detail: "gender · los_days · ICD lookup" },
  { key: "validate",  label: "Validate",  desc: "Pydantic schema enforcement",        detail: "types · ranges · constraints" },
  { key: "load",      label: "Load",      desc: "Write to PostgreSQL",                detail: "raw.* + clean.*" },
  { key: "dbt",       label: "DBT",       desc: "Refresh research layer",             detail: "research.cohort · outcomes" },
];

function StepCard({ step, status }: { step: typeof STEPS[0]; status?: string }) {
  const isDone    = status === "complete";
  const isRunning = status === "running";
  const isFailed  = status === "failed";

  return (
    <div className={`flex-1 min-w-[120px] rounded-md border p-3 sm:p-4 flex flex-col items-center gap-2 text-center transition-all ${
      isDone    ? "border-green-200 bg-green-50" :
      isRunning ? "border-blue-200 bg-blue-50 animate-pulse" :
      isFailed  ? "border-red-200 bg-red-50" :
                  "border-gray-200 bg-white"
    }`}>
      <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-md flex items-center justify-center border ${
        isDone    ? "border-green-300 bg-white" :
        isRunning ? "border-blue-300 bg-white" :
                    "border-gray-200 bg-[#f8f9fb]"
      }`}>
        {isDone    && <span className="text-green-600 text-xs font-bold">✓</span>}
        {isRunning && <span className="text-blue-500 text-xs">●</span>}
        {isFailed  && <span className="text-red-500 text-xs font-bold">✗</span>}
        {!status   && <span className="text-gray-300 text-xs">○</span>}
      </div>
      <p className={`text-[12px] sm:text-[13px] font-bold ${isDone ? "text-gray-900" : "text-gray-600"}`}>{step.label}</p>
      <p className="text-[10px] sm:text-[11px] text-gray-600 leading-relaxed hidden sm:block">{step.desc}</p>
      <p className="font-mono text-[9px] text-gray-400 leading-relaxed hidden sm:block">{step.detail}</p>
      {isDone && (
        <span className="text-[9px] sm:text-[10px] font-medium text-green-600 bg-green-100 border border-green-200 rounded-full px-2 py-[2px]">done</span>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const [running, setRunning] = useState(false);
  const [runId,   setRunId]   = useState<string | null>(null);
  const [status,  setStatus]  = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function triggerPipeline() {
    setRunning(true);
    setStatus(null);
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
    } catch { setRunning(false); }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const allDone = status?.status === "complete";

  return (
    <RBACGuard requiredRole="admin">
      <AppLayout>
        <div className="flex items-center justify-between px-4 sm:px-7 py-3 sm:py-4 bg-white border-b border-gray-200">
          <div>
            <h1 className="text-[16px] sm:text-[18px] font-bold text-gray-900">ETL Pipeline</h1>
            <p className="text-[11px] sm:text-[12px] text-gray-400 mt-0.5 hidden sm:block">Ingest raw MIMIC-IV data, clean, validate, refresh research layer.</p>
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

        <div className="flex flex-col gap-4 sm:gap-5 p-4 sm:p-7 overflow-y-auto">
          {/* Steps — horizontal scroll on mobile */}
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1">
            {STEPS.map(s => <StepCard key={s.key} step={s} status={status?.steps?.[s.key]} />)}
          </div>

          {allDone && status?.records && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[["patients","patients"], ["admissions","admissions"], ["diagnoses","diagnoses"]].map(([k, lbl]) => (
                <div key={k} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-white border border-green-200 rounded-md px-3 sm:px-[18px] py-3 sm:py-[14px]">
                  <span className="font-mono text-[18px] sm:text-[22px] font-bold text-green-600">{(status.records[k] ?? 0).toLocaleString()}</span>
                  <span className="text-[10px] sm:text-[12px] text-gray-400">{lbl}</span>
                </div>
              ))}
            </div>
          )}

          {history.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="px-4 py-[11px] border-b border-gray-200">
                <span className="text-[12px] font-semibold text-gray-900">Run History</span>
              </div>
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
          )}
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
