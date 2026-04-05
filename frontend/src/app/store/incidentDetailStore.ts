import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IncidentTypeId } from '../types/incident.ts';

interface FieldOrderConfig {
  /** ID полей в порядке отображения */
  order: string[];
}

interface IncidentDetailState {
  /** Порядок полей: ключ = incidentTypeId (например, 'security') */
  fieldOrders: Record<string, FieldOrderConfig>;

  /** Сохранить порядок полей для типа инцидента */
  setFieldOrder: (typeId: IncidentTypeId | string, order: string[]) => void;

  /** Получить порядок полей для типа инцидента */
  getFieldOrder: (typeId: IncidentTypeId | string) => string[] | null;

  /** Сбросить порядок полей для типа инцидента */
  resetFieldOrder: (typeId: IncidentTypeId | string) => void;
}

export const useIncidentDetailStore = create<IncidentDetailState>()(
  persist(
    (set, get) => ({
      fieldOrders: {},

      setFieldOrder: (typeId, order) =>
        set((state) => ({
          fieldOrders: {
            ...state.fieldOrders,
            [typeId]: { order },
          },
        })),

      getFieldOrder: (typeId) => {
        const config = get().fieldOrders[typeId];
        return config?.order ?? null;
      },

      resetFieldOrder: (typeId) =>
        set((state) => {
          const next = { ...state.fieldOrders };
          delete next[typeId];
          return { fieldOrders: next };
        }),
    }),
    {
      name: 'incident-detail-settings',
    }
  )
);
