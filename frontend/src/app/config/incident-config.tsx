import { BaseColumnKey, DynamicColumnKey, Incident, IncidentTypeId } from '../types/incident.ts';
import { useIncidentFieldsStore } from '../store/incidentFieldsStore.ts';
import { useIncidentTypesStore } from '../store/incidentTypesStore.ts';
import { getFileIcon } from '../features/incidents/utils/fileIcons.tsx';
import React from 'react';

export interface IncidentColumnDefinition {
  key: DynamicColumnKey;
  label: string;
  width: number;
  isDefault: boolean;
}

export interface IncidentTypeFieldDefinition {
  id: string;
  label: string;
  width: number;
}

export interface IncidentTypeDefinition {
  id: IncidentTypeId | string;
  label: string;
  description: string;
  extraFields: IncidentTypeFieldDefinition[];
}

// Дефолтные колонки (для обратной совместимости)
export const DEFAULT_INCIDENT_COLUMNS: IncidentColumnDefinition[] = [
  { key: 'название', label: 'Название', width: 250, isDefault: true },
  { key: 'ответственный', label: 'Ответственный', width: 180, isDefault: true },
  { key: 'источник', label: 'Источник', width: 150, isDefault: true },
  { key: 'хост', label: 'Хост', width: 160, isDefault: true },
  { key: 'login', label: 'Нарушитель', width: 180, isDefault: true },
  { key: 'статус', label: 'Статус', width: 120, isDefault: true },
  { key: 'дата', label: 'Дата', width: 150, isDefault: true },
];

/**
 * Получает определение типа инцидента из store
 */
export function getIncidentTypeDefinition(typeId: IncidentTypeId | string): IncidentTypeDefinition | null {
  const type = useIncidentTypesStore.getState().getTypeById(typeId);
  if (!type) return null;

  const fieldsStore = useIncidentFieldsStore.getState();
  const extraFields = fieldsStore.getExtraFieldsByIds(type.fieldIds);
  const mappedExtraFields = extraFields
    .map((field) => ({
      id: field.id,
      label: field.name,
      width: 150,
    }));

  return {
    id: type.id,
    label: type.label,
    description: type.description,
    extraFields: mappedExtraFields,
  };
}

/**
 * Получает дополнительные колонки для типа инцидента из store
 */
export function getExtraColumnDefinitions(typeId: IncidentTypeId | string): IncidentColumnDefinition[] {
  const fieldsStore = useIncidentFieldsStore.getState();
  const type = useIncidentTypesStore.getState().getTypeById(typeId);
  
  if (!type) {
    return [];
  }

  const extraFields = fieldsStore.getExtraFieldsByIds(type.fieldIds);
  return extraFields.map((field) => ({
    key: `custom:${field.id}` as DynamicColumnKey,
    label: field.name,
    width: 150,
    isDefault: false,
  }));
}

/**
 * Получает определение колонки по ключу
 */
export function getColumnDefinition(
  columnKey: DynamicColumnKey,
  incidentTypeId?: IncidentTypeId | null
): IncidentColumnDefinition | null {
  const defaultColumn = DEFAULT_INCIDENT_COLUMNS.find((column) => column.key === columnKey);
  if (defaultColumn) {
    return defaultColumn;
  }

  if (!incidentTypeId) {
    return null;
  }

  return getExtraColumnDefinitions(incidentTypeId).find((column) => column.key === columnKey) ?? null;
}

/**
 * Получает значение колонки для инцидента
 */
export function getIncidentColumnValue(incident: Incident, columnKey: DynamicColumnKey): string {
  if (columnKey.startsWith('custom:')) {
    const fieldId = columnKey.replace('custom:', '');
    return incident.дополнительныеПоля?.[fieldId] ?? '—';
  }

  const value = incident[columnKey as BaseColumnKey];
  if (columnKey === 'списокФайлов' && Array.isArray(value)) {
    return value.length > 0 ? `${value.length} файл(ов)` : 'Нет файлов';
  }

  return String(value ?? '—');
}

