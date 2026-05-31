"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import FlowStrip from "@/components/FlowStrip";
import RBACGuard from "@/components/RBACGuard";
import { api } from "@/lib/api";

const ACTION_LABELS: Record<string, string> = {
  pipeline_run:      "Pipeline run",
  export_requested:  "Export requested",
  export_downloaded: "Export downloaded",
  data_read:         "Data accessed",
};

const ACTION_OPTIONS = [
  { value: "pipeline_run",      label: "Pipeline run" },
  { value: "export_requested",  label: "Export requested" },
  { value: "export_downloaded", label: "Export downloaded" },
  { value: "data_read",         label: "Data accessed" },
];

const ROLE_STYLE: Record<string, string> = {
  admin:      "bg-purple-50 text-[#51247A]",
  researcher: "bg-blue-50 text-blue-700",
  viewer:     "bg-gray-100 text-gray-500",
};

const OUTCOME_STYLE: Record<string, string> = {
  approved: "bg-green-50 text-green-700 border border-green-200",
  denied:   "bg-red-50 text-red-700 border border-red-200",
  error:    "bg-amber-50 text-amber-700 border border-amber-200",
};

export default function AuditPage() {
  const router = useRouter();
  const [logs,    setLogs]    = useState<any[]>([]);
  const [action,  setAction]  = useState("");
  const [userId,  setUserId]  = useState("");
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 200 };
      if (action) params.action  = action;
      if (userId) params.user_id = userId;
      const res = await api.getAuditLogs(params);
      setLogs(res.data?.logs ?? []);
    } catch { router.push("/login"); }
    finally { setLoading(false); }
  }, [action, userId, router]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <RBACGuard requiredRole="admin">
      <AppLayout>
        <div className="flex items-center justify-between px-4 sm:px-7 py-3 sm:py-4 bg-white border-b border-gray-200">
          <div>
            <h1 className="text-[16px] sm:text-[18px] font-bold text-gray-900">Audit Log</h1>
            <p className="text-[11px] sm:text-[12px] text-gray-400 mt-0.5 hidden sm:block">Every data access and pipeline action — who, what, when.</p>
          </div>
          <div className="flex items-center gap-[5px] px-[10px] sm:px-[12px] py-[5px] sm:py-[6px] bg-[#f8f9fb] border border-gray-200 rounded-[5px]">
            <span className="w-[6px] h-[6px] rounded-full bg-green-500 inline-block" />
            <span className="font-mono text-[10px] sm:text-[11px] text-gray-400">{logs.length} entries</span>
          </div>
        </div>

        <FlowStrip />

        {/* Filters */}
        <div className="flex items-center gap-2 px-4 sm:px-7 py-[8px] bg-white border-b border-gray-200 overflow-x-auto">
          <span className="text-[10px] font-semibold text-gray-400 shrink-0">Filter:</span>
          <select value={action} onChange={e => setAction(e.target.value)}
            className="border border-gray-200 rounded-[5px] px-2 py-[5px] text-[11px] text-gray-600 bg-[#f8f9fb] focus:outline-none focus:border-[#51247A] shrink-0">
            <option value="">All actions</option>
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input value={userId} onChange={e => setUserId(e.target.value)}
            placeholder="User ID…"
            className="border border-gray-200 rounded-[5px] px-2 py-[5px] text-[11px] text-gray-600 bg-[#f8f9fb] w-[120px] sm:w-[160px] focus:outline-none focus:border-[#51247A] shrink-0" />
          <button onClick={fetchLogs}
            className="px-[10px] sm:px-[14px] py-[5px] sm:py-[6px] rounded-[5px] text-[11px] sm:text-[12px] font-medium text-white shrink-0"
            style={{ background: "#51247A" }}>Apply</button>
          {(action || userId) && (
            <button onClick={() => { setAction(""); setUserId(""); }}
              className="text-[11px] text-red-400 hover:text-red-600 shrink-0">Clear</button>
          )}
        </div>

        {/* Table — horizontal scroll on mobile */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No audit entries found.</div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-[#f8f9fb] border-b border-gray-200 sticky top-0">
                  <tr>
                    {["Timestamp","User","Role","Action","Resource","Outcome"].map(h => (
                      <th key={h} className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                        <span className="font-mono text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, ri) => (
                    <tr key={log.id} className={ri % 2 === 1 ? "bg-[#f8f9fb]" : "bg-white"}>
                      <td className="px-3 sm:px-4 py-[7px] border-b border-gray-100">
                        <span className="font-mono text-[9px] sm:text-[11px] text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-[7px] border-b border-gray-100">
                        <span className="text-[11px] sm:text-[12px] font-medium text-gray-800 whitespace-nowrap">{log.user_id}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-[7px] border-b border-gray-100">
                        <span className={`text-[9px] sm:text-[10px] font-medium px-2 py-[2px] rounded-full whitespace-nowrap ${ROLE_STYLE[log.role] ?? "bg-gray-100 text-gray-500"}`}>
                          {log.role}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-[7px] border-b border-gray-100">
                        <span className="text-[11px] sm:text-[12px] text-gray-700 whitespace-nowrap">{ACTION_LABELS[log.action] ?? log.action}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-[7px] border-b border-gray-100">
                        <span className="font-mono text-[10px] sm:text-[11px] text-gray-500 whitespace-nowrap">{log.resource}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-[7px] border-b border-gray-100">
                        <span className={`text-[9px] sm:text-[10px] font-medium px-2 py-[2px] rounded-full whitespace-nowrap ${OUTCOME_STYLE[log.outcome] ?? ""}`}>
                          {log.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
