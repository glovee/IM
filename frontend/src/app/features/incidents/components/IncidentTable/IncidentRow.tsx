import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, ChevronDown, ChevronUp, FileText, User, Users, Database, AlertTriangle, AlertCircle, Monitor, Activity, Calendar, Workflow, Pencil, Flag, Clock, Server, Paperclip, Download } from 'lucide-react';
import * as Icons from 'lucide-react';
import { DynamicColumnKey, Incident } from '../../../../types/incident.ts';
import ExportButtons from '../ExportButtons.tsx';
import { getIncidentColumnValueReact, getIncidentTypeDefinition } from '../../../../config/incident-config.tsx';
import { getFileIcon } from '../../utils/fileIcons.tsx';
import { useIncidentCollaboration } from '../../../../store/incidentCollaboration.ts';
import { useIncidentTypesStore } from '../../../../store/incidentTypesStore.ts';
import { useIncidentFieldsStore } from '../../../../store/incidentFieldsStore.ts';
import { useTeamsStore } from '../../../../store/teamsStore.ts';
import DraggableIncidentAction from '../DraggableIncidentAction.tsx';
import IncidentFieldEditDialog from '../IncidentDetailPage/IncidentFieldEditDialog.tsx';
import { useIncidentsStore } from '../../../../store/incidents.ts';

const incidentStatusOptions = ['Открыт', 'В работе', 'Расследование', 'Закрыт', 'Ложный'];

interface IncidentRowProps {
  incident: Incident;
  columns: { key: DynamicColumnKey; label: string; width: number }[];
}

