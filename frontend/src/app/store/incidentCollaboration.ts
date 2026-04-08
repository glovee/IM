import { create } from 'zustand';
import { IncidentTypeId } from '../types/incident.ts';
import { getActionsForIncidentType, SYSTEM_INCIDENT_ACTIONS } from '../config/incident-actions.ts';
import { dictApi } from '../api/client.ts';

// ============================================================
// Types
// ============================================================

export interface IncidentAction {
  id: string;
  label: string;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}

export interface InvestigationEntry {
  id: string;
  incidentId: string;
  type: 'comment' | 'email_out' | 'email_in';
  parentId?: string;
  threadRootId?: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  mentions?: string[];
  recipient?: string;
  subject?: string;
  templateName?: string;
  attachments?: InvestigationAttachment[];
}

export interface InvestigationAttachment {
  id: string;
  name: string;
  sizeLabel: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  incidentId: string;
  createdAt: string;
  title: string;
  description: string;
  read: boolean;
}

// ============================================================
// API helpers
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ============================================================
// Helpers
// ============================================================

function getNowString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function makeActionTone(index: number): IncidentAction['tone'] {
  return (['blue', 'green', 'amber', 'red', 'slate'] as const)[index % 5];
}

function resolveActionTone(actionName: string, fallbackIndex: number): IncidentAction['tone'] {
  const sourceAction = SYSTEM_INCIDENT_ACTIONS.find((a) => a.name === actionName);
  if (sourceAction?.iconColor === 'green') return 'green';
  if (sourceAction?.iconColor === 'orange') return 'amber';
  if (sourceAction?.iconColor === 'red') return 'red';
  if (sourceAction?.iconColor === 'blue') return 'blue';
  return makeActionTone(fallbackIndex);
}

// ============================================================
// Store
// ============================================================

interface IncidentCollaborationState {
  actionsByIncident: Record<string, IncidentAction[]>;
  investigationByIncident: Record<string, InvestigationEntry[]>;
  notifications: UserNotification[];
  usersDirectory: { id: string; name: string; email: string }[];

  // Init
  loadUsersDirectory: () => Promise<void>;
  loadInvestigationForIncident: (incidentId: string) => Promise<void>;

  // Actions
  initializeIncidentActions: (incidentId: string, incidentType: IncidentTypeId) => void;
  moveAction: (incidentId: string, dragIndex: number, hoverIndex: number) => void;
  addAction: (incidentId: string, actionName: string) => void;
  removeAction: (incidentId: string, actionId: string) => void;

  // Investigation
  addComment: (incidentId: string, content: string, authorId: string, attachments?: InvestigationAttachment[], parentId?: string) => Promise<void>;
  sendSystemEmail: (incidentId: string, authorId: string, recipient: string, subject: string, content: string, templateName: string) => Promise<void>;
  replyToEmailThread: (incidentId: string, authorId: string, parentId: string, content: string) => Promise<void>;

  // Notifications
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (userId: string) => void;

  // WS handlers
  _handleInvestigationEntry: (data: any) => void;
}

