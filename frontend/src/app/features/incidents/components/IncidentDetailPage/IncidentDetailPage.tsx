import React, { useState, useMemo, useEffect, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  FileText,
  User,
  Users,
  Database,
  AlertTriangle,
  AlertCircle,
  Monitor,
  Calendar,
  Activity,
  History,
  Plus,
  Send,
  Mail,
  MessageSquare,
  AtSign,
  Workflow,
  Paperclip,
  X,
  Pencil,
  Reply,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Flag,
  Clock,
  Server,
  Download,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { mockUser, mockUsersDirectory } from '../../../../data/mockData.ts';
import { useTeamsStore } from '../../../../store/teamsStore.ts';
import DraggableField from '../DraggableField.tsx';
import ExportButtons from '../ExportButtons.tsx';
import DraggableIncidentAction from '../DraggableIncidentAction.tsx';
import { InvestigationAttachment, InvestigationEntry, useIncidentCollaboration } from '../../../../store/incidentCollaboration.ts';
import { useIncidentTypesStore } from '../../../../store/incidentTypesStore.ts';
import { useIncidentFieldsStore } from '../../../../store/incidentFieldsStore.ts';
import { buildIncidentDetailSettingsKey, useIncidentDetailStore } from '../../../../store/incidentDetailStore.ts';
import { useIncidentActionsStore } from '../../../../store/incidentActionsStore.ts';
import { getIncidentTypeDefinition } from '../../../../config/incident-config.tsx';
import { getFileIcon } from '../../utils/fileIcons.tsx';
import { useIncidentsStore } from '../../../../store/incidents.ts';
import { Incident } from '../../../../types/incident.ts';
import IncidentFieldEditDialog from './IncidentFieldEditDialog.tsx';

const EMPTY_HIDDEN_FIELD_IDS: string[] = [];

// Helper: рендерит значение select-поля с цветами из store
function renderSelectValue(value: string, selectOptions?: { label: string; borderColor: string; textColor: string; bgColor: string }[]): React.ReactNode {
  if (!value || value === '—' || value === '') return '—';
  const values = value.split(',').map((v) => v.trim()).filter((v) => v);
  if (values.length === 0) return '—';
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((val, idx) => {
        const option = selectOptions?.find((opt) => opt.label === val);
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

// Helper: получает определение поля из store (baseFields + extraFields)
// Маппинг русских ключей на store ID
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

function getFieldDef(fieldId: string) {
  const store = useIncidentFieldsStore.getState();
  const storeId = keyToStoreIdMap[fieldId] || fieldId;
  return store.baseFields.find((f) => f.id === storeId) || store.getExtraFieldById(fieldId) || null;
}

// Helper: рендерит значение поля по его ID, используя определение из store
function renderFieldValueByStore(fieldId: string, value: string): React.ReactNode {
  if (!value || value === '—' || value === '') return value || '—';
  const def = getFieldDef(fieldId);
  if (!def) return value;

  if (def.type === 'select') {
    return renderSelectValue(value, def.selectOptions);
  }
  if (def.type === 'boolean') {
    const isTrue = value === 'true' || value === '1';
    return (
      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${isTrue ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
        {isTrue ? 'Да' : 'Нет'}
      </span>
    );
  }
  if (def.type === 'multiline') {
    return <div className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">{value}</div>;
  }
  if (def.type === 'file') {
    const files = value.split(',').map((s) => s.trim()).filter((s) => s);
    if (files.length === 0) return '—';
    return (
      <div className="flex flex-wrap gap-1">
        {files.map((file, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {getFileIcon(file)}
            {file}
          </span>
        ))}
      </div>
    );
  }
  if (def.type === 'number') {
    const prefix = def.prefix ? `${def.prefix} ` : '';
    const postfix = def.postfix ? ` ${def.postfix}` : '';
    return `${prefix}${value}${postfix}`;
  }
  return value;
}

// Field type definitions for editor and display
interface FieldTypeDefinition {
  id: string;
  label: string;
  type: 'string' | 'select' | 'boolean' | 'datetime' | 'multiline' | 'file' | 'number';
  allowMultiple?: boolean;
  selectOptions?: { label: string; value: string }[];
  icon: React.ReactNode;
  iconBg?: React.CSSProperties;
  getValue: (incident: Incident) => React.ReactNode;
  prefix?: string;
  postfix?: string;
}

// Helper: получает фон иконки из store
function getIconBg(fieldId: string): React.CSSProperties {
  const def = getFieldDef(fieldId);
  if (def?.iconColor) {
    return { backgroundColor: `${def.iconColor}20` };
  }
  return {};
}

const fieldTypes: FieldTypeDefinition[] = [
  {
    id: 'статус',
    label: 'Статус',
    type: 'select',
    selectOptions: [
      { label: 'Открыт', value: 'Открыт' },
      { label: 'В работе', value: 'В работе' },
      { label: 'Расследование', value: 'Расследование' },
      { label: 'Закрыт', value: 'Закрыт' },
      { label: 'Ложный', value: 'Ложный' },
    ],
    icon: <Activity className="w-5 h-5" style={{ color: getFieldDef('статус')?.iconColor || '#6366f1' }} />,
    iconBg: getIconBg('статус'),
    getValue: (incident) => renderFieldValueByStore('статус', incident.статус),
  },
  {
    id: 'команда',
    label: 'Команда',
    type: 'select',
    selectOptions: [], // Will be populated dynamically
    icon: <Users className="w-5 h-5" style={{ color: getFieldDef('команда')?.iconColor || '#06b6d4' }} />,
    iconBg: getIconBg('команда'),
    getValue: (incident) => incident.команда
  },
  {
    id: 'priority',
    label: 'Приоритет',
    type: 'select',
    selectOptions: [
      { label: 'Низкий', value: 'Низкий' },
      { label: 'Средний', value: 'Средний' },
      { label: 'Высокий', value: 'Высокий' },
      { label: 'Критический', value: 'Критический' },
    ],
    icon: <Flag className="w-5 h-5" style={{ color: getFieldDef('priority')?.iconColor || '#f97316' }} />,
    iconBg: getIconBg('priority'),
    getValue: (incident) => {
      const value = incident.дополнительныеПоля?.priority;
      return renderFieldValueByStore('priority', value || '—');
    }
  },
  {
    id: 'detected_at',
    label: 'Дата обнаружения',
    type: 'datetime',
    icon: <Calendar className="w-5 h-5" style={{ color: getFieldDef('detected_at')?.iconColor || '#f43f5e' }} />,
    iconBg: getIconBg('detected_at'),
    getValue: (incident) => {
      const value = incident.дополнительныеПоля?.detected_at;
      return value ? value : '—';
    }
  },
  {
    id: 'description',
    label: 'Описание',
    type: 'multiline',
    icon: <FileText className="w-5 h-5" style={{ color: getFieldDef('description')?.iconColor || '#06b6d4' }} />,
    iconBg: getIconBg('description'),
    getValue: (incident) => {
      const value = incident.дополнительныеПоля?.description || '—';
      if (value === '—') return value;
      return renderFieldValueByStore('description', value);
    }
  },
  {
    id: 'response_time',
    label: 'Время реакции (мин)',
    type: 'number',
    postfix: 'мин',
    icon: <Clock className="w-5 h-5" style={{ color: getFieldDef('response_time')?.iconColor || '#14b8a6' }} />,
    iconBg: getIconBg('response_time'),
    getValue: (incident) => {
      const value = incident.дополнительныеПоля?.response_time;
      if (!value) return '—';
      return renderFieldValueByStore('response_time', value);
    }
  },
  {
    id: 'needs_escalation',
    label: 'Требуется эскалация',
    type: 'boolean',
    icon: <AlertCircle className="w-5 h-5" style={{ color: getFieldDef('needs_escalation')?.iconColor || '#ef4444' }} />,
    iconBg: getIconBg('needs_escalation'),
    getValue: (incident) => {
      const value = incident.дополнительныеПоля?.needs_escalation;
      if (!value || value === '—' || value === '') return '—';
      return renderFieldValueByStore('needs_escalation', value);
    }
  },
  {
    id: 'evidence_files',
    label: 'Файлы доказательств',
    type: 'file',
    icon: <Paperclip className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
    getValue: (incident) => {
      const value = incident.дополнительныеПоля?.evidence_files;
      return renderFieldValueByStore('evidence_files', value || '—');
    }
  },
  {
    id: 'affected_systems',
    label: 'Затронутые системы',
    type: 'select',
    allowMultiple: true,
    selectOptions: [
      { label: 'Active Directory', value: 'Active Directory' },
      { label: 'Exchange', value: 'Exchange' },
      { label: 'File Server', value: 'File Server' },
      { label: 'VPN', value: 'VPN' },
      { label: 'Web Server', value: 'Web Server' },
    ],
    icon: <Server className="w-5 h-5" style={{ color: getFieldDef('affected_systems')?.iconColor || '#6366f1' }} />,
    iconBg: getIconBg('affected_systems'),
    getValue: (incident) => {
      const value = incident.дополнительныеПоля?.affected_systems;
      return renderFieldValueByStore('affected_systems', value || '—');
    }
  },
];

// Basic fields without special types
const basicFields: Omit<FieldTypeDefinition, 'type' | 'selectOptions' | 'allowMultiple' | 'prefix' | 'postfix'>[] = [
  { id: 'название', label: 'Название', icon: <FileText className="w-5 h-5" style={{ color: getFieldDef('название')?.iconColor || '#3b82f6' }} />, iconBg: getIconBg('название'), getValue: (incident: Incident) => incident.название },
  { id: 'ответственный', label: 'Ответственный', icon: <User className="w-5 h-5" style={{ color: getFieldDef('ответственный')?.iconColor || '#22c55e' }} />, iconBg: getIconBg('ответственный'), getValue: (incident: Incident) => incident.ответственный },
  { id: 'источник', label: 'Источник', icon: <Database className="w-5 h-5" style={{ color: getFieldDef('источник')?.iconColor || '#f97316' }} />, iconBg: getIconBg('источник'), getValue: (incident: Incident) => incident.источник },
  { id: 'login', label: 'Нарушитель', icon: <AlertTriangle className="w-5 h-5" style={{ color: getFieldDef('login')?.iconColor || '#ef4444' }} />, iconBg: getIconBg('login'), getValue: (incident: Incident) => incident.login },
  { id: 'хост', label: 'Хост', icon: <Monitor className="w-5 h-5" style={{ color: getFieldDef('хост')?.iconColor || '#6366f1' }} />, iconBg: getIconBg('хост'), getValue: (incident: Incident) => incident.хост },
  { id: 'дата', label: 'Дата создания', icon: <Calendar className="w-5 h-5" style={{ color: getFieldDef('дата')?.iconColor || '#06b6d4' }} />, iconBg: getIconBg('дата'), getValue: (incident: Incident) => incident.дата },
];

// All fields combined - add types to basic fields
const allFields: FieldTypeDefinition[] = [
  ...basicFields.map(f => {
    if (f.id === 'дата') return { ...f, type: 'datetime' as const };
    if (f.id === 'источник') return {
      ...f,
      type: 'select' as const,
      selectOptions: [
        { label: 'SIEM', value: 'SIEM' },
        { label: 'Firewall', value: 'Firewall' },
        { label: 'DLP System', value: 'DLP System' },
        { label: 'Antivirus', value: 'Antivirus' },
        { label: 'Network Monitor', value: 'Network Monitor' },
        { label: 'Email Gateway', value: 'Email Gateway' },
        { label: 'UEBA', value: 'UEBA' },
        { label: 'EDR', value: 'EDR' },
        { label: 'WAF', value: 'WAF' },
        { label: 'Resource Monitor', value: 'Resource Monitor' },
        { label: 'Device Control', value: 'Device Control' },
        { label: 'Email Security', value: 'Email Security' },
      ],
      getValue: (incident: Incident) => renderFieldValueByStore('источник', incident.источник),
    };
    return { ...f, type: 'string' as const };
  }),
  ...fieldTypes,
];

const emailTemplates = [
  {
    id: 'clarification',
    label: 'Запросить пояснение',
    subject: 'Запрос пояснения по инциденту',
    body: 'Добрый день. В рамках расследования инцидента просим вас предоставить пояснение по описанному событию и подтвердить, выполнялись ли указанные действия.',
  },
  {
    id: 'preservation',
    label: 'Попросить сохранить артефакты',
    subject: 'Сохранение артефактов по инциденту',
    body: 'Просим не удалять связанные файлы и письма до завершения расследования, а также подтвердить, что данные сохранены.',
  },
  {
    id: 'meeting',
    label: 'Приглашение на разбор',
    subject: 'Приглашение на разбор инцидента',
    body: 'Назначен дополнительный разбор инцидента. Просим подготовить описание действий и быть на связи для уточняющих вопросов.',
  },
];

function resolveViolatorEmail(violator: string, incidentId: string) {
  if (violator.includes('@')) {
    return violator;
  }
  return `incident-${incidentId}@company.com`;
}

function highlightMentions(content: string) {
  const parts = content.split(/(@[А-Яа-яA-Za-zЁё][^@\n]*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={`${part}-${index}`}
          className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >
          {part}
        </span>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

interface InvestigationThreadNode extends InvestigationEntry {
  children: InvestigationThreadNode[];
}

function buildInvestigationThreads(entries: InvestigationEntry[]): InvestigationThreadNode[] {
  const byParent = new Map<string, InvestigationEntry[]>();
  const roots: InvestigationEntry[] = [];

  for (const entry of entries) {
    if (entry.parentId) {
      const current = byParent.get(entry.parentId) ?? [];
      current.push(entry);
      byParent.set(entry.parentId, current);
    } else {
      roots.push(entry);
    }
  }

  const sortByCreatedAt = (a: InvestigationEntry, b: InvestigationEntry) => a.createdAt.localeCompare(b.createdAt);
  roots.sort(sortByCreatedAt);
  byParent.forEach((children) => children.sort(sortByCreatedAt));

  const attachChildren = (entry: InvestigationEntry): InvestigationThreadNode => ({
    ...entry,
    children: (byParent.get(entry.id) ?? []).map(attachChildren),
  });

  return roots.map(attachChildren);
}

export default function IncidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(emailTemplates[0].id);
  const [emailSubject, setEmailSubject] = useState(emailTemplates[0].subject);
  const [emailBody, setEmailBody] = useState(emailTemplates[0].body);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [showActionPicker, setShowActionPicker] = useState(false);
  const [commentAttachments, setCommentAttachments] = useState<InvestigationAttachment[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
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
  const [investigationCollapsed, setInvestigationCollapsed] = useState(false);

  const incidents = useIncidentsStore((state) => state.incidents);
  const updateIncident = useIncidentsStore((state) => state.updateIncident);
  const typesStore = useIncidentTypesStore();
  const getExtraFieldsByIds = useIncidentFieldsStore((state) => state.getExtraFieldsByIds);
  const getExtraFieldById = useIncidentFieldsStore((state) => state.getExtraFieldById);
  const baseFields = useIncidentFieldsStore((state) => state.baseFields);
  const setFieldOrder = useIncidentDetailStore((state) => state.setFieldOrder);
  const hideFieldForUser = useIncidentDetailStore((state) => state.hideField);
  const showFieldForUser = useIncidentDetailStore((state) => state.showField);
  const fieldOrdersByKey = useIncidentDetailStore((state) => state.fieldOrders);
  const actionsStore = useIncidentActionsStore();
  const teamNames = useTeamsStore((state) => state.getTeamNames)();
  const currentUserId = mockUser.id;

  const incident = useMemo(() => {
    return incidents.find((inc) => inc.id === id);
  }, [id, incidents]);
  const hiddenFieldsByKey = useIncidentDetailStore((state) => state.hiddenFields);
  const hiddenFieldIds = useMemo(() => {
    if (!incident) return EMPTY_HIDDEN_FIELD_IDS;
    const settingsKey = buildIncidentDetailSettingsKey(currentUserId, incident.типИнцидента);
    return hiddenFieldsByKey[settingsKey]?.hiddenFieldIds ?? EMPTY_HIDDEN_FIELD_IDS;
  }, [hiddenFieldsByKey, currentUserId, incident]);

  const actionsByIncident = useIncidentCollaboration((state) => state.actionsByIncident);
  const investigationByIncident = useIncidentCollaboration((state) => state.investigationByIncident);
  const initializeIncidentActions = useIncidentCollaboration((state) => state.initializeIncidentActions);
  const moveAction = useIncidentCollaboration((state) => state.moveAction);
  const addAction = useIncidentCollaboration((state) => state.addAction);
  const removeAction = useIncidentCollaboration((state) => state.removeAction);
  const addComment = useIncidentCollaboration((state) => state.addComment);
  const sendSystemEmail = useIncidentCollaboration((state) => state.sendSystemEmail);
  const replyToEmailThread = useIncidentCollaboration((state) => state.replyToEmailThread);

  const handleAddMention = (userName: string) => {
    setCommentText((prev) => `${prev}${prev.trim().length > 0 ? ' ' : ''}@${userName} `);
  };

  const handleAddAction = (actionName: string) => {
    if (!incident) return;
    addAction(incident.id, actionName);
    setShowActionPicker(false);
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const nextAttachments = files.map((file, index) => ({
      id: `local-${file.name}-${index}-${Date.now()}`,
      name: file.name,
      sizeLabel: file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`,
    }));
    setCommentAttachments((prev) => [...prev, ...nextAttachments]);
    event.target.value = '';
  };

  const removeAttachment = (attachmentId: string) => {
    setCommentAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleSendComment = () => {
    const value = commentText.trim();
    if (!incident || (!value && commentAttachments.length === 0)) return;
    addComment(incident.id, value || 'Добавлены вложения к расследованию.', commentAttachments);
    setCommentText('');
    setCommentAttachments([]);
  };

  const handleTemplateChange = (templateId: string) => {
    const template = emailTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setEmailSubject(template.subject);
    setEmailBody(template.body);
  };

  const handleSendEmail = () => {
    if (!incident) return;
    const recipient = emailRecipient.trim() || resolveViolatorEmail(incident.login, incident.id);
    if (!emailSubject.trim() || !emailBody.trim()) return;

    const selectedTemplate = emailTemplates.find((template) => template.id === selectedTemplateId);
    sendSystemEmail(
      incident.id,
      recipient,
      emailSubject.trim(),
      emailBody.trim(),
      selectedTemplate?.label ?? 'Письмо'
    );
    setEmailRecipient(recipient);
  };

  const handleSaveField = (value: string) => {
    if (!incident || !editingField) return;

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

  useEffect(() => {
    if (!incident) return;
    initializeIncidentActions(incident.id, incident.типИнцидента);
  }, [incident, initializeIncidentActions]);

  const actions = incident ? (actionsByIncident[incident.id] ?? []) : [];
  const investigationEntries = incident ? (investigationByIncident[incident.id] ?? []) : [];
  const investigationThreads = useMemo(() => buildInvestigationThreads(investigationEntries), [investigationEntries]);
  const availableActions = actionsStore.getActions().filter((action) => !actions.some((a) => a.label === action.name));
  const incidentType = incident ? getIncidentTypeDefinition(incident.типИнцидента) : undefined;
  const suggestedRecipient = incident ? (emailRecipient || resolveViolatorEmail(incident.login, incident.id)) : emailRecipient;

  // Базовые поля (всегда отображаются)
  const baseFieldIds = new Set(['название', 'ответственный', 'источник', 'login', 'хост', 'статус', 'команда', 'дата']);
  
  // Получаем fieldIds для типа инцидента из types store
  const typeFieldIds = incident ? typesStore.getTypeFieldIds(incident.типИнцидента) : [];

  // Получаем дополнительные поля, выбранные для типа
  const typeExtraFields = getExtraFieldsByIds(typeFieldIds);
  const typeExtraFieldIds = new Set(typeExtraFields.map(f => f.id));

  // Создаём динамические определения для дополнительных полей из store
  const dynamicExtraFieldDefinitions: FieldTypeDefinition[] = typeExtraFields.map(f => {
    const IconComponent = (Icons as any)[f.icon];
    let IconEl: React.ReactNode;
    if (IconComponent) {
      IconEl = React.createElement(IconComponent, { className: 'w-5 h-5', style: { color: f.iconColor || '#6366f1' } });
    } else if (f.type === 'file') {
      IconEl = <Paperclip className="w-5 h-5 text-slate-600 dark:text-slate-400" />;
    } else {
      IconEl = <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }

    return {
      id: f.id,
      label: f.name,
      type: f.type as any,
      icon: IconEl,
      iconBg: f.iconColor ? { backgroundColor: `${f.iconColor}20` } : {},
      selectOptions: f.selectOptions?.map(opt => ({ label: opt.label, value: opt.label })),
      allowMultiple: f.allowMultiple,
      prefix: f.prefix,
      postfix: f.postfix,
      getValue: (incident: Incident) => {
        const value = incident.дополнительныеПоля?.[f.id];
        return renderFieldValueByStore(f.id, value || '—');
      }
    };
  });

  // All fields combined - include dynamic extra fields
  const allFieldsWithExtras = [...allFields.map(f => {
    if (f.id === 'команда') {
      return { ...f, selectOptions: teamNames.map(name => ({ label: name, value: name })) };
    }
    return f;
  }), ...dynamicExtraFieldDefinitions];

  const requiredFields = allFieldsWithExtras.filter((field) => baseFieldIds.has(field.id));

  // Дополнительные поля - только те, что выбраны в настройках типа инцидента
  const typeSpecificFields = allFieldsWithExtras.filter((field) => {
    // Пропускаем базовые поля
    if (baseFieldIds.has(field.id)) return false;
    // Проверяем, есть ли поле в выбранных для типа
    return typeExtraFieldIds.has(field.id);
  });

  // Применяем сохранённый порядок полей (по пользователю и типу инцидента)
  const order = useMemo(() => {
    if (!incident) return null;
    const settingsKey = buildIncidentDetailSettingsKey(currentUserId, incident.типИнцидента);
    return fieldOrdersByKey[settingsKey]?.order ?? null;
  }, [currentUserId, fieldOrdersByKey, incident]);
  let orderedRequiredFields = requiredFields;
  let orderedOptionalFields = typeSpecificFields;

  if (order && order.length > 0) {
    const orderMap = new Map(order.map((fieldId, idx) => [fieldId, idx]));

    // Сортируем поля по сохранённому порядку, новые поля добавляем в конец
    orderedRequiredFields = [...requiredFields]
      .sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
    orderedOptionalFields = [...typeSpecificFields]
      .sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
  }

  const hiddenFieldIdSet = new Set(hiddenFieldIds);
  const displayedRequiredFields = orderedRequiredFields.filter((field) => !hiddenFieldIdSet.has(field.id));
  const displayedOptionalFields = orderedOptionalFields.filter((field) => !hiddenFieldIdSet.has(field.id));
  const hiddenFields = [...orderedRequiredFields, ...orderedOptionalFields].filter((field) => hiddenFieldIdSet.has(field.id));

  // Функция перемещения полей (drag-and-drop)
  const moveField = (dragIndex: number, hoverIndex: number, isOptional = false) => {
    if (!incident) return;
    const visibleFields = isOptional ? displayedOptionalFields : displayedRequiredFields;
    if (dragIndex < 0 || dragIndex >= visibleFields.length || hoverIndex < 0 || hoverIndex >= visibleFields.length) return;

    const reorderedVisibleFields = [...visibleFields];
    [reorderedVisibleFields[dragIndex], reorderedVisibleFields[hoverIndex]] = [
      reorderedVisibleFields[hoverIndex],
      reorderedVisibleFields[dragIndex],
    ];

    const hiddenRequiredFields = orderedRequiredFields.filter((field) => hiddenFieldIdSet.has(field.id));
    const hiddenOptionalFields = orderedOptionalFields.filter((field) => hiddenFieldIdSet.has(field.id));

    const nextRequiredOrder = isOptional ? orderedRequiredFields : [...reorderedVisibleFields, ...hiddenRequiredFields];
    const nextOptionalOrder = isOptional ? [...reorderedVisibleFields, ...hiddenOptionalFields] : orderedOptionalFields;

    setFieldOrder(
      currentUserId,
      incident.типИнцидента,
      [...nextRequiredOrder.map((field) => field.id), ...nextOptionalOrder.map((field) => field.id)]
    );
  };

  if (!incident) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          Инцидент не найден
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

  const openFieldEditor = (fieldId: string, label: string) => {
    // Для дополнительных полей берем информацию из store
    const storeField = getExtraFieldById(fieldId);
    // Для базовых полей ищем с маппингом
    const baseFieldDef = getFieldDef(fieldId);
    const fieldDef = storeField || baseFieldDef || allFields.find(f => f.id === fieldId) || null;

    let inputType: 'text' | 'textarea' | 'select' | 'boolean' | 'datetime' | 'file' | 'number' | 'multiselect' = 'text';
    let value = String(incident[fieldId as keyof Incident] ?? incident.дополнительныеПоля?.[fieldId] ?? '');
    let options: { label: string; value: string }[] = [];

    if (fieldDef) {
      switch (fieldDef.type) {
        case 'select':
          inputType = fieldDef.allowMultiple ? 'multiselect' : 'select';
          options = fieldDef.selectOptions?.map(opt => ({ label: opt.label, value: opt.label })) || [];
          value = String(incident.дополнительныеПоля?.[fieldId] || incident[fieldId as keyof Incident] || '');
          break;
        case 'boolean':
          inputType = 'boolean';
          value = String(incident.дополнительныеПоля?.[fieldId] || incident[fieldId as keyof Incident] || 'false');
          break;
        case 'datetime':
          inputType = 'datetime';
          value = String(incident.дополнительныеПоля?.[fieldId] || incident[fieldId as keyof Incident] || '');
          break;
        case 'multiline':
          inputType = 'textarea';
          value = String(incident.дополнительныеПоля?.[fieldId] || incident[fieldId as keyof Incident] || '');
          break;
        case 'file':
          inputType = 'file';
          value = String(incident.дополнительныеПоля?.[fieldId] || incident[fieldId as keyof Incident] || '');
          break;
        case 'number':
          inputType = 'number';
          value = String(incident.дополнительныеПоля?.[fieldId] || incident[fieldId as keyof Incident] || '0');
          break;
        default:
          inputType = 'text';
          value = String(incident.дополнительныеПоля?.[fieldId] || incident[fieldId as keyof Incident] || '');
      }
    }

    setEditingField({
      key: fieldId,
      label,
      inputType,
      value,
      options,
      isAdditional: !!storeField || incident.дополнительныеПоля?.[fieldId] !== undefined,
      prefix: fieldDef?.prefix,
      postfix: fieldDef?.postfix
    });
  };

  const handleReplyChange = (entryId: string, value: string) => {
    setReplyDrafts((prev) => ({ ...prev, [entryId]: value }));
  };

  const handleReplySubmit = (entry: InvestigationEntry) => {
    const value = (replyDrafts[entry.id] ?? '').trim();
    if (!value) return;

    if (entry.type === 'comment') {
      addComment(incident.id, value, [], entry.id);
    } else {
      replyToEmailThread(incident.id, entry.id, value);
    }

    setReplyDrafts((prev) => ({ ...prev, [entry.id]: '' }));
  };

  const renderInvestigationThread = (entry: InvestigationThreadNode, depth = 0): React.ReactNode => {
    const isOutgoing = entry.type === 'email_out';
    const isIncomingMail = entry.type === 'email_in';
    const accentClass = isOutgoing
      ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
      : isIncomingMail
        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900';

    return (
      <div key={entry.id} className={depth > 0 ? 'ml-6 mt-3 border-l border-gray-200 dark:border-gray-700 pl-4' : ''}>
        <div className={`rounded-2xl border p-4 ${accentClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.authorName}</span>
                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                  {entry.authorRole}
                </span>
                {entry.type !== 'comment' && (
                  <span className="rounded-full bg-white/80 dark:bg-black/20 px-2 py-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                    {entry.type === 'email_out' ? 'Исходящее письмо' : 'Входящий ответ'}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.createdAt}</div>
            </div>
          </div>

          {(entry.subject || entry.recipient) && (
            <div className="mt-3 rounded-xl bg-white/70 dark:bg-black/10 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
              {entry.subject && <div><span className="font-medium">Тема:</span> {entry.subject}</div>}
              {entry.recipient && <div><span className="font-medium">Адресат:</span> {entry.recipient}</div>}
              {entry.templateName && <div><span className="font-medium">Шаблон:</span> {entry.templateName}</div>}
            </div>
          )}

          <div className="mt-3 text-sm leading-6 text-gray-800 dark:text-gray-200">
            {highlightMentions(entry.content)}
          </div>

          {entry.attachments && entry.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.attachments.map((attachment: InvestigationAttachment) => (
                <div
                  key={attachment.id}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{attachment.name}</span>
                  <span className="text-gray-400 dark:text-gray-500">{attachment.sizeLabel}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
            <button
              onClick={() => {
                if (replyDrafts[entry.id] !== undefined) {
                  setReplyDrafts((prev) => {
                    const next = { ...prev };
                    delete next[entry.id];
                    return next;
                  });
                  return;
                }
                handleReplyChange(entry.id, '');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Reply className="w-3.5 h-3.5" />
              {replyDrafts[entry.id] !== undefined ? 'Скрыть ответ' : 'Ответить'}
            </button>
          </div>

          {replyDrafts[entry.id] !== undefined && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyDrafts[entry.id]}
                onChange={(e) => handleReplyChange(entry.id, e.target.value)}
                rows={3}
                placeholder={entry.type === 'comment' ? 'Ответ на комментарий...' : 'Ответ в ветке письма...'}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleReplySubmit(entry)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                  Отправить ответ
                </button>
                <button
                  onClick={() => setReplyDrafts((prev) => {
                    const next = { ...prev };
                    delete next[entry.id];
                    return next;
                  })}
                  className="rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>

        {entry.children?.map((child: any) => renderInvestigationThread(child, depth + 1))}
      </div>
    );
  };

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Карточка инцидента</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            ID: {incident.id} • Тип: <span className="font-medium">{incidentType?.label ?? incident.типИнцидента}</span>
          </p>
        </div>

        <button className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <History className="w-4 h-4" />
          История изменений
        </button>
      </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          <Workflow className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Действия
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {actions.map((action, index) => (
            <DraggableIncidentAction
              key={action.id}
              action={action}
              index={index}
              moveAction={(dragIndex, hoverIndex) => moveAction(incident.id, dragIndex, hoverIndex)}
              onRemove={(actionId) => removeAction(incident.id, actionId)}
            />
          ))}
          <ExportButtons incident={incident} />
          <div className="relative">
            <button
              onClick={() => setShowActionPicker((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>

            {showActionPicker && (
              <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 shadow-xl">
                {availableActions.length > 0 ? (
                  availableActions.map((systemAction) => (
                    <button
                      key={systemAction.id}
                      onClick={() => handleAddAction(systemAction.name)}
                      className="w-full rounded-xl px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{systemAction.name}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{systemAction.description}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Все системные действия уже добавлены.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Поля инцидента
          </div>
        </div>

        {hiddenFields.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60 p-3">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Скрытые поля:</span>
            {hiddenFields.map((field) => (
              <button
                key={field.id}
                onClick={() => showFieldForUser(currentUserId, incident.типИнцидента, field.id)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                title="Показать поле"
              >
                <Eye className="w-3.5 h-3.5" />
                {field.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedRequiredFields.map((field, index) => (
            <DraggableField
              key={field.id}
              id={field.id}
              label={field.label}
              value={field.getValue(incident)}
              icon={field.icon}
              iconBg={field.iconBg}
              index={index}
              dragType="FIELD_REQUIRED"
              moveField={(dragIndex, hoverIndex) => moveField(dragIndex, hoverIndex, false)}
              leftAction={
                <button
                  onClick={() => hideFieldForUser(currentUserId, incident.типИнцидента, field.id)}
                  className="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Скрыть поле"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              }
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

        {displayedOptionalFields.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Дополнительные поля</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedOptionalFields.map((field, index) => (
                <DraggableField
                  key={field.id}
                  id={field.id}
                  label={field.label}
                  value={field.getValue(incident)}
                  icon={field.icon}
                  iconBg={field.iconBg}
                  index={index}
                  dragType="FIELD_OPTIONAL"
                  moveField={(dragIndex, hoverIndex) => moveField(dragIndex, hoverIndex, true)}
                  leftAction={
                    <button
                      onClick={() => hideFieldForUser(currentUserId, incident.типИнцидента, field.id)}
                      className="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      title="Скрыть поле"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  }
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
      </div>

      {editingField && (
        <IncidentFieldEditDialog
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
        />
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Расследование</h2>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Здесь отображаются комментарии аналитиков, письма системе и ответы нарушителя в единой ленте.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)] gap-6">
          {/* Лента расследования - левая часть с прокруткой */}
          <div className={`min-w-0 border border-gray-200 dark:border-gray-800 rounded-2xl bg-gray-50/70 dark:bg-gray-950/40 overflow-hidden flex flex-col ${!investigationCollapsed ? 'xl:row-span-2' : ''}`}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Лента событий</h3>
            </div>
            <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${investigationCollapsed ? 'min-h-[800px] max-h-[1000px]' : 'max-h-none'}`}>
              {investigationThreads.map((entry) => renderInvestigationThread(entry))}
            </div>
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-900/50 flex items-center justify-center">
              <button
                onClick={() => setInvestigationCollapsed(!investigationCollapsed)}
                className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                {investigationCollapsed ? (
                  <>
                    <ChevronDown className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Правая часть - формы комментария и письма */}
          <div className="min-w-0 space-y-6">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <AtSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Комментарий в расследование
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Используйте `@Имя Фамилия`, чтобы отметить коллегу. Упоминание попадёт в уведомления сверху.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {mockUsersDirectory
                  .filter((user) => user.id !== mockUser.id)
                  .map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleAddMention(user.name)}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <AtSign className="w-3 h-3" />
                      {user.name}
                    </button>
                  ))}
              </div>

              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Оставьте комментарий по расследованию, отметьте коллег через @..."
                rows={6}
                className="mt-3 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Paperclip className="w-4 h-4" />
                  Прикрепить файлы
                  <input
                    type="file"
                    multiple
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                </label>
                {commentAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{attachment.name}</span>
                    <button
                      onClick={() => removeAttachment(attachment.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSendComment}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                Отправить комментарий
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Письмо нарушителю от имени системы
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Выберите шаблон, при необходимости скорректируйте текст и отправьте. Ответ появится в ленте расследования.
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Шаблон письма</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {emailTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Кому</label>
                  <input
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder={suggestedRecipient}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Тема письма</label>
                  <input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Содержание</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSendEmail}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                Отправить письмо
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
