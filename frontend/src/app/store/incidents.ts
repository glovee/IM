import { create } from 'zustand';
import { Incident } from '../types/incident.ts';
import {
  incidentsApi,
  wsClient,
  apiBriefToIncident,
  apiFullToIncident,
  ApiIncidentFull,
  dictApi,
} from '../api/client.ts';

// ============================================================
// Кэш справочников для resolve display_name → id
// ============================================================

let sourcesCache: { id: string; display_name: string }[] | null = null;
let statusesCache: { id: string; display_name: string }[] | null = null;
let teamsCache: { id: string; name: string }[] | null = null;
let usersCache: { id: string; display_name: string }[] | null = null;

async function resolveStatusId(nameOrId: string): Promise<string> {
  if (nameOrId.includes('-')) return nameOrId;
  if (!statusesCache) {
    const statuses = await dictApi.statuses();
    statusesCache = statuses.map((s: any) => ({ id: s.id, display_name: s.display_name }));
  }
  const found = statusesCache.find((s) => s.display_name === nameOrId);
  return found?.id || nameOrId;
}

async function resolveSourceId(nameOrId: string): Promise<string> {
  if (nameOrId.includes('-')) return nameOrId;
  if (!sourcesCache) {
    const sources = await dictApi.sources();
    sourcesCache = sources.map((s: any) => ({ id: s.id, display_name: s.display_name }));
  }
  const found = sourcesCache.find((s) => s.display_name === nameOrId);
  return found?.id || nameOrId;
}

async function resolveTeamId(nameOrId: string): Promise<string> {
  if (nameOrId.includes('-')) return nameOrId;
  if (!teamsCache) {
    const teams = await dictApi.teams();
    teamsCache = teams.map((t: any) => ({ id: t.id, name: t.name }));
  }
  const found = teamsCache.find((t) => t.name === nameOrId);
  return found?.id || nameOrId;
}

async function resolveUserId(nameOrId: string): Promise<string> {
  if (nameOrId.includes('-')) return nameOrId;
  if (!usersCache) {
    const users = await dictApi.users();
    usersCache = users.map((u: any) => ({ id: u.id, display_name: u.display_name }));
  }
  const found = usersCache.find((u) => u.display_name === nameOrId);
  return found?.id || nameOrId;
}

function formatDateForApi(dateStr: string): string {
  // "2026-03-26 10:30" → "2026-03-26T10:30:00Z"
  if (!dateStr) return dateStr;
  if (dateStr.includes('T')) return dateStr;
  const [date, time] = dateStr.split(' ');
  return time ? `${date}T${time}:00Z` : `${date}T00:00:00Z`;
}

interface IncidentsState {
  incidents: Incident[];
  loading: boolean;
  error: string | null;

  // API actions
  fetchIncidents: () => Promise<void>;
  updateIncident: (incidentId: string, updates: Partial<Incident>) => Promise<void>;
  addIncident: (incident: Incident) => Promise<ApiIncidentFull>;
  deleteIncident: (incidentId: string) => Promise<void>;

  // WebSocket handlers
  _handleCreated: (data: ApiIncidentFull) => void;
  _handleUpdated: (data: ApiIncidentFull) => void;
  _handleDeleted: (data: { id: string }) => void;
}

