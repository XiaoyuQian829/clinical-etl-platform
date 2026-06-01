import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  Object.assign(config.headers, getAuthHeaders());
  return config;
});

client.interceptors.response.use(
  (res) => { console.log(`[api] ${res.config.method?.toUpperCase()} ${res.config.url} →`, res.data); return res; },
  (err) => { console.error(`[api] error:`, err.response?.data || err.message); return Promise.reject(err); }
);

export { client };

export const api = {
  async get(path: string) { return client.get(path); },
  async login(username: string, password: string) {
    const form = new URLSearchParams({ username, password });
    const res = await client.post("/auth/token", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const { access_token, role } = res.data;
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("user_role", role);
    return res.data;
  },

  logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
  },

  getRole(): string | null {
    return typeof window !== "undefined" ? localStorage.getItem("user_role") : null;
  },

  async health() {
    return (await client.get("/health")).data;
  },

  async runPipeline() {
    return (await client.post("/pipeline/run")).data;
  },

  async getPipelineStatus(runId: string) {
    return (await client.get(`/pipeline/status/${runId}`)).data;
  },

  async getCleanPatients(limit = 50, offset = 0) {
    return (await client.get("/data/clean/patients", { params: { limit, offset } })).data;
  },

  async getResearchCohort(params: Record<string, unknown> = {}) {
    return (await client.get("/data/research/cohort", { params })).data;
  },

  async requestExport() {
    return (await client.post("/export/request")).data;
  },

  async downloadExport(exportId: string) {
    const res = await client.get(`/export/download/${exportId}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${exportId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async getAuditLogs(params: Record<string, unknown> = {}) {
    return (await client.get("/audit/logs", { params })).data;
  },
};
