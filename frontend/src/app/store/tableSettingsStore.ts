import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IncidentTypeId } from '../types/incident.ts';

/** Видимые колонки для таблицы */
interface ColumnConfig {
  /** ID колонок в порядке отображения */
  visibleColumns: string[];
  /** Ширина каждой колонки */
  columnWidths: Record<string, number>;
}

interface TableSettingsState {
  /** Настройки таблиц:
   *  Ключ = `${tableType}:${userId}:${selectedType}`
   *  tableType: 'incidents' | 'violators'
   *  userId: ID пользователя
   *  selectedType: 'all' или конкретный тип инцидента
   */
  tables: Record<string, ColumnConfig>;

  /** Сохранить видимые колонки */
  setVisibleColumns: (key: string, columns: string[]) => void;

  /** Сохранить ширину колонки */
  setColumnWidth: (key: string, columnId: string, width: number) => void;

  /** Получить конфигурацию таблицы */
  getTableConfig: (key: string) => ColumnConfig | null;

  /** Сбросить настройки таблицы */
  resetTable: (key: string) => void;
}

export const useTableSettingsStore = create<TableSettingsState>()(
  persist(
    (set, get) => ({
      tables: {},

      setVisibleColumns: (key, columns) =>
        set((state) => ({
          tables: {
            ...state.tables,
            [key]: {
              ...(state.tables[key] || { columnWidths: {} }),
              visibleColumns: columns,
            },
          },
        })),

      setColumnWidth: (key, columnId, width) =>
        set((state) => ({
          tables: {
            ...state.tables,
            [key]: {
              ...(state.tables[key] || { visibleColumns: [] }),
              columnWidths: {
                ...(state.tables[key]?.columnWidths || {}),
                [columnId]: width,
              },
            },
          },
        })),

      getTableConfig: (key) => {
        return get().tables[key] ?? null;
      },

      resetTable: (key) =>
        set((state) => {
          const next = { ...state.tables };
          delete next[key];
          return { tables: next };
        }),
    }),
    {
      name: 'table-settings',
    }
  )
);
