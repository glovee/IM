import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CustomField } from '../types/settings.ts';

// Дефолтные базовые поля
export const DEFAULT_BASE_FIELDS: CustomField[] = [
  {
    id: 'title',
    name: 'Название',
    type: 'string',
    icon: 'FileText',
    iconColor: '#3b82f6',
    required: true,
    description: 'Название инцидента',
  },
  {
    id: 'assignee',
    name: 'Ответственный',
    type: 'string',
    icon: 'User',
    iconColor: '#22c55e',
    required: true,
    description: 'Ответственный аналитик',
  },
  {
    id: 'source',
    name: 'Источник',
    type: 'select',
    icon: 'Database',
    iconColor: '#f97316',
    required: true,
    description: 'Источник обнаружения инцидента',
    selectOptions: [
      { label: 'SIEM', borderColor: '#3b82f6', textColor: '#3b82f6', bgColor: '#dbeafe' },
      { label: 'Firewall', borderColor: '#ef4444', textColor: '#ef4444', bgColor: '#fee2e2' },
      { label: 'DLP System', borderColor: '#a855f7', textColor: '#a855f7', bgColor: '#f3e8ff' },
      { label: 'Antivirus', borderColor: '#22c55e', textColor: '#22c55e', bgColor: '#dcfce7' },
      { label: 'Network Monitor', borderColor: '#06b6d4', textColor: '#06b6d4', bgColor: '#cffafe' },
      { label: 'Email Gateway', borderColor: '#f59e0b', textColor: '#f59e0b', bgColor: '#fef3c7' },
      { label: 'UEBA', borderColor: '#8b5cf6', textColor: '#8b5cf6', bgColor: '#ede9fe' },
      { label: 'EDR', borderColor: '#ec4899', textColor: '#ec4899', bgColor: '#fce7f3' },
      { label: 'WAF', borderColor: '#14b8a6', textColor: '#14b8a6', bgColor: '#ccfbf1' },
      { label: 'Resource Monitor', borderColor: '#6366f1', textColor: '#6366f1', bgColor: '#e0e7ff' },
      { label: 'Device Control', borderColor: '#84cc16', textColor: '#84cc16', bgColor: '#ecfccb' },
      { label: 'Email Security', borderColor: '#0ea5e9', textColor: '#0ea5e9', bgColor: '#e0f2fe' },
    ],
  },
  {
    id: 'host',
    name: 'Хост',
    type: 'string',
    icon: 'Server',
    iconColor: '#6366f1',
    required: true,
    description: 'Хост или устройство',
  },
  {
    id: 'login',
    name: 'Нарушитель',
    type: 'string',
    icon: 'Key',
    iconColor: '#f59e0b',
    required: true,
    description: 'Учетная запись нарушителя',
  },
  {
    id: 'status',
    name: 'Статус',
    type: 'select',
    icon: 'CircleCheck',
    iconColor: '#22c55e',
    required: true,
    description: 'Статус инцидента',
    selectOptions: [
      { label: 'Открыт', borderColor: '#3b82f6', textColor: '#3b82f6', bgColor: '#dbeafe' },
      { label: 'В работе', borderColor: '#f59e0b', textColor: '#f59e0b', bgColor: '#fef3c7' },
      { label: 'Расследование', borderColor: '#a855f7', textColor: '#a855f7', bgColor: '#f3e8ff' },
      { label: 'Закрыт', borderColor: '#22c55e', textColor: '#22c55e', bgColor: '#dcfce7' },
    ],
  },
  {
    id: 'date',
    name: 'Дата',
    type: 'datetime',
    icon: 'Calendar',
    iconColor: '#06b6d4',
    required: true,
    description: 'Дата и время инцидента',
  },
];

