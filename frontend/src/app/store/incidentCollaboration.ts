import { create } from 'zustand';
import { mockUser, mockUsersDirectory } from '../data/mockData.ts';
import { getActionsForIncidentType, SYSTEM_INCIDENT_ACTIONS } from '../config/incident-actions.ts';
import { IncidentTypeId } from '../types/incident.ts';

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

interface IncidentCollaborationState {
  actionsByIncident: Record<string, IncidentAction[]>;
  investigationByIncident: Record<string, InvestigationEntry[]>;
  notifications: UserNotification[];
  initializeIncidentActions: (incidentId: string, incidentType: IncidentTypeId) => void;
  moveAction: (incidentId: string, dragIndex: number, hoverIndex: number) => void;
  addAction: (incidentId: string, actionName: string) => void;
  removeAction: (incidentId: string, actionId: string) => void;
  addComment: (incidentId: string, content: string, attachments?: InvestigationAttachment[], parentId?: string) => void;
  sendSystemEmail: (incidentId: string, recipient: string, subject: string, content: string, templateName: string) => void;
  replyToEmailThread: (incidentId: string, parentId: string, content: string) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (userId: string) => void;
}

const initialActions: Record<string, IncidentAction[]> = {
  '1': [
    { id: 'a-1', label: 'Назначить на аналитика', tone: 'blue' },
    { id: 'a-2', label: 'Запросить артефакты', tone: 'amber' },
    { id: 'a-3', label: 'Эскалировать в SOC L2', tone: 'green' },
    { id: 'a-1-universal-export', label: 'Выгрузка', tone: 'blue' },
    { id: 'a-1-universal-trash', label: 'Переместить в корзину', tone: 'red' },
  ],
  '2': [
    { id: 'a-4', label: 'Сменить статус', tone: 'blue' },
    { id: 'a-5', label: 'Уведомить владельца системы', tone: 'green' },
    { id: 'a-2-universal-export', label: 'Выгрузка', tone: 'blue' },
    { id: 'a-2-universal-trash', label: 'Переместить в корзину', tone: 'red' },
  ],
};

const initialInvestigation: Record<string, InvestigationEntry[]> = {
  '1': [
    {
      id: 'm-1',
      incidentId: '1',
      type: 'comment',
      authorId: 'u2',
      authorName: 'Алексей Смирнов',
      authorRole: 'Аналитик SOC',
      content: 'Проверил сетевой всплеск. Нужна дополнительная выгрузка с пограничного узла. @Иван Петров, подключись к разбору.',
      createdAt: '2026-03-31 09:20',
      mentions: ['u1'],
      attachments: [
        { id: 'att-1', name: 'edge-traffic.csv', sizeLabel: '420 KB' },
      ],
    },
    {
      id: 'm-1-r1',
      incidentId: '1',
      type: 'comment',
      parentId: 'm-1',
      threadRootId: 'm-1',
      authorId: 'u1',
      authorName: 'Иван Петров',
      authorRole: 'Текущий пользователь',
      content: 'Подключился к разбору. Запрашиваю выгрузку по хосту и проверю смежные события.',
      createdAt: '2026-03-31 09:28',
    },
    {
      id: 'm-2',
      incidentId: '1',
      type: 'email_out',
      authorId: 'system',
      authorName: 'Система IM',
      authorRole: 'Системное письмо',
      content: 'Добрый день. Просим уточнить обстоятельства подключения и подтвердить, выполняли ли вы это действие.',
      createdAt: '2026-03-31 09:35',
      recipient: 'abuse@company.com',
      subject: 'Уточнение по сетевой активности',
      templateName: 'Запросить пояснение',
      threadRootId: 'm-2',
    },
    {
      id: 'm-3',
      incidentId: '1',
      type: 'email_in',
      parentId: 'm-2',
      threadRootId: 'm-2',
      authorId: 'violator',
      authorName: 'Подозреваемый пользователь',
      authorRole: 'Внешний ответ',
      content: 'Я не инициировал это соединение. Прошу уточнить временной интервал и узел.',
      createdAt: '2026-03-31 09:42',
      recipient: 'abuse@company.com',
      subject: 'Re: Уточнение по сетевой активности',
      templateName: 'Ответ нарушителя',
    },
  ],
};

