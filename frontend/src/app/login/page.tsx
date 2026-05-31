"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(username, password);
      router.push("/");
    } catch {
      setError("Incorrect username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#f8f9fb" }}>
      {/* Left panel */}
      <div className="w-[340px] shrink-0 flex flex-col justify-between p-10" style={{ background: "#51247A" }}>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-[16px] font-bold text-white">ClinicalETL</span>
          </div>
          <p className="text-[11px] text-purple-400 leading-relaxed">UQ Data Engineer Interview</p>
        </div>

        <div>
          <p className="text-[13px] font-semibold text-purple-100 mb-3">Platform capabilities</p>
          <div className="flex flex-col gap-[10px]">
            {[
              ["raw → clean → research", "Three-layer medallion architecture"],
              ["109,775 ICD codes", "Full diagnosis description mapping"],
              ["22 DBT tests", "Automated data quality enforcement"],
              ["k-Anonymity (k=5)", "GDPR-aligned de-identification"],
              ["Full audit trail", "Every access logged with outcome"],
            ].map(([title, desc]) => (
              <div key={title} className="flex items-start gap-[10px]">
                <span className="w-[6px] h-[6px] rounded-full bg-purple-400 mt-[5px] shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-purple-100">{title}</p>
                  <p className="text-[10px] text-purple-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[9px] text-purple-500">UQ Data Engineer · R-63033</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-16">
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

          <div className="mt-8 border-t border-gray-200 pt-5">
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
