import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IncidentTypeId } from '../types/incident.ts';
import { CustomAction } from '../types/settings.ts';

export const UNIVERSAL_INCIDENT_ACTION_NAMES = ['Выгрузка', 'Переместить в корзину'] as const;

export const DEFAULT_INCIDENT_ACTIONS: CustomAction[] = [
  {
    id: 'assign-analyst',
    name: 'Назначить на аналитика',
    description: 'Назначить инцидент на ответственного аналитика',
    icon: 'UserPlus',
    iconColor: '#3b82f6',
    targetType: 'user',
    activities: [],
  },
  {
    id: 'request-artifacts',
    name: 'Запросить артефакты',
    description: 'Собрать недостающие материалы расследования',
    icon: 'Archive',
    iconColor: '#f97316',
    targetType: 'custom',
    activities: [],
  },
  {
    id: 'escalate-l2',
    name: 'Эскалировать в SOC L2',
    description: 'Передать инцидент на следующую линию',
    icon: 'ShieldAlert',
    iconColor: '#22c55e',
    targetType: 'team',
    activities: [],
  },
  {
    id: 'notify-owner',
    name: 'Уведомить владельца системы',
    description: 'Отправить уведомление владельцу затронутой системы',
    icon: 'Mail',
    iconColor: '#a855f7',
    targetType: 'user',
    activities: [],
  },
  {
    id: 'change-status',
    name: 'Сменить статус',
    description: 'Перевести инцидент в другой статус',
    icon: 'CheckCircle',
    iconColor: '#3b82f6',
    targetType: 'status',
    activities: [],
  },
  {
    id: 'contact-violator',
    name: 'Связаться с нарушителем',
    description: 'Отправить системное письмо подозреваемому пользователю',
    icon: 'Send',
    iconColor: '#ef4444',
    targetType: 'custom',
    activities: [],
  },
  {
    id: 'move-to-trash',
    name: 'Переместить в корзину',
    description: 'Переместить инцидент в корзину',
    icon: 'Trash2',
    iconColor: '#ef4444',
    targetType: 'custom',
    activities: [],
  },
  {
    id: 'export',
    name: 'Выгрузка',
    description: 'Выгрузка данных инцидента',
    icon: 'Download',
    iconColor: '#3b82f6',
    targetType: 'custom',
    activities: [],
  },
];

const UNIVERSAL_INCIDENT_ACTION_NAME_SET = new Set<string>(UNIVERSAL_INCIDENT_ACTION_NAMES);
const DEFAULT_ACTIONS_BY_NAME = new Map(DEFAULT_INCIDENT_ACTIONS.map((action) => [action.name, action]));

function ensureUniversalActions(actions: CustomAction[]): CustomAction[] {
  const actionsByName = new Map(actions.map((action) => [action.name, action]));

  UNIVERSAL_INCIDENT_ACTION_NAMES.forEach((actionName) => {
    if (!actionsByName.has(actionName)) {
      const fallback = DEFAULT_ACTIONS_BY_NAME.get(actionName);
      if (fallback) {
        actionsByName.set(actionName, fallback);
      }
    }
  });

  return Array.from(actionsByName.values());
}

// Действия по умолчанию для каждого типа инцидента
export const DEFAULT_INCIDENT_TYPE_ACTIONS: Record<IncidentTypeId, string[]> = {
  security: ['Назначить на аналитика', 'Сменить статус', 'Связаться с нарушителем'],
  dlp: ['Назначить на аналитика', 'Запросить артефакты', 'Связаться с нарушителем'],
  network: ['Назначить на аналитика', 'Эскалировать в SOC L2', 'Запросить артефакты'],
  malware: ['Назначить на аналитика', 'Сменить статус', 'Уведомить владельца системы'],
};

interface IncidentActionsState {
  // Действия
  actions: CustomAction[];
  // Привязка действий к типам инцидентов (хранит названия действий)
  typeActions: Record<IncidentTypeId | string, string[]>;
  
  // Actions
  setActions: (actions: CustomAction[]) => void;
  addAction: (action: CustomAction) => void;
  removeAction: (actionId: string) => void;
  updateAction: (actionId: string, updates: Partial<CustomAction>) => void;
  
  // Actions для привязки к типам инцидентов
  setTypeActions: (typeId: string, actionNames: string[]) => void;
  addActionToType: (typeId: string, actionName: string) => void;
  removeActionFromType: (typeId: string, actionName: string) => void;
  
  // Утилиты
  getActions: () => CustomAction[];
  getActionByName: (name: string) => CustomAction | null;
  getActionsForType: (typeId: string) => CustomAction[];
  getActionByTargetType: (targetType: 'user' | 'team' | 'status' | 'custom') => CustomAction[];
}

export const useIncidentActionsStore = create<IncidentActionsState>()(
  persist(
    (set, get) => ({
      actions: ensureUniversalActions(DEFAULT_INCIDENT_ACTIONS),
      typeActions: DEFAULT_INCIDENT_TYPE_ACTIONS,
      
      setActions: (actions) => set({ actions: ensureUniversalActions(actions) }),
      
      addAction: (action) =>
        set((state) => ({
          actions: ensureUniversalActions([...state.actions, action]),
        })),
      
      removeAction: (actionId) =>
        set((state) => {
          const actionToRemove = state.actions.find((action) => action.id === actionId);
          if (actionToRemove && UNIVERSAL_INCIDENT_ACTION_NAME_SET.has(actionToRemove.name)) {
            return state;
          }
          return {
            actions: ensureUniversalActions(state.actions.filter((a) => a.id !== actionId)),
          };
        }),
      
      updateAction: (actionId, updates) =>
        set((state) => ({
          actions: ensureUniversalActions(state.actions.map((a) =>
            a.id === actionId ? { ...a, ...updates } : a
          )),
        })),
      
      setTypeActions: (typeId, actionNames) =>
        set((state) => ({
          typeActions: {
            ...state.typeActions,
            [typeId]: actionNames,
          },
        })),
      
      addActionToType: (typeId, actionName) =>
        set((state) => ({
          typeActions: {
            ...state.typeActions,
            [typeId]: [...(state.typeActions[typeId] ?? []), actionName],
          },
        })),
      
      removeActionFromType: (typeId, actionName) =>
        set((state) => ({
          typeActions: {
            ...state.typeActions,
            [typeId]: (state.typeActions[typeId] ?? []).filter((n) => n !== actionName),
          },
        })),
      
      getActions: () => {
        const { actions } = get();
        return ensureUniversalActions(actions);
      },
      
      getActionByName: (name) => {
        const allActions = get().getActions();
        return allActions.find((a) => a.name === name) ?? null;
      },
      
      getActionsForType: (typeId) => {
        const { typeActions } = get();
        const actionNames = Array.from(
          new Set([...(typeActions[typeId] ?? []), ...UNIVERSAL_INCIDENT_ACTION_NAMES])
        );
        const allActions = get().getActions();
        return allActions.filter((a) => actionNames.includes(a.name));
      },
      
      getActionByTargetType: (targetType) => {
        const allActions = get().getActions();
        return allActions.filter((a) => a.targetType === targetType);
      },
    }),
    {
      name: 'incident-actions-settings',
    }
  )
);
