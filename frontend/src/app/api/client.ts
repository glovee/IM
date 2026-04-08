// ============================================================
// API Client — Incident Management
// REST + WebSocket
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

// ============================================================
// Types
// ============================================================

export interface ApiIncidentBrief {
  id: string;
  title: string;
  host: string;
  login: string;
  date: string;
  priority: string | null;
  status_name: string | null;
  type_name: string | null;
  source_name: string | null;
  assignee_name: string | null;
  team_name: string | null;
  created_at: string;
}

export interface ApiIncidentFull {
  id: string;
  title: string;
  host: string;
  login: string;
  date: string;
  source_id: string;
  status_id: string;
  incident_type_id: string | null;
  assignee_id: string | null;
  team_id: string | null;
  priority: string | null;
  detected_at: string | null;
  description: string | null;
  response_time: number | null;
  needs_escalation: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status_name: string | null;
  type_name: string | null;
  type_code: string | null;
  source_name: string | null;
  assignee_name: string | null;
  team_name: string | null;
  affected_systems: { id: string; name: string; display_name: string }[];
  files: { id: string; file_name: string; file_path: string | null; file_size: number | null; mime_type: string | null; uploaded_at: string }[];
  investigation_entries: any[];
}

export interface ApiDictItem {
  id: string;
  name: string;
  display_name: string;
  [key: string]: any;
}

// ============================================================
// REST helpers
// ============================================================

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  return res.json();
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

async function apiPut<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// ============================================================
// API exports
// ============================================================

export const incidentsApi = {
  list: () => apiFetch<ApiIncidentBrief[]>('/api/incidents'),
  get: (id: string) => apiFetch<ApiIncidentFull>(`/api/incidents/${id}`),
  create: (data: any) => apiPost<ApiIncidentFull>('/api/incidents', data),
  update: (id: string, data: any) => apiPut<ApiIncidentFull>(`/api/incidents/${id}`, data),
  delete: (id: string) => apiDelete<{ message: string }>(`/api/incidents/${id}`),
};

export const dictApi = {
  sources: () => apiFetch<ApiDictItem[]>('/api/dict/sources'),
  statuses: () => apiFetch<ApiDictItem[]>('/api/dict/statuses'),
  types: () => apiFetch<ApiDictItem[]>('/api/dict/types'),
  teams: () => apiFetch<ApiDictItem[]>('/api/dict/teams'),
  users: () => apiFetch<ApiDictItem[]>('/api/dict/users'),
  affectedSystems: () => apiFetch<ApiDictItem[]>('/api/dict/affected-systems'),
};

export const teamsApi = {
  list: () => apiFetch<any[]>('/api/teams'),
  create: (data: any) => apiPost<any>('/api/teams', data),
  update: (id: string, data: any) => apiPut<any>(`/api/teams/${id}`, data),
  delete: (id: string) => apiDelete<{ message: string }>(`/api/teams/${id}`),
};

export const incidentTypesApi = {
  list: () => apiFetch<any[]>('/api/incident-types'),
  create: (data: any) => apiPost<any>('/api/incident-types', data),
  update: (id: string, data: any) => apiPut<any>(`/api/incident-types/${id}`, data),
  delete: (id: string) => apiDelete<{ message: string }>(`/api/incident-types/${id}`),
};

export const notificationsApi = {
  list: (userId: string) => apiFetch<any[]>(`/api/notifications?user_id=${userId}`),
  markRead: (id: string) => apiPut<any>(`/api/notifications/${id}/read`, {}),
  markAllRead: (userId: string) => apiPut<{ message: string }>(`/api/notifications/read-all?user_id=${userId}`, {}),
};

export const exportApi = {
  incidentsCsv: () => `${API_BASE}/api/export/incidents-csv`,
  incidentFiles: (incidentId: string) => `${API_BASE}/api/export/incidents/${incidentId}/files`,
  incidentCard: (incidentId: string) => `${API_BASE}/api/export/incidents/${incidentId}/card`,
  byViolator: (login: string) => `${API_BASE}/api/export/by-violator?login=${encodeURIComponent(login)}`,
};

