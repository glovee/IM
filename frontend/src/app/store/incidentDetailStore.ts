import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IncidentTypeId } from '../types/incident.ts';

interface FieldOrderConfig {
  /** ID полей в порядке отображения */
  order: string[];
}

interface HiddenFieldsConfig {
  /** ID скрытых полей */
  hiddenFieldIds: string[];
}

const EMPTY_HIDDEN_FIELD_IDS: string[] = [];

export function buildIncidentDetailSettingsKey(userId: string, typeId: IncidentTypeId | string): string {
  return `${userId}:${typeId}`;
}

interface IncidentDetailState {
  /** Порядок полей: ключ = `${userId}:${incidentTypeId}` */
  fieldOrders: Record<string, FieldOrderConfig>;
  /** Скрытые поля: ключ = `${userId}:${incidentTypeId}` */
  hiddenFields: Record<string, HiddenFieldsConfig>;

  /** Сохранить порядок полей для пользователя и типа инцидента */
  setFieldOrder: (userId: string, typeId: IncidentTypeId | string, order: string[]) => void;

  /** Получить порядок полей для пользователя и типа инцидента */
  getFieldOrder: (userId: string, typeId: IncidentTypeId | string) => string[] | null;

  /** Сбросить порядок полей для пользователя и типа инцидента */
  resetFieldOrder: (userId: string, typeId: IncidentTypeId | string) => void;

  /** Сохранить скрытые поля для пользователя и типа инцидента */
  setHiddenFieldIds: (userId: string, typeId: IncidentTypeId | string, hiddenFieldIds: string[]) => void;

  /** Получить скрытые поля для пользователя и типа инцидента */
  getHiddenFieldIds: (userId: string, typeId: IncidentTypeId | string) => string[];

  /** Скрыть поле для пользователя и типа инцидента */
  hideField: (userId: string, typeId: IncidentTypeId | string, fieldId: string) => void;

  /** Показать поле для пользователя и типа инцидента */
  showField: (userId: string, typeId: IncidentTypeId | string, fieldId: string) => void;
}

export const useIncidentDetailStore = create<IncidentDetailState>()(
  persist(
    (set, get) => ({
      fieldOrders: {},
      hiddenFields: {},

      setFieldOrder: (userId, typeId, order) =>
        set((state) => ({
          fieldOrders: {
            ...state.fieldOrders,
            [buildIncidentDetailSettingsKey(userId, typeId)]: { order },
          },
        })),

      getFieldOrder: (userId, typeId) => {
        const key = buildIncidentDetailSettingsKey(userId, typeId);
        const config = get().fieldOrders[key];
        return config?.order ?? null;
      },

      resetFieldOrder: (userId, typeId) =>
        set((state) => {
          const next = { ...state.fieldOrders };
          delete next[buildIncidentDetailSettingsKey(userId, typeId)];
          return { fieldOrders: next };
        }),

      setHiddenFieldIds: (userId, typeId, hiddenFieldIds) =>
        set((state) => ({
          hiddenFields: {
            ...state.hiddenFields,
            [buildIncidentDetailSettingsKey(userId, typeId)]: {
              hiddenFieldIds: Array.from(new Set(hiddenFieldIds)),
            },
          },
        })),

      getHiddenFieldIds: (userId, typeId) => {
        const key = buildIncidentDetailSettingsKey(userId, typeId);
        const config = get().hiddenFields[key];
        return config?.hiddenFieldIds ?? EMPTY_HIDDEN_FIELD_IDS;
      },

      hideField: (userId, typeId, fieldId) => {
        const key = buildIncidentDetailSettingsKey(userId, typeId);
        const current = get().hiddenFields[key]?.hiddenFieldIds ?? [];
        if (current.includes(fieldId)) return;
        get().setHiddenFieldIds(userId, typeId, [...current, fieldId]);
      },

      showField: (userId, typeId, fieldId) => {
        const key = buildIncidentDetailSettingsKey(userId, typeId);
        const current = get().hiddenFields[key]?.hiddenFieldIds ?? [];
        get().setHiddenFieldIds(
          userId,
          typeId,
          current.filter((id) => id !== fieldId)
        );
      },
    }),
    {
      name: 'incident-detail-settings',
    }
  )
);