export const useIncidentsStore = create<IncidentsState>()((set, get) => ({
  incidents: [],
  loading: false,
  error: null,

  fetchIncidents: async () => {
    set({ loading: true, error: null });
    try {
      const briefs = await incidentsApi.list();
      const incidents = briefs.map(apiBriefToIncident);
      set({ incidents, loading: false });
    } catch (e: any) {
      console.error('[Incidents] Fetch error:', e);
      set({ error: e.message, loading: false, incidents: [] });
    }
  },

  updateIncident: async (incidentId, updates) => {
    try {
      const KEY_MAP: Record<string, string> = {
        'название': 'title',
        'ответственный': 'assignee_id',
        'источник': 'source_id',
        'хост': 'host',
        'login': 'login',
        'статус': 'status_id',
        'дата': 'date',
        'команда': 'team_id',
        'типИнцидента': 'incident_type_id',
        'дополнительныеПоля': '_additional',
      };

      const mapped: Record<string, any> = {};

      for (const [key, value] of Object.entries(updates)) {
        const engKey = KEY_MAP[key];
        if (engKey === '_additional') {
          if (value && typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) {
              if (k === 'priority') {
                const revPriority: Record<string, string> = {
                  'Критический': 'critical',
                  'Высокий': 'high',
                  'Средний': 'medium',
                  'Низкий': 'low',
                };
                mapped.priority = revPriority[v as string] || v;
              } else if (k === 'description') {
                mapped.description = v;
              } else if (k === 'detected_at') {
                mapped.detected_at = v;
              } else if (k === 'response_time') {
                mapped.response_time = parseInt(v as string) || null;
              } else if (k === 'needs_escalation') {
                mapped.needs_escalation = v === 'true';
              }
            }
          }
        } else if (engKey === 'status_id') {
          mapped.status_id = await resolveStatusId(value as string);
        } else if (engKey === 'source_id') {
          mapped.source_id = await resolveSourceId(value as string);
        } else if (engKey === 'team_id') {
          mapped.team_id = await resolveTeamId(value as string);
        } else if (engKey === 'assignee_id') {
          mapped.assignee_id = await resolveUserId(value as string);
        } else if (engKey === 'date') {
          mapped.date = formatDateForApi(value as string);
        } else if (engKey) {
          mapped[engKey] = value;
        }
      }

      console.log('[Incidents] Update:', incidentId, mapped);
      await incidentsApi.update(incidentId, mapped);
    } catch (e: any) {
      console.error('[Incidents] Update error:', e);
      await get().fetchIncidents();
    }
  },

  addIncident: async (incident) => {
    try {
      const result = await incidentsApi.create(incident);
      return result;
    } catch (e: any) {
      console.error('[Incidents] Create error:', e);
      await get().fetchIncidents();
      throw e;
    }
  },

  deleteIncident: async (incidentId) => {
    try {
      await incidentsApi.delete(incidentId);
      // Удаляем локально сразу — сервер подтвердил
      set((state) => ({
        incidents: state.incidents.filter((i) => i.id !== incidentId),
      }));
    } catch (e: any) {
      console.error('[Incidents] Delete error:', e);
      await get().fetchIncidents();
    }
  },

  // WebSocket handlers — сервер прислал реальное состояние
  _handleCreated: (data) => {
    const incident = apiFullToIncident(data);
    set((state) => {
      if (state.incidents.find((i) => i.id === incident.id)) return state;
      return { incidents: [...state.incidents, incident] };
    });
  },

  _handleUpdated: (data) => {
    const incident = apiFullToIncident(data);
    set((state) => ({
      incidents: state.incidents.map((i) => (i.id === incident.id ? incident : i)),
    }));
  },

  _handleDeleted: (data) => {
    set((state) => ({
      incidents: state.incidents.filter((i) => i.id !== data.id),
    }));
  },
}));

// ============================================================
// WebSocket: авто-подписка на обновления (как в чатах)
// ============================================================

let wsInitialized = false;

export function initWsSubscriptions() {
  if (wsInitialized) return;
  wsInitialized = true;

  wsClient.on('incident_created', (data) => {
    console.log('[WS] Incident created:', data.id);
    useIncidentsStore.getState()._handleCreated(data);
  });

  wsClient.on('incident_updated', (data) => {
    console.log('[WS] Incident updated:', data.id);
    useIncidentsStore.getState()._handleUpdated(data);
  });

  wsClient.on('incident_deleted', (data) => {
    console.log('[WS] Incident deleted:', data.id);
    useIncidentsStore.getState()._handleDeleted(data);
  });

  // При переподключении — один раз перечитываем всё с сервера
  wsClient.on('ws_reconnected', () => {
    console.log('[WS] Reconnected, full refetch...');
    useIncidentsStore.getState().fetchIncidents();
  });

  wsClient.connect();
}