export default function IncidentRow({ incident, columns }: IncidentRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionsCollapsed, setActionsCollapsed] = useState(false);
  const [editingField, setEditingField] = useState<{
    key: string;
    label: string;
    inputType: 'text' | 'select' | 'boolean' | 'datetime' | 'textarea' | 'number' | 'multiselect' | 'file';
    value: string;
    options?: { label: string; value: string }[];
    isAdditional?: boolean;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; incidentId: string } | null>(null);
  const navigate = useNavigate();
  const typesStore = useIncidentTypesStore();
  const getExtraFieldsByIds = useIncidentFieldsStore((state) => state.getExtraFieldsByIds);
  const getExtraFieldById = useIncidentFieldsStore((state) => state.getExtraFieldById);
  const baseFields = useIncidentFieldsStore((state) => state.baseFields);
  const teamNames = useTeamsStore((state) => state.getTeamNames)();
  const incidentType = getIncidentTypeDefinition(incident.типИнцидента);
  const actionsByIncident = useIncidentCollaboration((state) => state.actionsByIncident);
  const initializeIncidentActions = useIncidentCollaboration((state) => state.initializeIncidentActions);
  const updateIncident = useIncidentsStore((state) => state.updateIncident);
  
  // Получаем fieldIds для типа инцидента из types store
  const typeFieldIds = typesStore.getTypeFieldIds(incident.типИнцидента);

  // Базовые поля (всегда отображаются)
  const baseFieldIds = new Set(['title', 'assignee', 'source', 'host', 'login', 'status', 'team', 'date']);

  // Получаем ТОЛЬКО дополнительные поля, выбранные для типа инцидента
  const typeExtraFields = getExtraFieldsByIds(typeFieldIds);
  const typeExtraFieldIds = typeExtraFields.filter(f => !baseFieldIds.has(f.id)).map(f => f.id);

  useEffect(() => {
    initializeIncidentActions(incident.id, incident.типИнцидента);
  }, [incident.id, incident.типИнцидента, initializeIncidentActions]);

  const actions = actionsByIncident[incident.id] ?? [];
  
  // Функция для получения иконки по id поля
  const getFieldIcon = (id: string) => {
    // Ищем и в extraFields, и в baseFields
    const storeField = findFieldDefinition(id);
    if (storeField) {
      const IconComponent = (Icons as any)[storeField.icon];
      if (IconComponent) {
        return {
          icon: <IconComponent className="w-5 h-5" style={{ color: storeField.iconColor }} />,
          bgStyle: { backgroundColor: `${storeField.iconColor}20` },
          bg: ''
        };
      }
    }

    // Fallback на захардкоженные иконки
    const iconMap: Record<string, { icon: any; bg: string }> = {
      'priority': { icon: <Flag className="w-5 h-5 text-orange-600 dark:text-orange-400" />, bg: 'bg-orange-100 dark:bg-orange-900' },
      'detected_at': { icon: <Clock className="w-5 h-5 text-rose-600 dark:text-rose-400" />, bg: 'bg-rose-100 dark:bg-rose-900' },
      'description': { icon: <FileText className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />, bg: 'bg-cyan-100 dark:bg-cyan-900' },
      'response_time': { icon: <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />, bg: 'bg-teal-100 dark:bg-teal-900' },
      'needs_escalation': { icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />, bg: 'bg-red-100 dark:bg-red-900' },
      'affected_systems': { icon: <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />, bg: 'bg-indigo-100 dark:bg-indigo-900' },
      'evidence_files': { icon: <Paperclip className="w-5 h-5 text-slate-600 dark:text-slate-400" />, bg: 'bg-slate-100 dark:bg-slate-900' },
    };
    const fallback = iconMap[id] || { icon: <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />, bg: 'bg-gray-100 dark:bg-gray-900' };
    return { ...fallback, bgStyle: {} };
  };
  
  // Функция для получения имени поля
  const getFieldDisplayName = (id: string): string => {
    // Сначала пытаемся получить имя из store
    const storeField = getExtraFieldById(id);
    if (storeField) {
      return storeField.name;
    }
    
    // Fallback на захардкоженные имена
    const idToNameMap: Record<string, string> = {
      'priority': 'Приоритет',
      'detected_at': 'Дата обнаружения',
      'description': 'Описание',
      'response_time': 'Время реакции (мин)',
      'needs_escalation': 'Требуется эскалация',
      'affected_systems': 'Затронутые системы',
      'evidence_files': 'Файлы доказательств',
    };
    return idToNameMap[id] || id;
  };

  // Маппинг slug в тип поля (используем русские ключи, как в requiredDetails)
  const slugToTypeMap: Record<string, 'select' | 'boolean' | 'datetime' | 'multiline' | 'number' | 'text' | 'file'> = {
    'priority': 'select',
    'статус': 'select',
    'команда': 'select',
    'источник': 'select',
    'дата': 'datetime',
    'detected_at': 'datetime',
    'description': 'multiline',
    'response_time': 'number',
    'needs_escalation': 'boolean',
    'affected_systems': 'select',
    'evidence_files': 'file',
  };

  // Опции для select полей (используем русские ключи)
  const selectOptionsMap: Record<string, string[]> = {
    'priority': ['Низкий', 'Средний', 'Высокий', 'Критический'],
    'статус': incidentStatusOptions,
    'команда': teamNames,
    'источник': ['SIEM', 'Firewall', 'DLP System', 'Antivirus', 'Network Monitor', 'Email Gateway', 'UEBA', 'EDR', 'WAF', 'Resource Monitor', 'Device Control', 'Email Security'],
    'needs_escalation': ['true', 'false'],
    'affected_systems': ['Active Directory', 'Exchange', 'File Server', 'VPN', 'Web Server'],
  };

  // Хелпер: ищет определение поля и в baseFields, и в extraFields
  // Маппинг русских ключей на английские ID в store
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

  const findFieldDefinition = (fieldKey: string) => {
    const storeId = keyToStoreIdMap[fieldKey] || fieldKey;
    return baseFields.find(f => f.id === storeId) || getExtraFieldById(fieldKey) || null;
  };

  // Функция для определения типа ввода по ключу поля
  const getFieldInputType = (fieldKey: string): { inputType: 'text' | 'select' | 'boolean' | 'datetime' | 'textarea' | 'number' | 'multiselect' | 'file', options?: { label: string; value: string }[] } => {
    // Сначала получаем поле из store (и baseFields, и extraFields)
    const storeField = findFieldDefinition(fieldKey);

    if (storeField) {
      const options = storeField.selectOptions?.map(opt => ({ label: opt.label, value: opt.label }));

      if (storeField.type === 'select') {
        return { inputType: storeField.allowMultiple ? 'multiselect' : 'select', options };
      }
      if (storeField.type === 'multiline') return { inputType: 'textarea', options };
      if (storeField.type === 'datetime') return { inputType: 'datetime', options };
      if (storeField.type === 'boolean') return { inputType: 'boolean', options };
      if (storeField.type === 'number') return { inputType: 'number', options };
      if (storeField.type === 'file') return { inputType: 'file', options };
    }

    // Fallback на slugToTypeMap для базовых полей
    const fieldType = slugToTypeMap[fieldKey] || 'text';
    let stringOptions = selectOptionsMap[fieldKey];
    const options = stringOptions?.map(s => ({ label: s, value: s }));

    if (fieldType === 'multiline') return { inputType: 'textarea', options };
    if (fieldType === 'select') return { inputType: 'select', options };
    if (fieldType === 'datetime') return { inputType: 'datetime', options };
    if (fieldType === 'boolean') return { inputType: 'boolean', options };
    if (fieldType === 'number') return { inputType: 'number', options };
    if (fieldType === 'file') return { inputType: 'file', options };

    return { inputType: 'text', options };
  };

  // Функция для рендеринга значения поля с учётом типа
  const renderFieldValue = (fieldKey: string, value: string) => {
    const { inputType, options } = getFieldInputType(fieldKey);
    const storeField = findFieldDefinition(fieldKey);
    
    // Для select/multiselect полей рендерим цветные бейджи
    if (inputType === 'select' || inputType === 'multiselect') {
      if (!options || options.length === 0) {
        return (
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
            {value || '—'}
          </div>
        );
      }
      const values = value.split(',').map(v => v.trim()).filter(v => v);
      return (
        <div className="flex flex-wrap gap-1">
          {values.map((val, idx) => {
            const storeOption = storeField?.selectOptions?.find(opt => opt.label === val);
            const option = options.find(o => o.value === val);
            return (
              <span
                key={idx}
                className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border"
                style={{
                  borderColor: storeOption?.borderColor || (option ? '#3b82f6' : '#e5e7eb'),
                  color: storeOption?.textColor || (option ? '#1d4ed8' : '#374151'),
                  backgroundColor: storeOption?.bgColor || (option ? '#dbeafe' : '#f3f4f6'),
                }}
              >
                {val}
              </span>
            );
          })}
        </div>
      );
    }
    
    // Для file полей рендерим как список файлов с кнопкой скачать
    if (inputType === 'file') {
      if (!value || value === '—' || value === '') {
        return (
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
            —
          </div>
        );
      }
      const files = value.split(',').map(s => s.trim()).filter(s => s);
      return (
        <div className="flex flex-wrap gap-1">
          {files.map((file, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {getFileIcon(file)}
              {file}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  // Имитация скачивания (в реальности будет запрос к API)
                  alert(`Скачивание файла: ${file}`);
                }}
                className="ml-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                title="Скачать"
              >
                <Download className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      );
    }
    
    // Для multiline рендерим с переносами
    if (inputType === 'textarea' || String(inputType) === 'multiline') {
      return (
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
          {value}
        </div>
      );
    }
    
    // Для boolean
    if (inputType === 'boolean') {
      return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
          value === 'true' 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}>
          {value === 'true' ? 'Да' : 'Нет'}
        </span>
      );
    }
    
    // Для datetime
    if (inputType === 'datetime') {
      return (
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {value || '—'}
        </div>
      );
    }
    
    // Для number с postfix
    if (inputType === 'number') {
      const postfix = storeField?.postfix || (fieldKey === 'response_time' ? ' мин' : '');
      return (
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {value}{postfix}
        </div>
      );
    }
    
    // Обычный текст
    return (
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
        {value}
      </div>
    );
  };

  const requiredDetails = useMemo(() => ([
    {
      key: 'название',
      label: 'Название',
      value: incident.название,
      icon: <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      key: 'ответственный',
      label: 'Ответственный',
      value: incident.ответственный,
      icon: <User className="w-5 h-5 text-green-600 dark:text-green-400" />,
      iconBg: 'bg-green-100 dark:bg-green-900',
    },
    {
      key: 'источник',
      label: 'Источник',
      value: incident.источник,
      icon: <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      iconBg: 'bg-purple-100 dark:bg-purple-900',
    },
    {
      key: 'login',
      label: 'Нарушитель',
      value: incident.login,
      icon: <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />,
      iconBg: 'bg-red-100 dark:bg-red-900',
    },
    {
      key: 'хост',
      label: 'Хост',
      value: incident.хост,
      icon: <Monitor className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      iconBg: 'bg-slate-100 dark:bg-slate-900',
    },
    {
      key: 'статус',
      label: 'Статус',
      value: incident.статус,
      icon: <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      iconBg: 'bg-indigo-100 dark:bg-indigo-900',
    },
    {
      key: 'команда',
      label: 'Команда',
      value: incident.команда,
      icon: <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />,
      iconBg: 'bg-cyan-100 dark:bg-cyan-900',
    },
    {
      key: 'дата',
      label: 'Дата создания',
      value: incident.дата,
      icon: <Calendar className="w-5 h-5 text-pink-600 dark:text-pink-400" />,
      iconBg: 'bg-pink-100 dark:bg-pink-900',
    },
  ]), [incident]);

  const handleRowDoubleClick = () => {
    navigate(`/incident/${incident.id}`);
  };

  const handleRowAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      window.open(`/incident/${incident.id}`, '_blank');
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, incidentId: incident.id });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const openFieldEditor = (fieldKey: string, label: string, value: string, inputType: 'text' | 'select' | 'boolean' | 'datetime' | 'textarea' | 'number' | 'multiselect' | 'file' = 'text', options?: { label: string; value: string }[], isAdditional = false) => {
    setEditingField({ key: fieldKey, label, value, inputType, options, isAdditional });
  };

  const handleSaveField = (value: string) => {
    if (!editingField) return;

    if (editingField.isAdditional) {
      updateIncident(incident.id, {
        дополнительныеПоля: {
          ...(incident.дополнительныеПоля ?? {}),
          [editingField.key]: value.trim(),
        },
      });
      return;
    }

    updateIncident(incident.id, {
      [editingField.key]: value.trim(),
    } as Partial<Incident>);
  };

  return (
      <>
        <div className="flex border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <div
              className="w-10 h-10 flex items-center justify-center border-r border-gray-200 dark:border-gray-700 flex-shrink-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
          >
            {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </div>

          <div
              className="flex flex-1 min-w-0 cursor-pointer"
              onDoubleClick={handleRowDoubleClick}
              onAuxClick={handleRowAuxClick}
              onContextMenu={handleRowContextMenu}
              style={{ userSelect: 'text' }}
          >
            {columns.map((col) => {
              const value = getIncidentColumnValueReact(incident, col.key);
              return (
                <div
                  key={col.key}
                  className={`px-3 h-10 flex items-center text-sm text-gray-900 dark:text-gray-100 border-r border-gray-150 dark:border-gray-700 truncate flex-shrink-0`}
                  style={{ width: `${col.width}px`, userSelect: 'text' }}
                >
                  {value}
                </div>
              );
            })}
          </div>
        </div>

        {contextMenu && contextMenu.incidentId === incident.id && (
          <div 
            className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 min-w-[200px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                navigate(`/incident/${incident.id}`);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Открыть инцидент
            </button>
            <button
              onClick={() => {
                window.open(`/incident/${incident.id}`, '_blank');
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Workflow className="w-4 h-4" />
              Открыть в новой вкладке
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
              onClick={() => {
                setIsExpanded(!isExpanded);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Свернуть
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Развернуть
                </>
              )}
            </button>
          </div>
        )}

        {isExpanded && (
            <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
              <div className="max-w-6xl space-y-4">
                
                {/* Actions Section */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <Workflow className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      Действия
                    </div>
                    {actions.length > 3 && (
                      <button
                        onClick={() => setActionsCollapsed(!actionsCollapsed)}
                        className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        {actionsCollapsed ? (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Показать все ({actions.length})
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            Свернуть
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(actionsCollapsed ? actions.slice(0, 3) : actions).map((action, index) => (
                      <DraggableIncidentAction
                        key={action.id}
                        action={action}
                        index={index}
                        moveAction={() => {}}
                        onRemove={() => {}}
                        readonly
                      />
                    ))}
                    <ExportButtons incident={incident} />
                  </div>
                  {actionsCollapsed && actions.length > 3 && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Показано 3 из {actions.length} действий
                    </div>
                  )}
                </div>

                {/* Fields Section */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {requiredDetails.map((detail) => (
                      <div key={detail.key} className="flex items-start gap-3 min-w-0">
                        <div className={`w-10 h-10 ${detail.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          {detail.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <div className="text-xs text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">{detail.label}</div>
                            <button
                              onClick={() => {
                                const { inputType, options } = getFieldInputType(detail.key);
                                console.log('Editing field:', detail.key, 'type:', inputType, 'options:', options);
                                openFieldEditor(detail.key, detail.label, String(detail.value), inputType, options);
                              }}
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 flex-shrink-0"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                          {renderFieldValue(detail.key, String(detail.value))}
                          {detail.key === 'название' && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Тип: {incidentType?.label ?? incident.типИнцидента}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Fields Section */}
                {typeExtraFieldIds.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Дополнительные поля</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      {typeExtraFieldIds.map((id) => {
                        const { icon, bg, bgStyle } = getFieldIcon(id);
                        const fieldName = getFieldDisplayName(id);
                        return (
                          <div key={id} className="flex items-start gap-3 min-w-0">
                            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`} style={bgStyle}>
                              {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-1">
                                <div className="text-xs text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">{fieldName}</div>
                                <button
                                  onClick={() => {
                                    const { inputType, options } = getFieldInputType(id);
                                    openFieldEditor(id, fieldName, incident.дополнительныеПоля?.[id] ?? '', inputType, options, true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 flex-shrink-0"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                              {renderFieldValue(id, incident.дополнительныеПоля?.[id] ?? '—')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
        )}

        {editingField && (
          <IncidentFieldEditDialog
            open={Boolean(editingField)}
            onOpenChange={(open) => {
              if (!open) setEditingField(null);
            }}
            label={editingField.label}
            value={editingField.value}
            inputType={editingField.inputType}
            options={editingField.options}
            onSave={handleSaveField}
          />
        )}
      </>
  );
}
