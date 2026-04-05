import { Violator, ViolatorDynamicColumnKey } from '../types/violator.ts';
import { useViolatorFieldsStore } from '../store/violatorFieldsStore.ts';
import * as Icons from 'lucide-react';
import React from 'react';

export interface ViolatorColumnDefinition {
  key: ViolatorDynamicColumnKey;
  label: string;
  width: number;
  isDefault?: boolean;
}

export const DEFAULT_VIOLATOR_COLUMNS: ViolatorColumnDefinition[] = [
  { key: 'name', label: 'ФИО', width: 220, isDefault: true },
  { key: 'email', label: 'Email', width: 200, isDefault: true },
  { key: 'samAccountName', label: 'SAM Account Name', width: 180, isDefault: true },
  { key: 'domain', label: 'Домен', width: 150, isDefault: true },
];

export function getExtraColumnDefinitions(): ViolatorColumnDefinition[] {
  const extraFields = useViolatorFieldsStore.getState().extraFields;
  return extraFields.map((field) => ({
    key: `custom:${field.id}`,
    label: field.name,
    width: 180,
  }));
}

export function getViolatorColumnValue(
  violator: Violator,
  columnKey: ViolatorDynamicColumnKey
): string {
  if (columnKey.startsWith('custom:')) {
    const fieldId = columnKey.replace('custom:', '');
    return violator.дополнительныеПоля?.[fieldId] || '—';
  }

  switch (columnKey) {
    case 'name':
      return violator.name || '—';
    case 'email':
      return violator.email || '—';
    case 'samAccountName':
      return violator.samAccountName || '—';
    case 'domain':
      return violator.domain || '—';
    default:
      return '—';
  }
}

export function getViolatorColumnValueReact(
  violator: Violator,
  columnKey: ViolatorDynamicColumnKey
): React.ReactNode {
  const fieldsStore = useViolatorFieldsStore.getState();

  // Дополнительные поля (custom:...)
  if (columnKey.startsWith('custom:')) {
    const fieldId = columnKey.replace('custom:', '');
    const value = violator.дополнительныеПоля?.[fieldId];
    if (!value) return '—';

    const field = fieldsStore.getExtraFieldById(fieldId);
    return renderFieldValue(field, value);
  }

  // Базовые (системные) поля
  const baseField = fieldsStore.baseFields.find((f) => f.id === columnKey);
  const rawValue = (violator as any)[columnKey];
  if (!rawValue) return '—';

  if (baseField) {
    return renderFieldValue(baseField, String(rawValue));
  }

  return rawValue;
}

function renderFieldValue(
  field: { type: string; selectOptions?: { label: string; borderColor: string; textColor: string; bgColor: string }[]; prefix?: string; postfix?: string } | undefined,
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

export function getIconComponent(iconName: string): React.ComponentType<{ className?: string; style?: React.CSSProperties }> {
  const IconComponent = (Icons as any)[iconName];
  return IconComponent || Icons.User;
}
