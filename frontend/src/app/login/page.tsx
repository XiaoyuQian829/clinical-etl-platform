"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const COVERAGE = [
  { jd: "ETL / ELT Pipelines",        tools: ["Python", "pandas", "FastAPI"],         note: "3-layer medallion: raw → clean → research" },
  { jd: "EMR / Clinical Data",         tools: ["MIMIC-IV", "FHIR R4"],                note: "Patients · Admissions · Diagnoses" },
  { jd: "SQL + Data Engineering",      tools: ["PostgreSQL", "DBT"],                   note: "22 DBT tests · 109,775 ICD codes joined" },
  { jd: "Databricks",                  tools: ["PySpark", "Delta Lake"],               note: "4 notebooks: bronze → silver → gold",  star: true },
  { jd: "DBT",                         tools: ["dbt-postgres"],                        note: "Schema tests · referential integrity",   star: true },
  { jd: "Power BI",                    tools: ["Power BI", "Parquet"],                 note: "Direct Query + CSV/Parquet export",      star: true },
  { jd: "Python",                      tools: ["FastAPI", "Pydantic", "SQLAlchemy"],   note: "Type-safe pipeline end-to-end" },
  { jd: "Relational DB",               tools: ["PostgreSQL", "RDS"],                   note: "raw / clean / research schemas" },
  { jd: "Non-relational DB",           tools: ["DynamoDB", "boto3"],                   note: "FHIR R4 resource storage" },
  { jd: "Cloud + CI/CD",               tools: ["AWS", "Amplify", "Terraform"],         note: "IaC: VPC · RDS · EC2 · S3" },
  { jd: "Sensitive Data / Governance", tools: ["k-Anon k=5", "RBAC", "Audit Log"],    note: "GDPR-aligned de-identification" },
  { jd: "Healthcare Datasets",         tools: ["MIMIC-IV", "FHIR R4", "ICD-10"],      note: "Gold-standard clinical EMR data",        star: true },
];

function WhyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] px-2 py-[2px] rounded-full text-white" style={{ background: "#51247A" }}>R-63033</span>
            <span className="text-[13px] font-bold text-gray-900">JD Coverage</span>
            <span className="text-[11px] text-gray-400">— UQ Data Engineer</span>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Personal note */}
        <div className="px-5 py-4 border-b border-gray-100 shrink-0 bg-amber-50">
          <p className="text-[12px] text-gray-700 leading-relaxed">
            I built this as a <span className="font-semibold text-gray-900">real, cloud-deployed project</span> specifically for this interview —
            not a toy demo. I wanted to show what I can actually do with a clinical data pipeline,
            so I took open-source EMR data (MIMIC-IV), stood up a full medallion architecture,
            wired in DBT, Databricks, FHIR, Power BI, Terraform, the works — and shipped it to AWS.
            This is what I planned to walk through in the interview room.
          </p>
          <p className="text-[12px] text-gray-700 leading-relaxed mt-2">
            Then HR declined my application. I genuinely have no idea why. 🤷
          </p>
          <p className="text-[12px] leading-relaxed mt-2 font-medium" style={{ color: "#51247A" }}>
            Dr Austin — if you happen to see this, I'd love the chance to walk you through it in person.
            An interview is all I'm asking for.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-100 shrink-0 bg-gray-50">
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="text-green-500 font-bold">✓</span> Covered
          </span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="text-amber-500 text-[9px]">★</span> "Highly regarded" in JD
          </span>
        </div>

        {/* Coverage rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {COVERAGE.map((row) => (
            <div key={row.jd} className="flex items-center gap-3 px-5 py-[10px]">
              {/* check */}
              <span className="text-green-500 font-bold text-[13px] shrink-0">✓</span>

              {/* JD requirement */}
              <div className="w-[150px] shrink-0">
                <span className="text-[12px] font-medium text-gray-800">{row.jd}</span>
                {row.star && <span className="ml-1 text-amber-500 text-[9px]">★</span>}
              </div>

              {/* Tools */}
              <div className="flex flex-wrap gap-1 flex-1">
                {row.tools.map(t => (
                  <span key={t} className="text-[9px] font-mono px-[5px] py-[2px] rounded border border-gray-200 bg-gray-50 text-gray-600">{t}</span>
                ))}
              </div>

              {/* Note */}
              <span className="text-[10px] text-gray-400 shrink-0 hidden sm:block w-[150px] text-right">{row.note}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0 text-center" style={{ background: "#f5f0fb" }}>
          <p className="text-[11px] font-medium" style={{ color: "#51247A" }}>
            {COVERAGE.length}/{COVERAGE.length} requirements covered · 3 "highly regarded" tools included
          </p>
        </div>
      </div>
    </div>
  );
}

