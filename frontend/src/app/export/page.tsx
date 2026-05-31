"use client";
import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import FlowStrip from "@/components/FlowStrip";
import RBACGuard from "@/components/RBACGuard";
import { api } from "@/lib/api";

const DE_ID_STEPS = [
  { n: "1", label: "Remove direct identifiers",       detail: "subject_id → SHA-256 anonymised_id  ·  name · DOB · MRN removed" },
  { n: "2", label: "Generalise quasi-identifiers",    detail: "Postcode → region  ·  los_days rounded to nearest 0.5" },
  { n: "3", label: "k-Anonymity suppression (k=5)",   detail: "Groups of < 5 records by (age_band, gender, admission_type) are suppressed" },
];

const CSV_COLS = [
  ["cohort_id",              "Anonymous row number — subject_id never included"],
  ["age_band",               "PAEDIATRIC / YOUNG_ADULT / ADULT / ELDERLY"],
  ["gender",                 "M / F / UNKNOWN"],
  ["admission_type",         "e.g. EMERGENCY, URGENT, PLANNED"],
  ["los_days",               "Length of stay, rounded to 1 decimal"],
  ["primary_diagnosis_code", "ICD-9 or ICD-10 code"],
  ["primary_diagnosis_desc", "Full diagnosis description"],
  ["is_deidentified",        "Always true"],
];

export default function ExportPage() {
  const [exports,    setExports]    = useState<any[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [message,    setMessage]    = useState<{ text: string; ok: boolean } | null>(null);

  async function requestExport() {
    setRequesting(true);
    setMessage(null);
    try {
      const res = await api.requestExport();
      const exp = res.data;
      setExports(e => [{ ...exp, created_at: new Date().toISOString() }, ...e]);
      setMessage({ text: `Export ready — ${exp.records} records, ${exp.records + 1} lines (inc. header).`, ok: true });
    } catch (e: any) {
      setMessage({ text: e.response?.data?.detail || "Export failed.", ok: false });
    } finally { setRequesting(false); }
  }

  async function download(exportId: string) {
    try { await api.downloadExport(exportId); }
    catch { setMessage({ text: "Download failed — check your role permissions.", ok: false }); }
  }

  return (
    <RBACGuard requiredRole="researcher">
      <AppLayout>
        {/* Top bar */}
        <div className="px-7 py-4 bg-white border-b border-gray-200">
          <h1 className="text-[18px] font-bold text-gray-900">Research Export</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Generate a de-identified CSV from <span className="font-mono text-[11px] bg-green-50 text-green-700 border border-green-200 rounded px-1">research.cohort</span>. No patient identifiers included.
          </p>
        </div>

        <FlowStrip active="research" />

        <div className="flex gap-5 p-7 overflow-y-auto">
          {/* Left col */}
          <div className="flex-1 flex flex-col gap-4">
            {/* De-identification steps */}
            <div className="bg-white border border-gray-200 rounded-md p-5 flex flex-col gap-4">
              <p className="text-[13px] font-semibold text-gray-900">De-identification pipeline applied to every export</p>
              {DE_ID_STEPS.map(({ n, label, detail }) => (
                <div key={n} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-blue-600">{n}</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-gray-800">{label}</p>
                    <p className="text-[11px] text-gray-400 mt-[2px] font-mono">{detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Request */}
            <div className="bg-white border border-gray-200 rounded-md p-5 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">Generate export</p>
                <p className="text-[11px] text-gray-400 mt-[2px]">Queries research.cohort, applies de-identification, saves CSV</p>
              </div>
              <button onClick={requestExport} disabled={requesting}
                className="flex items-center gap-[6px] px-[14px] py-2 rounded-[5px] text-[12px] font-medium text-white disabled:opacity-50 shrink-0"
                style={{ background: "#51247A" }}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {requesting ? "Generating…" : "Request Export"}
              </button>
            </div>

            {message && (
              <div className={`rounded-md px-4 py-3 text-[13px] ${message.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {message.text}
              </div>
            )}

            {/* History */}
            {exports.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                <div className="px-4 py-[11px] border-b border-gray-200">
                  <span className="text-[12px] font-semibold text-gray-900">Export History</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {exports.map(e => (
                    <div key={e.export_id} className="flex items-center gap-4 px-4 py-[10px]">
                      <span className="font-mono text-[11px] text-gray-400 w-[90px]">{e.export_id}</span>
                      <span className="text-[12px] text-gray-600 flex-1">{e.records?.toLocaleString()} rows</span>
                      <span className="text-[11px] text-gray-400">{new Date(e.created_at).toLocaleString()}</span>
                      <button onClick={() => download(e.export_id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download CSV
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right col — CSV columns */}
          <div className="w-[300px] shrink-0 bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="px-4 py-[11px] border-b border-gray-200">
              <span className="text-[12px] font-semibold text-gray-900">CSV columns in exported file</span>
            </div>
            <div className="p-4 flex flex-col gap-[10px]">
              {CSV_COLS.map(([col, note]) => (
                <div key={col}>
                  <p className="font-mono text-[11px] font-semibold text-gray-800">{col}</p>
                  <p className="text-[10px] text-gray-400 mt-[2px] leading-relaxed">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