/**
 * Получает значение колонки для инцидента как React элемент (для рендеринга в таблице)
 */
export function getIncidentColumnValueReact(incident: Incident, columnKey: DynamicColumnKey): React.ReactNode {
  if (columnKey.startsWith('custom:')) {
    const fieldId = columnKey.replace('custom:', '');
    const value = incident.дополнительныеПоля?.[fieldId];
    if (!value) return '—';

    const fieldsStore = useIncidentFieldsStore.getState();
    const field = fieldsStore.getExtraFieldById(fieldId);

    return renderIncidentFieldValue(field, value);
  }

  const value = incident[columnKey as BaseColumnKey];
  if (columnKey === 'списокФайлов' && Array.isArray(value)) {
    if (value.length === 0) return 'Нет файлов';
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((file, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {getFileIcon(file)}
            {file}
          </span>
        ))}
      </div>
    );
  }

  // Базовые поля — ищем определение с маппингом русских ключей на store ID
  const keyToStoreIdMap: Record<string, string> = {
    'название': 'title',
    'ответственный': 'assignee',
    'источник': 'source',
    'хост': 'host',
    'login': 'login',
    'статус': 'status',
    'команда': 'team',
    'дата': 'date',
  };

  const fieldsStore = useIncidentFieldsStore.getState();
  const storeId = keyToStoreIdMap[columnKey] || columnKey;
  const baseField = fieldsStore.baseFields.find((f) => f.id === storeId);

  if (baseField && value) {
    return renderIncidentFieldValue(baseField, String(value));
  }

  return String(value ?? '—');
}

/**
 * Рендерит значение дополнительного поля инцидента с учётом его типа
 */
function renderIncidentFieldValue(
  field: { type?: string; selectOptions?: { label: string; borderColor: string; textColor: string; bgColor: string }[]; prefix?: string; postfix?: string; allowMultiple?: boolean } | undefined,
  value: string
): React.ReactNode {
  // Select/multiselect — цветные бейджи
  if (field?.type === 'select') {
    const values = value.split(',').map((v) => v.trim()).filter((v) => v);
    if (values.length === 0) return '—';
    return (
      <div className="flex flex-wrap gap-1">
        {values.map((val, idx) => {
          const option = field.selectOptions?.find((opt) => opt.label === val);
          return (
            <span
              key={idx}
              className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border"
              style={{
                borderColor: option?.borderColor || '#e5e7eb',
                color: option?.textColor || '#374151',
                backgroundColor: option?.bgColor || '#f3f4f6',
              }}
            >
              {val}
            </span>
          );
        })}
      </div>
    );
  }

  // Multiline — перенос текста
  if (field?.type === 'multiline') {
    return (
      <div className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100 break-words leading-tight">
        {value}
      </div>
    );
  }

  // File — файлы с иконками
  if (field?.type === 'file') {
    const files = value.split(',').map((s) => s.trim()).filter((s) => s);
    if (files.length === 0) return '—';
    return (
      <div className="flex flex-wrap gap-1">
        {files.map((file, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {getFileIcon(file)}
            {file}
          </span>
        ))}
      </div>
    );
  }

  // Boolean
  if (field?.type === 'boolean') {
    const isTrue = value === 'true' || value === '1';
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
          isTrue
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}
      >
        {isTrue ? 'Да' : 'Нет'}
      </span>
    );
  }

  // Number
  if (field?.type === 'number') {
    const prefix = field.prefix ? `${field.prefix} ` : '';
    const postfix = field.postfix ? ` ${field.postfix}` : '';
    return `${prefix}${value}${postfix}`;
  }

  // Datetime
  if (field?.type === 'datetime') {
    return value;
  }

  return value;
}

/**
 * Хук для получения всех полей для типа инцидента
 * Используется в React компонентах
 */
export function useIncidentType(typeId: IncidentTypeId | string) {
  return useIncidentTypesStore((state) => state.getTypeById(typeId));
}
