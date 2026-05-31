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

const COLS = [
  { label: "Timestamp",   cls: "w-[160px]" },
  { label: "User",        cls: "w-[130px]" },
  { label: "Role",        cls: "w-[100px]" },
  { label: "Action",      cls: "flex-1" },
  { label: "Resource",    cls: "flex-1 font-mono" },
  { label: "IP Address",  cls: "w-[115px]" },
  { label: "Outcome",     cls: "w-[90px]" },
];

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
        {/* Top bar */}
        <div className="flex items-center justify-between px-7 py-4 bg-white border-b border-gray-200">
          <div>
            <h1 className="text-[18px] font-bold text-gray-900">Audit Log</h1>
            <p className="text-[12px] text-gray-400 mt-0.5">Every data access and pipeline action is recorded — who, what, when, approved or denied.</p>
          </div>
          <div className="flex items-center gap-[5px] px-[12px] py-[6px] bg-[#f8f9fb] border border-gray-200 rounded-[5px]">
            <span className="w-[6px] h-[6px] rounded-full bg-green-500 inline-block" />
            <span className="font-mono text-[11px] text-gray-400">{logs.length} entries</span>
          </div>
        </div>

        <FlowStrip />

        {/* Filters */}
        <div className="flex items-center gap-[10px] px-7 py-[10px] bg-white border-b border-gray-200">
          <span className="text-[11px] font-semibold text-gray-400">Filter:</span>
          <select value={action} onChange={e => setAction(e.target.value)}
            className="border border-gray-200 rounded-[5px] px-3 py-[6px] text-[12px] text-gray-600 bg-[#f8f9fb] w-[200px] focus:outline-none focus:border-[#51247A]">
            <option value="">All actions</option>
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input value={userId} onChange={e => setUserId(e.target.value)}
            placeholder="Filter by user ID…"
            className="border border-gray-200 rounded-[5px] px-3 py-[6px] text-[12px] text-gray-600 bg-[#f8f9fb] w-[180px] focus:outline-none focus:border-[#51247A]" />
          <button onClick={fetchLogs}
            className="px-[14px] py-[6px] rounded-[5px] text-[12px] font-medium text-white"
            style={{ background: "#51247A" }}>
            Apply
          </button>
          {(action || userId) && (
            <button onClick={() => { setAction(""); setUserId(""); }}
              className="text-[11px] text-red-400 hover:text-red-600">
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Header */}
          <div className="flex px-7 bg-[#f8f9fb] border-b border-gray-200">
            {COLS.map(c => (
              <div key={c.label} className={`${c.cls} py-2 pr-4`}>
                <span className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-wide">{c.label}</span>
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No audit entries found{(action || userId) ? " — try clearing the filters." : "."}</div>
            ) : (
              logs.map((log, ri) => (
                <div key={log.id} className={`flex items-center px-7 border-b border-gray-100 ${ri % 2 === 1 ? "bg-[#f8f9fb]" : "bg-white"}`}>
                  <div className="w-[160px] py-[9px] pr-4">
                    <span className="font-mono text-[11px] text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="w-[130px] py-[9px] pr-4">
                    <span className="text-[12px] font-medium text-gray-800">{log.user_id}</span>
                  </div>
                  <div className="w-[100px] py-[9px] pr-4">
                    <span className={`text-[10px] font-medium px-2 py-[2px] rounded-full ${ROLE_STYLE[log.role] ?? "bg-gray-100 text-gray-500"}`}>
                      {log.role}
                    </span>
                  </div>
                  <div className="flex-1 py-[9px] pr-4">
                    <span className="text-[12px] text-gray-700">{ACTION_LABELS[log.action] ?? log.action}</span>
                  </div>
                  <div className="flex-1 py-[9px] pr-4">
                    <span className="font-mono text-[11px] text-gray-500">{log.resource}</span>
                  </div>
                  <div className="w-[115px] py-[9px] pr-4">
                    <span className="font-mono text-[11px] text-gray-400">{log.ip_address}</span>
                  </div>
                  <div className="w-[90px] py-[9px]">
                    <span className={`text-[10px] font-medium px-2 py-[2px] rounded-full ${OUTCOME_STYLE[log.outcome] ?? ""}`}>
                      {log.outcome}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
