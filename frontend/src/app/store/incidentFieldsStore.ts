import { create } from 'zustand';
import { CustomField } from '../types/settings.ts';
import { dictApi, ApiDictItem } from '../api/client.ts';

// ============================================================
// Дефолтные базовые поля
// ============================================================

export const DEFAULT_BASE_FIELDS: CustomField[] = [
  { id: 'title', name: 'Название', type: 'string', icon: 'FileText', iconColor: '#3b82f6', required: true, description: 'Название инцидента' },
  { id: 'assignee', name: 'Ответственный', type: 'string', icon: 'User', iconColor: '#22c55e', required: true, description: 'Ответственный аналитик' },
  { id: 'source', name: 'Источник', type: 'select', icon: 'Database', iconColor: '#f97316', required: true, description: 'Источник обнаружения инцидента' },
  { id: 'host', name: 'Хост', type: 'string', icon: 'Server', iconColor: '#6366f1', required: true, description: 'Хост или устройство' },
  { id: 'login', name: 'Нарушитель', type: 'string', icon: 'Key', iconColor: '#f59e0b', required: true, description: 'Учетная запись нарушителя' },
  { id: 'status', name: 'Статус', type: 'select', icon: 'CircleCheck', iconColor: '#22c55e', required: true, description: 'Статус инцидента' },
  { id: 'date', name: 'Дата', type: 'datetime', icon: 'Calendar', iconColor: '#06b6d4', required: true, description: 'Дата и время инцидента' },
];

// ============================================================
// Дефолтные дополнительные поля
// ============================================================

const PRIORITY_FIELD: CustomField = {
  id: 'priority', name: 'Приоритет', type: 'select', icon: 'Flag', iconColor: '#ef4444', required: true, description: 'Приоритет инцидента',
  selectOptions: [
    { label: 'Критический', borderColor: '#ef4444', textColor: '#ef4444', bgColor: '#fee2e2' },
    { label: 'Высокий', borderColor: '#f97316', textColor: '#f97316', bgColor: '#ffedd5' },
    { label: 'Средний', borderColor: '#f59e0b', textColor: '#f59e0b', bgColor: '#fef3c7' },
    { label: 'Низкий', borderColor: '#22c55e', textColor: '#22c55e', bgColor: '#dcfce7' },
  ],
};

function makeExtraFields(multiSystem: boolean): CustomField[] {
  return [
    PRIORITY_FIELD,
    { id: 'detected_at', name: 'Дата обнаружения', type: 'datetime', icon: 'Clock', iconColor: '#06b6d4', required: true, description: 'Дата и время обнаружения' },
    { id: 'description', name: 'Описание', type: 'multiline', icon: 'FileText', iconColor: '#3b82f6', required: true, description: 'Подробное описание инцидента' },
    { id: 'response_time', name: 'Время реакции (мин)', type: 'number', icon: 'Timer', iconColor: '#f59e0b', required: false, description: 'Время реакции в минутах', prefix: 'мин' },
    { id: 'needs_escalation', name: 'Требуется эскалация', type: 'boolean', icon: 'ArrowUpRight', iconColor: '#a855f7', required: false, description: 'Требуется ли эскалация' },
    { id: 'affected_systems', name: 'Затронутые системы', type: multiSystem ? 'select' : 'string', icon: 'Network', iconColor: '#6366f1', required: false, description: 'Список затронутых систем', allowMultiple: multiSystem || undefined },
  ];
}

export const DEFAULT_EXTRA_FIELDS: Record<string, CustomField[]> = {
  security: makeExtraFields(true),
  dlp: makeExtraFields(false),
  network: makeExtraFields(false),
  malware: makeExtraFields(false),
};

// ============================================================
// Helpers
// ============================================================