export const filesApi = {
  upload: async (incidentId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/incidents/${incidentId}/files`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload error: ${res.status}`);
    return res.json();
  },
  download: (incidentId: string, fileId: string) => `${API_BASE}/api/incidents/${incidentId}/files/${fileId}`,
  delete: async (incidentId: string, fileId: string) => {
    const res = await fetch(`${API_BASE}/api/incidents/${incidentId}/files/${fileId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete file error: ${res.status}`);
    return res.json();
  },
};

// ============================================================
// Mapping
// ============================================================

const PRIORITY_MAP: Record<string, string> = {
  critical: 'Критический',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

export function apiBriefToIncident(b: ApiIncidentBrief): import('../types/incident.ts').Incident {
  return {
    id: b.id,
    название: b.title,
    ответственный: b.assignee_name || '',
    источник: b.source_name || '',
    хост: b.host,
    списокФайлов: [],
    login: b.login,
    команда: b.team_name || '',
    статус: b.status_name || '',
    дата: formatDateTime(b.date),
    типИнцидента: mapTypeCode(b.type_name),
    дополнительныеПоля: b.priority ? { priority: PRIORITY_MAP[b.priority] || b.priority } : {},
  };
}

export function apiFullToIncident(b: ApiIncidentFull): import('../types/incident.ts').Incident {
  const extra: Record<string, string> = {};
  if (b.priority) extra.priority = PRIORITY_MAP[b.priority] || b.priority;
  if (b.detected_at) extra.detected_at = formatDateTime(b.detected_at);
  if (b.description) extra.description = b.description;
  if (b.response_time != null) extra.response_time = String(b.response_time);
  extra.needs_escalation = b.needs_escalation ? 'true' : 'false';
  if (b.affected_systems.length > 0) {
    extra.affected_systems = b.affected_systems.map(s => s.display_name).join(',');
  }

  return {
    id: b.id,
    название: b.title,
    ответственный: b.assignee_name || '',
    источник: b.source_name || '',
    хост: b.host,
    списокФайлов: b.files.map(f => f.file_name),
    login: b.login,
    команда: b.team_name || '',
    статус: b.status_name || '',
    дата: formatDateTime(b.date),
    типИнцидента: mapTypeCode(b.type_code),
    дополнительныеПоля: extra,
  };
}

function formatDateTime(iso: string): string {
  return iso.replace('T', ' ').substring(0, 16);
}

function mapTypeCode(typeName: string | null | undefined): import('../types/incident.ts').IncidentTypeId {
  if (!typeName) return 'security';
  const lower = typeName.toLowerCase();
  if (lower.includes('безопасн') || lower.includes('security')) return 'security';
  if (lower === 'dlp') return 'dlp';
  if (lower.includes('сет') || lower.includes('network')) return 'network';
  if (lower.includes('вредонос') || lower.includes('malware') || lower.includes('по')) return 'malware';
  return 'security';
}

// ============================================================
// WebSocket client
// ============================================================

type WsCallback = (data: any) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<WsCallback>> = new Map();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const cbs = this.listeners.get(msg.type);
        if (cbs) for (const cb of cbs) cb(msg.data);
        const allCbs = this.listeners.get('*');
        if (allCbs) for (const cb of allCbs) cb(msg);
      } catch (e) {
        console.warn('[WS] Parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.warn('[WS] Disconnected, reconnecting...');
      this.ws = null;
      this.reconnectAttempts++;
      const delay = Math.min(3000 * this.reconnectAttempts, 30000);
      this.reconnectTimer = window.setTimeout(() => {
        this.connect();
        const cbs = this.listeners.get('ws_reconnected');
        if (cbs) for (const cb of cbs) cb(null);
      }, delay);
    };

    this.ws.onerror = (err) => console.error('[WS] Error:', err);
  }

  on(type: string, callback: WsCallback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(callback);
  }

  off(type: string, callback: WsCallback) {
    this.listeners.get(type)?.delete(callback);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
  }
}

export const wsClient = new WsClient();