// Demo credentials — mirrors the in-memory users in api/middleware/auth.py
const DEMO_USERS: Record<string, { password: string; role: string }> = {
  admin_user:      { password: "admin123",      role: "admin" },
  researcher_user: { password: "researcher123", role: "researcher" },
  viewer_user:     { password: "viewer123",     role: "viewer" },
};

function localDemoLogin(username: string, password: string): boolean {
  const user = DEMO_USERS[username];
  if (!user || user.password !== password) return false;
  // Store a signed-looking mock token so downstream role checks work
  const payload = btoa(JSON.stringify({ sub: username, role: user.role, exp: Date.now() / 1000 + 3600 }));
  localStorage.setItem("access_token", `demo.${payload}.sig`);
  localStorage.setItem("user_role", user.role);
  return true;
}

// Lazy-load QR code only on client to avoid SSR hydration mismatch
import dynamic from "next/dynamic";
const QRCodeSVG = dynamic(() => import("qrcode.react").then(m => m.QRCodeSVG), { ssr: false });

const SITE_URL = "https://master.d31gb4sqbvncbm.amplifyapp.com";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showWhy,  setShowWhy]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(username, password);
      router.push("/");
    } catch {
      // Backend unreachable — fall back to local demo auth so the
      // demo accounts always work regardless of API availability.
      if (localDemoLogin(username, password)) {
        router.push("/");
        return;
      }
      setError("Incorrect username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "#f8f9fb" }}>
      {showWhy && <WhyModal onClose={() => setShowWhy(false)} />}

      {/* ── QR code — fixed top-right ─────────────────────────────── */}
      <div className="fixed top-4 right-4 z-40 flex flex-col items-center gap-2 bg-white rounded-2xl shadow-xl p-4 border border-gray-100">
        <QRCodeSVG value={SITE_URL} size={160} />
        <p className="text-[10px] text-gray-400 text-center leading-snug">Scan to open on mobile</p>
      </div>

      {/* ── Left panel (hidden on small mobile, shown md+) ───────── */}
      <div className="hidden md:flex md:w-[360px] shrink-0 flex-col px-7 py-7 overflow-y-auto" style={{ background: "#51247A" }}>

        {/* Logo */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-4 text-purple-200" fill="none" viewBox="0 0 28 18" stroke="currentColor" strokeWidth={1.8}>
                <polyline strokeLinecap="round" strokeLinejoin="round" points="0,9 5,9 7,6 9,14 11,2 13,14 15,9 19,9 21,7 23,11 25,9 28,9" />
              </svg>
              <span className="text-[15px] font-bold text-white">ClinicalETL</span>
            </div>
            <p className="text-[10px] text-purple-400">UQ Data Engineer · R-63033</p>
          </div>
        </div>

        {/* ── Pipeline flow ── */}
        <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest mb-4 shrink-0">Data Pipeline Architecture</p>

        <div className="flex flex-col">

          {/* ① EMR Source */}
          <div className="rounded-lg px-3 py-[10px]" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <div className="flex items-center gap-2 mb-[5px]">
              <svg className="w-3 h-3 text-purple-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V7l7-4 7 4v12a2 2 0 01-2 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
              </svg>
              <span className="text-[12px] font-bold text-white">EMR Source</span>
              <span className="ml-auto text-[9px] text-purple-400 font-mono">MIMIC-IV v2.2</span>
            </div>
            <p className="text-[9px] mb-[5px]" style={{ color: "#a78bba" }}>100 patients · 29 CSV files · 1,398,531 rows</p>
            <div className="flex flex-wrap gap-1">
              {["patients", "admissions", "chartevents", "labevents", "prescriptions", "+ 24 more"].map(t => (
                <span key={t} className="font-mono text-[8px] px-[5px] py-[2px] rounded" style={{ background: "rgba(255,255,255,0.08)", color: "#c4b5d8" }}>{t}</span>
              ))}
            </div>
          </div>

          {/* connector: S3 + Extract */}
          <div className="flex items-stretch gap-3 py-[6px] pl-[14px]">
            <div className="flex flex-col items-center w-4 shrink-0">
              <div className="w-px flex-1" style={{ background: "rgba(196,181,216,0.35)" }} />
              <div className="w-[5px] h-[5px] rotate-45 border-b border-r" style={{ borderColor: "rgba(196,181,216,0.5)", marginTop: "-3px" }} />
            </div>
            <div className="pb-[2px]">
              <p className="text-[10px] font-semibold text-purple-200">S3 → Extract</p>
              <p className="text-[9px] leading-snug" style={{ color: "#a78bba" }}>s3://clinical-etl-raw-beb9bc88/mimic-iv-demo/raw/</p>
              <p className="text-[9px] leading-snug" style={{ color: "#a78bba" }}>boto3 · pandas · 128 MB uploaded</p>
            </div>
          </div>

          {/* ② Raw Layer */}
          <div className="rounded-lg px-3 py-[10px]" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <div className="flex items-center gap-2 mb-[5px]">
              <svg className="w-3 h-3 text-purple-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 1.657-4.03 3-9 3S3 13.657 3 12" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
              </svg>
              <span className="text-[12px] font-bold text-white">Raw Layer</span>
              <span className="ml-auto font-mono text-[9px] text-purple-400">raw.* · PostgreSQL</span>
            </div>
            <p className="text-[9px] mb-[5px]" style={{ color: "#a78bba" }}>26 tables · append-only · exact source copy</p>
            <div className="flex flex-wrap gap-1">
              {["core ×3", "ref ×4", "hosp ×12", "icu ×7"].map(t => (
                <span key={t} className="font-mono text-[8px] px-[5px] py-[2px] rounded" style={{ background: "rgba(255,255,255,0.08)", color: "#c4b5d8" }}>{t}</span>
              ))}
            </div>
          </div>

          {/* connector: Transform + Validate */}
          <div className="flex items-stretch gap-3 py-[6px] pl-[14px]">
            <div className="flex flex-col items-center w-4 shrink-0">
              <div className="w-px flex-1" style={{ background: "rgba(196,181,216,0.35)" }} />
              <div className="w-[5px] h-[5px] rotate-45 border-b border-r" style={{ borderColor: "rgba(196,181,216,0.5)", marginTop: "-3px" }} />
            </div>
            <div className="pb-[2px]">
              <p className="text-[10px] font-semibold text-purple-200">Transform + Validate</p>
              <p className="text-[9px] leading-snug" style={{ color: "#a78bba" }}>ICD-10 join · 109,775 codes · Pydantic models</p>
              <p className="text-[9px] leading-snug" style={{ color: "#a78bba" }}>22 DBT tests · PASS / WARN / FAIL tagging</p>
            </div>
          </div>

          {/* ③ Clean Layer */}
          <div className="rounded-lg px-3 py-[10px]" style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)" }}>
            <div className="flex items-center gap-2 mb-[5px]">
              <svg className="w-3 h-3 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[12px] font-bold text-white">Clean Layer</span>
              <span className="ml-auto font-mono text-[9px] text-blue-300">clean.*</span>
            </div>
            <p className="text-[9px] mb-[5px]" style={{ color: "#93c5fd" }}>Standardised · validated · 88% PASS rate</p>
            <div className="flex flex-wrap gap-1">
              {["clean.patients", "clean.admissions", "clean.diagnoses"].map(t => (
                <span key={t} className="font-mono text-[8px] px-[5px] py-[2px] rounded" style={{ background: "rgba(96,165,250,0.12)", color: "#93c5fd", border: "1px solid rgba(96,165,250,0.2)" }}>{t}</span>
              ))}
            </div>
          </div>

          {/* connector: De-identify */}
          <div className="flex items-stretch gap-3 py-[6px] pl-[14px]">
            <div className="flex flex-col items-center w-4 shrink-0">
              <div className="w-px flex-1" style={{ background: "rgba(196,181,216,0.35)" }} />
              <div className="w-[5px] h-[5px] rotate-45 border-b border-r" style={{ borderColor: "rgba(196,181,216,0.5)", marginTop: "-3px" }} />
            </div>
            <div className="pb-[2px]">
              <p className="text-[10px] font-semibold text-purple-200">De-identify</p>
              <p className="text-[9px] leading-snug" style={{ color: "#a78bba" }}>k-Anonymity k=5 · SHA-256 subject hash</p>
              <p className="text-[9px] leading-snug" style={{ color: "#a78bba" }}>Age bucketing · postcode → state</p>
            </div>
          </div>

          {/* ④ Research Layer */}
          <div className="rounded-lg px-3 py-[10px]" style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.22)" }}>
            <div className="flex items-center gap-2 mb-[5px]">
              <svg className="w-3 h-3 text-green-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m-4.5 10.5H6a2 2 0 01-2-2v-3a2 2 0 012-2h.5M15 3H9v4l3 2 3-2V3z" />
              </svg>
              <span className="text-[12px] font-bold text-white">Research Layer</span>
              <span className="ml-auto font-mono text-[9px] text-green-300">research.*</span>
            </div>
            <p className="text-[9px] mb-[5px]" style={{ color: "#86efac" }}>De-identified · GDPR-aligned · safe to export</p>
            <div className="flex flex-wrap gap-1">
              {["research.cohort", "research.outcomes"].map(t => (
                <span key={t} className="font-mono text-[8px] px-[5px] py-[2px] rounded" style={{ background: "rgba(34,197,94,0.10)", color: "#86efac", border: "1px solid rgba(34,197,94,0.2)" }}>{t}</span>
              ))}
            </div>
          </div>

          {/* connector: Outputs */}
          <div className="flex items-stretch gap-3 py-[6px] pl-[14px]">
            <div className="flex flex-col items-center w-4 shrink-0">
              <div className="w-px flex-1" style={{ background: "rgba(196,181,216,0.35)" }} />
              <div className="w-[5px] h-[5px] rotate-45 border-b border-r" style={{ borderColor: "rgba(196,181,216,0.5)", marginTop: "-3px" }} />
            </div>
            <div className="pb-[2px]">
              <p className="text-[10px] font-semibold text-purple-200">Governed Output</p>
              <p className="text-[9px] leading-snug" style={{ color: "#a78bba" }}>RBAC · full audit trail · every access logged</p>
            </div>
          </div>

          {/* ⑤ Outputs */}
          <div className="rounded-lg px-3 py-[10px]" style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}>
            <div className="flex items-center gap-2 mb-[6px]">
              <svg className="w-3 h-3 text-purple-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span className="text-[12px] font-bold text-white">Outputs</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {["Power BI", "CSV Export", "FHIR API", "Databricks"].map(t => (
                <span key={t} className="font-mono text-[8px] px-[5px] py-[2px] rounded" style={{ background: "rgba(168,85,247,0.12)", color: "#d8b4fe", border: "1px solid rgba(168,85,247,0.25)" }}>{t}</span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Mobile header ────────────────────────────────────────── */}
      <div className="md:hidden flex items-center gap-3 px-5 py-4" style={{ background: "#51247A" }}>
        <svg className="w-5 h-5 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <div>
          <p className="text-[15px] font-bold text-white">ClinicalETL</p>
          <p className="text-[9px] text-purple-400">UQ Data Engineer Interview</p>
        </div>
      </div>

      {/* ── Right panel / login form ─────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-5 md:px-16 py-8">
        <div className="w-full max-w-sm">
          <h2 className="text-[22px] font-bold text-gray-900 mb-1">Sign in</h2>
          <p className="text-[13px] text-gray-400 mb-8">Clinical data governance platform</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="admin_user"
                className="w-full border border-gray-200 rounded-[5px] px-3 py-[9px] text-[13px] focus:outline-none focus:border-[#51247A] bg-[#f8f9fb]"
                required />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-[5px] px-3 py-[9px] text-[13px] focus:outline-none focus:border-[#51247A] bg-[#f8f9fb]"
                required />
            </div>

            {error && <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-[10px] rounded-[5px] text-[13px] font-medium text-white disabled:opacity-50 mt-1"
              style={{ background: "#51247A" }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 relative">
            {/* pulse ring */}
            <span className="absolute inset-0 rounded-[5px] animate-ping opacity-30 pointer-events-none" style={{ background: "#c4b5d8" }} />
            <button onClick={() => setShowWhy(true)}
              className="relative w-full flex items-center justify-center gap-2 py-[9px] rounded-[5px] text-[12px] font-medium border transition-colors hover:border-[#51247A]"
              style={{ color: "#51247A", borderColor: "#c4b5d8", background: "#f5f0fb" }}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Why this Project?
              <span className="ml-1 text-[10px] text-purple-400">↗ click</span>
            </button>
          </div>

          <div className="mt-5 border-t border-gray-200 pt-5">
            <p className="text-[11px] text-gray-400 mb-2">Demo accounts</p>
            <div className="flex flex-col gap-[6px]">
              {[["admin_user","admin123","admin — full access"],["researcher_user","researcher123","researcher — data + export"],["viewer_user","viewer123","viewer — read only"]].map(([u, p, desc]) => (
                <button key={u} onClick={() => { setUsername(u); setPassword(p); }}
                  className="flex items-center gap-2 text-left px-3 py-[7px] rounded bg-[#f8f9fb] border border-gray-200 hover:border-[#51247A] transition-colors group">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: "#51247A" }}>
                    {u[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-gray-700 group-hover:text-[#51247A]">{u}</p>
                    <p className="text-[10px] text-gray-400">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