const COLOR_PALETTE = [
  { borderColor: '#3b82f6', textColor: '#3b82f6', bgColor: '#dbeafe' },
  { borderColor: '#ef4444', textColor: '#ef4444', bgColor: '#fee2e2' },
  { borderColor: '#22c55e', textColor: '#22c55e', bgColor: '#dcfce7' },
  { borderColor: '#f59e0b', textColor: '#f59e0b', bgColor: '#fef3c7' },
  { borderColor: '#a855f7', textColor: '#a855f7', bgColor: '#f3e8ff' },
  { borderColor: '#06b6d4', textColor: '#06b6d4', bgColor: '#cffafe' },
  { borderColor: '#ec4899', textColor: '#ec4899', bgColor: '#fce7f3' },
  { borderColor: '#8b5cf6', textColor: '#8b5cf6', bgColor: '#ede9fe' },
  { borderColor: '#14b8a6', textColor: '#14b8a6', bgColor: '#ccfbf1' },
  { borderColor: '#6366f1', textColor: '#6366f1', bgColor: '#e0e7ff' },
  { borderColor: '#f97316', textColor: '#f97316', bgColor: '#ffedd5' },
  { borderColor: '#0ea5e9', textColor: '#0ea5e9', bgColor: '#e0f2fe' },
];

function getColors(index: number) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function dictToSelectOptions(items: ApiDictItem[]) {
  return items.map((item, i) => ({
    label: item.display_name || item.name,
    ...getColors(i),
  }));
}

// ============================================================
// Store
// ============================================================

interface IncidentFieldsState {
  baseFields: CustomField[];
  extraFields: CustomField[];
  sourcesLoaded: boolean;
  statusesLoaded: boolean;
  affectedSystemsLoaded: boolean;
  setBaseFields: (fields: CustomField[]) => void;
  addExtraField: (field: CustomField) => void;
  removeExtraField: (fieldId: string) => void;
  updateExtraField: (fieldId: string, updates: Partial<CustomField>) => void;
  getExtraFieldById: (id: string) => CustomField | null;
  getExtraFieldsByIds: (ids: string[]) => CustomField[];
  loadDictSources: () => Promise<void>;
  loadDictStatuses: () => Promise<void>;
  loadDictAffectedSystems: () => Promise<void>;
  loadAllDicts: () => Promise<void>;
}

export const useIncidentFieldsStore = create<IncidentFieldsState>()((set, get) => ({
  baseFields: DEFAULT_BASE_FIELDS,
  extraFields: [],
  sourcesLoaded: false,
  statusesLoaded: false,
  affectedSystemsLoaded: false,

  setBaseFields: (fields) => set({ baseFields: fields }),

  addExtraField: (field) =>
    set((state) => ({
      extraFields: [...state.extraFields, field],
    })),

  removeExtraField: (fieldId) =>
    set((state) => ({
      extraFields: state.extraFields.filter((f) => f.id !== fieldId),
    })),

  updateExtraField: (fieldId, updates) =>
    set((state) => ({
      extraFields: state.extraFields.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f
      ),
    })),

  getExtraFieldById: (id) => {
    const { extraFields } = get();
    return extraFields.find((f) => f.id === id) ?? null;
  },

  getExtraFieldsByIds: (ids) => {
    const { extraFields } = get();
    return extraFields.filter((f) => ids.includes(f.id));
  },

  loadDictSources: async () => {
    try {
      const sources = await dictApi.sources();
      const options = dictToSelectOptions(sources);
      set((state) => ({
        baseFields: state.baseFields.map((f) =>
          f.id === 'source' ? { ...f, selectOptions: options } : f
        ),
        sourcesLoaded: true,
      }));
    } catch (e) {
      console.error('[FieldsStore] loadDictSources error:', e);
    }
  },

  loadDictStatuses: async () => {
    try {
      const statuses = await dictApi.statuses();
      const options = dictToSelectOptions(statuses);
      set((state) => ({
        baseFields: state.baseFields.map((f) =>
          f.id === 'status' ? { ...f, selectOptions: options } : f
        ),
        statusesLoaded: true,
      }));
    } catch (e) {
      console.error('[FieldsStore] loadDictStatuses error:', e);
    }
  },

  loadDictAffectedSystems: async () => {
    try {
      const systems = await dictApi.affectedSystems();
      const options = dictToSelectOptions(systems);
      set((state) => ({
        extraFields: state.extraFields.map((f) =>
          f.id === 'affected_systems' ? { ...f, selectOptions: options } : f
        ),
        affectedSystemsLoaded: true,
      }));
    } catch (e) {
      console.error('[FieldsStore] loadDictAffectedSystems error:', e);
    }
  },

  loadAllDicts: async () => {
    await Promise.all([
      get().loadDictSources(),
      get().loadDictStatuses(),
      get().loadDictAffectedSystems(),
    ]);
  },
}));