// Дефолтные дополнительные поля для типов инцидентов
export const DEFAULT_EXTRA_FIELDS: Record<string, CustomField[]> = {
  security: [
    {
      id: 'priority',
      name: 'Приоритет',
      type: 'select',
      icon: 'Flag',
      iconColor: '#ef4444',
      required: true,
      description: 'Приоритет инцидента',
      selectOptions: [
        { label: 'Критический', borderColor: '#ef4444', textColor: '#ef4444', bgColor: '#fee2e2' },
        { label: 'Высокий', borderColor: '#f97316', textColor: '#f97316', bgColor: '#ffedd5' },
        { label: 'Средний', borderColor: '#f59e0b', textColor: '#f59e0b', bgColor: '#fef3c7' },
        { label: 'Низкий', borderColor: '#22c55e', textColor: '#22c55e', bgColor: '#dcfce7' },
      ],
    },
    {
      id: 'detected_at',
      name: 'Дата обнаружения',
      type: 'datetime',
      icon: 'Clock',
      iconColor: '#06b6d4',
      required: true,
      description: 'Дата и время обнаружения',
    },
    {
      id: 'description',
      name: 'Описание',
      type: 'multiline',
      icon: 'FileText',
      iconColor: '#3b82f6',
      required: true,
      description: 'Подробное описание инцидента',
    },
    {
      id: 'response_time',
      name: 'Время реакции (мин)',
      type: 'number',
      icon: 'Timer',
      iconColor: '#f59e0b',
      required: false,
      description: 'Время реакции в минутах',
      prefix: 'мин',
    },
    {
      id: 'needs_escalation',
      name: 'Требуется эскалация',
      type: 'boolean',
      icon: 'ArrowUpRight',
      iconColor: '#a855f7',
      required: false,
      description: 'Требуется ли эскалация',
    },
    {
      id: 'affected_systems',
      name: 'Затронутые системы',
      type: 'select',
      icon: 'Network',
      iconColor: '#6366f1',
      required: false,
      description: 'Список затронутых систем',
      selectOptions: [
        { label: 'Active Directory', borderColor: '#2563eb', textColor: '#1e40af', bgColor: '#dbeafe' },
        { label: 'Exchange', borderColor: '#059669', textColor: '#065f46', bgColor: '#d1fae5' },
        { label: 'File Server', borderColor: '#d97706', textColor: '#92400e', bgColor: '#fef3c7' },
        { label: 'VPN', borderColor: '#7c3aed', textColor: '#5b21b6', bgColor: '#ede9fe' },
        { label: 'Web Server', borderColor: '#dc2626', textColor: '#b91c1c', bgColor: '#fee2e2' },
      ],
      allowMultiple: true,
    },
  ],
  dlp: [
    {
      id: 'priority',
      name: 'Приоритет',
      type: 'select',
      icon: 'Flag',
      iconColor: '#ef4444',
      required: true,
      description: 'Приоритет инцидента',
      selectOptions: [
        { label: 'Критический', borderColor: '#ef4444', textColor: '#ef4444', bgColor: '#fee2e2' },
        { label: 'Высокий', borderColor: '#f97316', textColor: '#f97316', bgColor: '#ffedd5' },
        { label: 'Средний', borderColor: '#f59e0b', textColor: '#f59e0b', bgColor: '#fef3c7' },
        { label: 'Низкий', borderColor: '#22c55e', textColor: '#22c55e', bgColor: '#dcfce7' },
      ],
    },
    {
      id: 'detected_at',
      name: 'Дата обнаружения',
      type: 'datetime',
      icon: 'Clock',
      iconColor: '#06b6d4',
      required: true,
      description: 'Дата и время обнаружения',
    },
    {
      id: 'description',
      name: 'Описание',
      type: 'multiline',
      icon: 'FileText',
      iconColor: '#3b82f6',
      required: true,
      description: 'Подробное описание инцидента',
    },
    {
      id: 'response_time',
      name: 'Время реакции (мин)',
      type: 'number',
      icon: 'Timer',
      iconColor: '#f59e0b',
      required: false,
      description: 'Время реакции в минутах',
      prefix: 'мин',
    },
    {
      id: 'needs_escalation',
      name: 'Требуется эскалация',
      type: 'boolean',
      icon: 'ArrowUpRight',
      iconColor: '#a855f7',
      required: false,
      description: 'Требуется ли эскалация',
    },
    {
      id: 'affected_systems',
      name: 'Затронутые системы',
      type: 'string',
      icon: 'Network',
      iconColor: '#6366f1',
      required: false,
      description: 'Список затронутых систем',
    },
  ],
  network: [
    {
      id: 'priority',
      name: 'Приоритет',
      type: 'select',
      icon: 'Flag',
      iconColor: '#ef4444',
      required: true,
      description: 'Приоритет инцидента',
      selectOptions: [
        { label: 'Критический', borderColor: '#ef4444', textColor: '#ef4444', bgColor: '#fee2e2' },
        { label: 'Высокий', borderColor: '#f97316', textColor: '#f97316', bgColor: '#ffedd5' },
        { label: 'Средний', borderColor: '#f59e0b', textColor: '#f59e0b', bgColor: '#fef3c7' },
        { label: 'Низкий', borderColor: '#22c55e', textColor: '#22c55e', bgColor: '#dcfce7' },
      ],
    },
    {
      id: 'detected_at',
      name: 'Дата обнаружения',
      type: 'datetime',
      icon: 'Clock',
      iconColor: '#06b6d4',
      required: true,
      description: 'Дата и время обнаружения',
    },
    {
      id: 'description',
      name: 'Описание',
      type: 'multiline',
      icon: 'FileText',
      iconColor: '#3b82f6',
      required: true,
      description: 'Подробное описание инцидента',
    },
    {
      id: 'response_time',
      name: 'Время реакции (мин)',
      type: 'number',
      icon: 'Timer',
      iconColor: '#f59e0b',
      required: false,
      description: 'Время реакции в минутах',
      prefix: 'мин',
    },
    {
      id: 'needs_escalation',
      name: 'Требуется эскалация',
      type: 'boolean',
      icon: 'ArrowUpRight',
      iconColor: '#a855f7',
      required: false,
      description: 'Требуется ли эскалация',
    },
    {
      id: 'affected_systems',
      name: 'Затронутые системы',
      type: 'string',
      icon: 'Network',
      iconColor: '#6366f1',
      required: false,
      description: 'Список затронутых систем',
    },
  ],
  malware: [
    {
      id: 'priority',
      name: 'Приоритет',
      type: 'select',
      icon: 'Flag',
      iconColor: '#ef4444',
      required: true,
      description: 'Приоритет инцидента',
      selectOptions: [
        { label: 'Критический', borderColor: '#ef4444', textColor: '#ef4444', bgColor: '#fee2e2' },
        { label: 'Высокий', borderColor: '#f97316', textColor: '#f97316', bgColor: '#ffedd5' },
        { label: 'Средний', borderColor: '#f59e0b', textColor: '#f59e0b', bgColor: '#fef3c7' },
        { label: 'Низкий', borderColor: '#22c55e', textColor: '#22c55e', bgColor: '#dcfce7' },
      ],
    },
    {
      id: 'detected_at',
      name: 'Дата обнаружения',
      type: 'datetime',
      icon: 'Clock',
      iconColor: '#06b6d4',
      required: true,
      description: 'Дата и время обнаружения',
    },
    {
      id: 'description',
      name: 'Описание',
      type: 'multiline',
      icon: 'FileText',
      iconColor: '#3b82f6',
      required: true,
      description: 'Подробное описание инцидента',
    },
    {
      id: 'response_time',
      name: 'Время реакции (мин)',
      type: 'number',
      icon: 'Timer',
      iconColor: '#f59e0b',
      required: false,
      description: 'Время реакции в минутах',
      prefix: 'мин',
    },
    {
      id: 'needs_escalation',
      name: 'Требуется эскалация',
      type: 'boolean',
      icon: 'ArrowUpRight',
      iconColor: '#a855f7',
      required: false,
      description: 'Требуется ли эскалация',
    },
    {
      id: 'affected_systems',
      name: 'Затронутые системы',
      type: 'string',
      icon: 'Network',
      iconColor: '#6366f1',
      required: false,
      description: 'Список затронутых систем',
    },
  ],
};

interface IncidentFieldsState {
  // Базовые поля (общие для всех типов)
  baseFields: CustomField[];
  // Дополнительные поля (глобальные, можно прикрепить к любому типу)
  extraFields: CustomField[];
  
  // Actions для базовых полей
  setBaseFields: (fields: CustomField[]) => void;
  
  // Actions для дополнительных полей
  addExtraField: (field: CustomField) => void;
  removeExtraField: (fieldId: string) => void;
  updateExtraField: (fieldId: string, updates: Partial<CustomField>) => void;
  
  // Утилиты
  getExtraFieldById: (id: string) => CustomField | null;
  getExtraFieldsByIds: (ids: string[]) => CustomField[];
}

export const useIncidentFieldsStore = create<IncidentFieldsState>()(
  persist(
    (set, get) => ({
      baseFields: DEFAULT_BASE_FIELDS,
      extraFields: [],

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
    }),
    {
      name: 'incident-fields-settings',
    }
  )
);