export const useIncidentCollaboration = create<IncidentCollaborationState>()((set, get) => ({
  actionsByIncident: {},
  investigationByIncident: {},
  notifications: [],
  usersDirectory: [],

  // ============================================================
  // Load users from API
  // ============================================================

  loadUsersDirectory: async () => {
    try {
      const users = await dictApi.users();
      set({
        usersDirectory: users.map((u: any) => ({
          id: u.id,
          name: u.display_name,
          email: u.email || '',
        })),
      });
    } catch (e) {
      console.error('[Collaboration] loadUsersDirectory error:', e);
    }
  },

  // ============================================================
  // Load investigation entries from API
  // ============================================================

  loadInvestigationForIncident: async (incidentId) => {
    try {
      const entries = await apiFetch<any[]>(`/api/investigation/entries/${incidentId}`);
      set((state) => ({
        investigationByIncident: {
          ...state.investigationByIncident,
          [incidentId]: entries.map((e: any) => ({
            id: e.id,
            incidentId: e.incident_id || incidentId,
            type: e.type,
            parentId: e.parent_id,
            threadRootId: e.thread_root_id,
            authorId: e.author_id,
            authorName: e.author_name,
            authorRole: e.author_role || '',
            content: e.content,
            createdAt: e.created_at,
            mentions: e.mentions || [],
            recipient: e.recipient,
            subject: e.subject,
            templateName: e.template_name,
            attachments: [],
          })),
        },
      }));
    } catch (e) {
      console.error('[Collaboration] loadInvestigationForIncident error:', e);
    }
  },

  // ============================================================
  // Actions (local — порядок действий UI-преференция)
  // ============================================================

  initializeIncidentActions: (incidentId, incidentType) =>
    set((state) => {
      if (state.actionsByIncident[incidentId]) return state;
      const requiredActionNames = getActionsForIncidentType(incidentType).map((a) => a.name);
      const defaultActions = requiredActionNames.map((name, i) => ({
        id: `default-${incidentId}-${i}`,
        label: name,
        tone: resolveActionTone(name, i),
      }));
      return {
        actionsByIncident: {
          ...state.actionsByIncident,
          [incidentId]: defaultActions,
        },
      };
    }),

  moveAction: (incidentId, dragIndex, hoverIndex) =>
    set((state) => {
      const actions = state.actionsByIncident[incidentId] ?? [];
      if (dragIndex === hoverIndex || !actions[dragIndex] || !actions[hoverIndex]) return state;
      const next = [...actions];
      const temp = next[dragIndex];
      next[dragIndex] = next[hoverIndex];
      next[hoverIndex] = temp;
      return {
        actionsByIncident: {
          ...state.actionsByIncident,
          [incidentId]: next,
        },
      };
    }),

  addAction: (incidentId, actionName) =>
    set((state) => {
      const actions = state.actionsByIncident[incidentId] ?? [];
      if (actions.some((a) => a.label === actionName)) return state;
      return {
        actionsByIncident: {
          ...state.actionsByIncident,
          [incidentId]: [...actions, {
            id: `action-${Date.now()}`,
            label: actionName,
            tone: resolveActionTone(actionName, actions.length),
          }],
        },
      };
    }),

  removeAction: (incidentId, actionId) =>
    set((state) => ({
      actionsByIncident: {
        ...state.actionsByIncident,
        [incidentId]: (state.actionsByIncident[incidentId] ?? []).filter((a) => a.id !== actionId),
      },
    })),

  // ============================================================
  // Investigation — API calls
  // ============================================================

  addComment: async (incidentId, content, authorId, attachments = [], parentId) => {
    try {
      const { usersDirectory } = get();
      const mentionedUserIds = usersDirectory
        .filter((u) => u.id !== authorId)
        .filter((u) => content.includes(`@${u.name}`))
        .map((u) => u.id);

      const entry = await apiPost<any>('/api/investigation/entries', {
        incident_id: incidentId,
        type: 'comment',
        author_id: authorId,
        content,
        parent_id: parentId || null,
        thread_root_id: null, // сервер определит
      });

      // Локально добавим сразу для мгновенного UI
      set((state) => {
        const entries = state.investigationByIncident[incidentId] ?? [];
        const parentEntry = parentId ? entries.find((e) => e.id === parentId) : undefined;
        const localEntry: InvestigationEntry = {
          id: entry.id,
          incidentId,
          type: 'comment',
          parentId: entry.parent_id,
          threadRootId: entry.thread_root_id,
          authorId,
          authorName: usersDirectory.find((u) => u.id === authorId)?.name || 'Вы',
          authorRole: '',
          content,
          createdAt: entry.created_at,
          mentions: mentionedUserIds,
          attachments,
        };
        return {
          investigationByIncident: {
            ...state.investigationByIncident,
            [incidentId]: [...entries, localEntry],
          },
        };
      });
    } catch (e) {
      console.error('[Collaboration] addComment error:', e);
    }
  },

  sendSystemEmail: async (incidentId, authorId, recipient, subject, content, templateName) => {
    try {
      const entry = await apiPost<any>('/api/investigation/entries', {
        incident_id: incidentId,
        type: 'email_out',
        author_id: authorId,
        content,
        recipient,
        subject,
        template_name: templateName,
      });

      set((state) => {
        const entries = state.investigationByIncident[incidentId] ?? [];
        const localEntry: InvestigationEntry = {
          id: entry.id,
          incidentId,
          type: 'email_out',
          threadRootId: entry.thread_root_id,
          authorId,
          authorName: 'Система IM',
          authorRole: 'Системное письмо',
          content,
          createdAt: entry.created_at,
          recipient,
          subject,
          templateName,
        };
        return {
          investigationByIncident: {
            ...state.investigationByIncident,
            [incidentId]: [...entries, localEntry],
          },
        };
      });
    } catch (e) {
      console.error('[Collaboration] sendSystemEmail error:', e);
    }
  },

  replyToEmailThread: async (incidentId, authorId, parentId, content) => {
    try {
      const entries = get().investigationByIncident[incidentId] ?? [];
      const parentEntry = entries.find((e) => e.id === parentId);
      if (!parentEntry) return;

      const entry = await apiPost<any>('/api/investigation/entries', {
        incident_id: incidentId,
        type: 'email_out',
        author_id: authorId,
        content,
        parent_id: parentId,
        thread_root_id: parentEntry.threadRootId,
        recipient: parentEntry.recipient,
        subject: parentEntry.subject?.startsWith('Re:') ? parentEntry.subject : `Re: ${parentEntry.subject ?? 'Переписка по инциденту'}`,
        template_name: 'Ответ в ветке',
      });

      set((state) => {
        const allEntries = state.investigationByIncident[incidentId] ?? [];
        const localEntry: InvestigationEntry = {
          id: entry.id,
          incidentId,
          type: 'email_out',
          parentId: entry.parent_id,
          threadRootId: entry.thread_root_id,
          authorId,
          authorName: 'Система IM',
          authorRole: 'Ответ системы',
          content,
          createdAt: entry.created_at,
          recipient: parentEntry.recipient,
          subject: entry.subject,
          templateName: 'Ответ в ветке',
        };
        return {
          investigationByIncident: {
            ...state.investigationByIncident,
            [incidentId]: [...allEntries, localEntry],
          },
        };
      });
    } catch (e) {
      console.error('[Collaboration] replyToEmailThread error:', e);
    }
  },

  // ============================================================
  // Notifications (local пока — нет API для уведомлений)
  // ============================================================

  markNotificationRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
    })),

  markAllNotificationsRead: (userId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.userId === userId ? { ...n, read: true } : n
      ),
    })),

  // ============================================================
  // WS handler
  // ============================================================

  _handleInvestigationEntry: (data) => {
    const incidentId = data.incident_id;
    if (!incidentId) return;
    const entry: InvestigationEntry = {
      id: data.id,
      incidentId,
      type: data.type,
      parentId: data.parent_id,
      threadRootId: data.thread_root_id,
      authorId: data.author_id,
      authorName: data.author_name,
      authorRole: data.author_role || '',
      content: data.content,
      createdAt: data.created_at,
      mentions: [],
      recipient: data.recipient,
      subject: data.subject,
      templateName: data.template_name,
      attachments: [],
    };
    set((state) => {
      const entries = state.investigationByIncident[incidentId] ?? [];
      if (entries.find((e) => e.id === entry.id)) return state;
      return {
        investigationByIncident: {
          ...state.investigationByIncident,
          [incidentId]: [...entries, entry],
        },
      };
    });
  },
}));

// ============================================================
// WS subscription
// ============================================================

let wsInitialized = false;

export function initCollaborationWs() {
  if (wsInitialized) return;
  wsInitialized = true;

  const WS_URL_STR = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
  const ws = new WebSocket(WS_URL_STR);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'investigation_entry_created') {
        useIncidentCollaboration.getState()._handleInvestigationEntry(msg.data);
      }
    } catch (e) {
      console.warn('[Collaboration WS] Parse error:', e);
    }
  };

  ws.onclose = () => {
    setTimeout(() => initCollaborationWs(), 5000);
  };
}
