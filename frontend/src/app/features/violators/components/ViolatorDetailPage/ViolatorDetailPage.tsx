import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  User,
  Mail,
  Key,
  Server,
  FileText,
  Pencil,
  History,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import React from 'react';
import { useViolatorsStore } from '../../../../store/violatorsStore.ts';
import { useViolatorFieldsStore } from '../../../../store/violatorFieldsStore.ts';
import { Violator } from '../../../../types/violator.ts';
import DraggableField from '../../../incidents/components/DraggableField.tsx';
import ViolatorFieldEditDialog from './ViolatorFieldEditDialog.tsx';

interface FieldTypeDefinition {
  id: string;
  label: string;
  type: 'string' | 'select' | 'boolean' | 'datetime' | 'multiline' | 'file' | 'number';
  allowMultiple?: boolean;
  selectOptions?: { label: string; value: string }[];
  icon: React.ReactNode;
  getValue: (violator: Violator) => React.ReactNode;
  prefix?: string;
  postfix?: string;
}

const getIconComponent = (iconName: string) => {
  const IconComponent = (Icons as any)[iconName];
  return IconComponent || Icons.User;
};

export default function ViolatorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const violators = useViolatorsStore((state) => state.violators);
  const updateViolator = useViolatorsStore((state) => state.updateViolator);
  const getExtraFieldById = useViolatorFieldsStore((state) => state.getExtraFieldById);
  const extraFields = useViolatorFieldsStore((state) => state.extraFields);
  const baseFields = useViolatorFieldsStore((state) => state.baseFields);

  const [editingField, setEditingField] = useState<{
    key: string;
    label: string;
    inputType: 'text' | 'textarea' | 'select' | 'boolean' | 'datetime' | 'file' | 'number' | 'multiselect';
    value: string;
    options?: { label: string; value: string }[];
    isAdditional?: boolean;
    prefix?: string;
    postfix?: string;
  } | null>(null);

  const violator = useMemo(() => {
    return violators.find((v) => v.id === id);
  }, [id, violators]);

  // Базовые поля нарушителя
  const baseFieldDefinitions: FieldTypeDefinition[] = baseFields.map((f) => ({
    id: f.id,
    label: f.name,
    type: f.type as FieldTypeDefinition['type'],
    icon: React.createElement(getIconComponent(f.icon), {
      className: 'w-5 h-5',
      style: { color: f.iconColor },
    }),
    selectOptions: f.selectOptions?.map((opt) => ({ label: opt.label, value: opt.label })),
    getValue: (violator: Violator) => {
      const val = (violator as any)[f.id];
      return val || '—';
    },
  }));

  // Дополнительные поля
  const extraFieldDefinitions: FieldTypeDefinition[] = extraFields.map((f) => ({
    id: f.id,
    label: f.name,
    type: f.type as FieldTypeDefinition['type'],
    icon: React.createElement(getIconComponent(f.icon), {
      className: 'w-5 h-5',
      style: { color: f.iconColor },
    }),
    selectOptions: f.selectOptions?.map((opt) => ({ label: opt.label, value: opt.label })),
    allowMultiple: f.allowMultiple,
    prefix: f.prefix,
    postfix: f.postfix,
    getValue: (violator: Violator) => {
      const val = violator.дополнительныеПоля?.[f.id];
      if (!val || val === '') return '—';
      return val;
    },
  }));

  const allFields = [...baseFieldDefinitions, ...extraFieldDefinitions];

  const openFieldEditor = (fieldId: string, label: string) => {
    const storeField = getExtraFieldById(fieldId);
    const baseField = baseFields.find((f) => f.id === fieldId);

    let inputType: 'text' | 'textarea' | 'select' | 'boolean' | 'datetime' | 'file' | 'number' | 'multiselect' = 'text';
    let value = String((violator as any)[fieldId] ?? violator?.дополнительныеПоля?.[fieldId] ?? '');
    let options: { label: string; value: string }[] = [];
    const fieldDef = storeField || baseField;

    if (fieldDef) {
      switch (fieldDef.type) {
        case 'select':
          inputType = fieldDef.allowMultiple ? 'multiselect' : 'select';
          options = fieldDef.selectOptions?.map((opt) => ({ label: opt.label, value: opt.label })) || [];
          value = String(violator?.дополнительныеПоля?.[fieldId] || (violator as any)[fieldId] || '');
          break;
        case 'boolean':
          inputType = 'boolean';
          value = String(violator?.дополнительныеПоля?.[fieldId] || (violator as any)[fieldId] || 'false');
          break;
        case 'datetime':
          inputType = 'datetime';
          value = String(violator?.дополнительныеПоля?.[fieldId] || (violator as any)[fieldId] || '');
          break;
        case 'multiline':
          inputType = 'textarea';
          value = String(violator?.дополнительныеПоля?.[fieldId] || (violator as any)[fieldId] || '');
          break;
        case 'file':
          inputType = 'file';
          value = String(violator?.дополнительныеПоля?.[fieldId] || (violator as any)[fieldId] || '');
          break;
        case 'number':
          inputType = 'number';
          value = String(violator?.дополнительныеПоля?.[fieldId] || (violator as any)[fieldId] || '0');
          break;
        default:
          inputType = 'text';
          value = String(violator?.дополнительныеПоля?.[fieldId] || (violator as any)[fieldId] || '');
      }
    }

    setEditingField({
      key: fieldId,
      label,
      inputType,
      value,
      options,
      isAdditional: !!storeField || violator?.дополнительныеПоля?.[fieldId] !== undefined,
      prefix: fieldDef?.prefix,
      postfix: fieldDef?.postfix,
    });
  };

  const handleSaveField = (value: string) => {
    if (!violator || !editingField) return;

    if (editingField.isAdditional) {
      updateViolator(violator.id, {
        дополнительныеПоля: {
          ...(violator.дополнительныеПоля ?? {}),
          [editingField.key]: value.trim(),
        },
      });
      return;
    }

    updateViolator(violator.id, {
      [editingField.key]: value.trim(),
    } as Partial<Violator>);
  };

  if (!violator) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          Нарушитель не найден
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="relative">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
        <div className="pr-40">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Карточка нарушителя</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            ID: {violator.id} • Домен: <span className="font-medium">{violator.domain}</span>
          </p>
        </div>

        <button className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <History className="w-4 h-4" />
          История изменений
        </button>
      </div>

      {/* Базовые поля */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Основные данные
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {baseFieldDefinitions.map((field, index) => (
            <DraggableField
              key={field.id}
              id={field.id}
              label={field.label}
              value={field.getValue(violator)}
              icon={field.icon}
              index={index}
              moveField={() => {}}
              action={
                <button
                  onClick={() => openFieldEditor(field.id, field.label)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Изменить
                </button>
              }
            />
          ))}
        </div>
      </div>

      {/* Дополнительные поля */}
      {extraFieldDefinitions.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Дополнительные поля
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extraFieldDefinitions.map((field, index) => (
              <DraggableField
                key={field.id}
                id={field.id}
                label={field.label}
                value={field.getValue(violator)}
                icon={field.icon}
                index={index}
                moveField={() => {}}
                action={
                  <button
                    onClick={() => openFieldEditor(field.id, field.label)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Изменить
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Диалог редактирования */}
      {editingField && (
        <ViolatorFieldEditDialog
          open={Boolean(editingField)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingField(null);
            }
          }}
          label={editingField.label}
          value={editingField.value}
          inputType={editingField.inputType}
          options={editingField.options}
          onSave={handleSaveField}
          prefix={editingField.prefix}
          postfix={editingField.postfix}
        />
      )}
    </div>
  );
}