function getNowString() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function extractMentionedUserIds(content: string) {
  return mockUsersDirectory
    .filter((user) => user.id !== mockUser.id)
    .filter((user) => content.includes(`@${user.name}`))
    .map((user) => user.id);
}

function makeActionTone(index: number): IncidentAction['tone'] {
  return (['blue', 'green', 'amber', 'red', 'slate'] as IncidentAction['tone'][])[index % 5];
}

function resolveActionTone(actionName: string, fallbackIndex: number): IncidentAction['tone'] {
  const sourceAction = SYSTEM_INCIDENT_ACTIONS.find((action) => action.name === actionName);
  return sourceAction?.iconColor === 'green'
    ? 'green'
    : sourceAction?.iconColor === 'orange'
      ? 'amber'
      : sourceAction?.iconColor === 'red'
        ? 'red'
        : sourceAction?.iconColor === 'blue'
          ? 'blue'
          : makeActionTone(fallbackIndex);
}

export const useIncidentCollaboration = create<IncidentCollaborationState>()((set) => ({
  actionsByIncident: initialActions,
  investigationByIncident: initialInvestigation,
  notifications: [
    {
      id: 'n-1',
      userId: mockUser.id,
      incidentId: '1',
      createdAt: '2026-03-31 09:20',
      title: 'Вас упомянули в расследовании',
      description: 'Алексей Смирнов отметил вас в комментарии по инциденту #1.',
      read: false,
    },
  ],
  initializeIncidentActions: (incidentId, incidentType) =>
    set((state) => {
      const requiredActionNames = getActionsForIncidentType(incidentType).map((action) => action.name);
      const allowedActionNameSet = new Set(requiredActionNames);
      const existingActions = state.actionsByIncident[incidentId];
      const buildDefaultActions = () =>
        requiredActionNames.map((actionName, index) => ({
          id: `default-${incidentId}-${index}`,
          label: actionName,
          tone: resolveActionTone(actionName, index),
        }));

      if (existingActions) {
        const normalizedActions = existingActions.filter((action) => allowedActionNameSet.has(action.label));
        const nextActions =
          normalizedActions.length === 0 && existingActions.length > 0 && requiredActionNames.length > 0
            ? buildDefaultActions()
            : normalizedActions;
        const shouldUpdate =
          nextActions.length !== existingActions.length ||
          nextActions.some((action, index) => action.id !== existingActions[index]?.id);

        if (!shouldUpdate) {
          return state;
        }

        return {
          actionsByIncident: {
            ...state.actionsByIncident,
            [incidentId]: nextActions,
          },
        };
      }

      const defaultActions = buildDefaultActions();

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
      if (dragIndex === hoverIndex || !actions[dragIndex] || !actions[hoverIndex]) {
        return state;
      }
      const nextActions = [...actions];
      const temp = nextActions[dragIndex];
      nextActions[dragIndex] = nextActions[hoverIndex];
      nextActions[hoverIndex] = temp;
      return {
        actionsByIncident: {
          ...state.actionsByIncident,
          [incidentId]: nextActions,
        },
      };
    }),
  addAction: (incidentId, actionName) =>
    set((state) => {
      const actions = state.actionsByIncident[incidentId] ?? [];
      if (actions.some((action) => action.label === actionName)) {
        return state;
      }
      const nextAction: IncidentAction = {
        id: `action-${Date.now()}`,
        label: actionName,
        tone: resolveActionTone(actionName, actions.length),
      };
      return {
        actionsByIncident: {
          ...state.actionsByIncident,
          [incidentId]: [...actions, nextAction],
        },
      };
    }),
  removeAction: (incidentId, actionId) =>
    set((state) => ({
      actionsByIncident: {
        ...state.actionsByIncident,
        [incidentId]: (state.actionsByIncident[incidentId] ?? []).filter((action) => action.id !== actionId),
      },
    })),
  addComment: (incidentId, content, attachments = [], parentId) =>
    set((state) => {
      const entries = state.investigationByIncident[incidentId] ?? [];
      const mentionedUserIds = extractMentionedUserIds(content);
      const parentEntry = parentId ? entries.find((entry) => entry.id === parentId) : undefined;
      const nextId = `comment-${Date.now()}`;
      const nextEntry: InvestigationEntry = {
        id: nextId,
        incidentId,
        type: 'comment',
        parentId,
        threadRootId: parentEntry?.threadRootId ?? parentEntry?.id ?? nextId,
        authorId: mockUser.id,
        authorName: mockUser.name,
        authorRole: 'Текущий пользователь',
        content,
        createdAt: getNowString(),
        mentions: mentionedUserIds,
        attachments,
      };

      const mentionNotifications: UserNotification[] = mentionedUserIds.map((userId) => {
        return {
          id: `notification-${Date.now()}-${userId}`,
          userId,
          incidentId,
          createdAt: getNowString(),
          title: 'Новое упоминание',
          description: `${mockUser.name} отметил${userId === 'u3' ? 'а' : ''} вас в расследовании инцидента #${incidentId}.`,
          read: false,
        };
      });

      return {
        investigationByIncident: {
          ...state.investigationByIncident,
          [incidentId]: [...entries, nextEntry],
        },
        notifications: [...state.notifications, ...mentionNotifications],
      };
    }),
  sendSystemEmail: (incidentId, recipient, subject, content, templateName) => {
    const rootId = `email-out-${Date.now()}`;
    const outEntry: InvestigationEntry = {
      id: rootId,
      incidentId,
      type: 'email_out',
      threadRootId: rootId,
      authorId: 'system',
      authorName: 'Система IM',
      authorRole: 'Системное письмо',
      content,
      createdAt: getNowString(),
      recipient,
      subject,
      templateName,
    };

    set((state) => {
      const entries = state.investigationByIncident[incidentId] ?? [];
      return {
        investigationByIncident: {
          ...state.investigationByIncident,
          [incidentId]: [...entries, outEntry],
        },
      };
    });

    setTimeout(() => {
      set((state) => {
        const entries = state.investigationByIncident[incidentId] ?? [];
        const replyEntry: InvestigationEntry = {
          id: `email-in-${Date.now()}`,
          incidentId,
          type: 'email_in',
          parentId: rootId,
          threadRootId: rootId,
          authorId: 'violator',
          authorName: 'Нарушитель',
          authorRole: 'Ответ на письмо',
          content: 'Получил письмо. Подтверждаю получение и подготовлю пояснение по ситуации.',
          createdAt: getNowString(),
          recipient,
          subject: `Re: ${subject}`,
          templateName: 'Ответ нарушителя',
        };
        return {
          investigationByIncident: {
            ...state.investigationByIncident,
            [incidentId]: [...entries, replyEntry],
          },
        };
      });
    }, 1500);
  },
  replyToEmailThread: (incidentId, parentId, content) =>
    set((state) => {
      const entries = state.investigationByIncident[incidentId] ?? [];
      const parentEntry = entries.find((entry) => entry.id === parentId);
      if (!parentEntry) {
        return state;
      }

      const nextEntry: InvestigationEntry = {
        id: `email-reply-${Date.now()}`,
        incidentId,
        type: 'email_out',
        parentId,
        threadRootId: parentEntry.threadRootId ?? parentEntry.id,
        authorId: 'system',
        authorName: 'Система IM',
        authorRole: 'Ответ системы',
        content,
        createdAt: getNowString(),
        recipient: parentEntry.recipient,
        subject: parentEntry.subject?.startsWith('Re:') ? parentEntry.subject : `Re: ${parentEntry.subject ?? 'Переписка по инциденту'}`,
        templateName: 'Ответ в ветке',
      };

      return {
        investigationByIncident: {
          ...state.investigationByIncident,
          [incidentId]: [...entries, nextEntry],
        },
      };
    }),
  markNotificationRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      ),
    })),
  markAllNotificationsRead: (userId) =>
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.userId === userId
          ? { ...notification, read: true }
          : notification
      ),
    })),
}));
