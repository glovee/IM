import { useState } from 'react';
import { Plus, Trash2, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIncidentTypesStore } from '../../../store/incidentTypesStore.ts';
import { useIncidentFieldsStore } from '../../../store/incidentFieldsStore.ts';
import { UNIVERSAL_INCIDENT_ACTION_NAMES, useIncidentActionsStore } from '../../../store/incidentActionsStore.ts';

const ITEMS_PER_PAGE = 10;

export default function IncidentTypeSettings() {
  const {
    types,
    addType,
    removeType,
    updateType,
    getTypeFieldIds,
  } = useIncidentTypesStore();

  const baseFields = useIncidentFieldsStore((state) => state.baseFields);
  const extraFields = useIncidentFieldsStore((state) => state.extraFields);
  const getExtraFieldById = useIncidentFieldsStore((state) => state.getExtraFieldById);
  const { actions, typeActions, addActionToType, removeActionFromType } = useIncidentActionsStore();
  const universalActionNames = new Set<string>(UNIVERSAL_INCIDENT_ACTION_NAMES);

  // Собираем все доступные поля для выбора (базовые не показываем, только доп.)
  const getAvailableFieldsForType = () => {
    return [...extraFields];
  };

  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState<{ [key: string]: string }>({});
  const [actionSearch, setActionSearch] = useState<{ [key: string]: string }>({});
  const [currentPage, setCurrentPage] = useState(1);

  const filteredTypes = types;
  const totalPages = Math.ceil(filteredTypes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTypes = filteredTypes.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const addIncidentType = () => {
    const newType = {
      id: Date.now().toString(),
      label: '',
      description: '',
      fieldIds: [],
    };
    addType(newType);
    setExpandedTypeId(newType.id);
  };

  const removeIncidentType = (id: string) => {
    removeType(id);
  };

  const updateIncidentType = (id: string, field: string, value: any) => {
    updateType(id, { [field]: value });
  };

  const addFieldToType = (typeId: string, fieldSlug: string) => {
    const type = types.find(t => t.id === typeId);
    if (!type) return;

    // Нельзя добавлять системные поля как дополнительные
    const systemFieldSlugs = new Set(['title', 'assignee', 'source', 'host', 'login', 'status', 'date']);
    if (systemFieldSlugs.has(fieldSlug)) {
      return;
    }

    const currentFieldIds = type.fieldIds || [];
    if (!currentFieldIds.includes(fieldSlug)) {
      updateType(typeId, { fieldIds: [...currentFieldIds, fieldSlug] });
    }
  };

  const removeFieldFromType = (typeId: string, fieldSlug: string) => {
    const type = types.find(t => t.id === typeId);
    if (!type) return;

    updateType(typeId, {
      fieldIds: (type.fieldIds || []).filter(id => id !== fieldSlug)
    });
  };

  const toggleAction = (typeId: string, actionName: string) => {
    const currentActions = typeActions[typeId] || [];
    const hasAction = currentActions.includes(actionName);

    if (hasAction) {
      removeActionFromType(typeId, actionName);
    } else {
      addActionToType(typeId, actionName);
    }
  };

  const getFieldById = (id: string) => {
    // Сначала ищем в базовых полях
    const baseField = baseFields.find(f => f.id === id);
    if (baseField) return baseField;
    // Потом в дополнительных
    return getExtraFieldById(id);
  };

  const getActionByName = (name: string) => {
    return actions.find(a => a.name === name) ?? null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Настройка типов инцидентов</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Создайте типы инцидентов и настройте необходимые поля и действия для каждого типа
        </p>
      </div>

      <div className="space-y-4">
        {paginatedTypes.map((type) => {
          const typeFieldIds = getTypeFieldIds(type.id);
          const typeActionNames = (typeActions[type.id] || []).filter(
            (actionName) => !universalActionNames.has(actionName)
          );
          const typeFields = typeFieldIds.map(id => getFieldById(id)).filter(Boolean);
          const isExpanded = expandedTypeId === type.id;

          return (
            <div key={type.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setExpandedTypeId(isExpanded ? null : type.id)}
                    className="shrink-0 mt-0.5"
                  >
                    <ChevronDown className={`w-5 h-5 text-blue-600 dark:text-blue-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  </button>
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                      {type.label || 'Новый тип инцидента'}
                    </h4>
                    {type.description && (
                      <p className="text-xs text-blue-800 dark:text-blue-400 mt-0.5">{type.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded && (
                    <button
                      onClick={() => setExpandedTypeId(null)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Готово
                    </button>
                  )}
                  <button
                    onClick={() => removeIncidentType(type.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                      Название типа
                    </label>
                    <input
                      type="text"
                      value={type.label}
                      onChange={(e) => updateIncidentType(type.id, 'label', e.target.value)}
                      placeholder="Безопасность"
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                      Описание
                    </label>
                    <textarea
                      value={type.description}
                      onChange={(e) => updateIncidentType(type.id, 'description', e.target.value)}
                      placeholder="Описание типа инцидента"
                      rows={2}
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>

                  <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                    <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Поля инцидента</h5>

                    <div className="mb-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Поиск полей..."
                          value={fieldSearch[type.id] || ''}
                          onChange={(e) => setFieldSearch({ ...fieldSearch, [type.id]: e.target.value })}
                          className="w-full rounded-lg border border-blue-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </div>

                      <div className="mt-2 max-h-40 overflow-y-auto bg-blue-100/50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        {getAvailableFieldsForType()
                          .filter(f => {
                            return f.name.toLowerCase().includes((fieldSearch[type.id] || '').toLowerCase()) &&
                              !typeFieldIds.includes(f.id);
                          })
                          .map(field => (
                            <button
                              key={field.id}
                              onClick={() => addFieldToType(type.id, field.id)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-between"
                            >
                              <span className="text-gray-900 dark:text-gray-100">{field.name}</span>
                              <Plus className="w-4 h-4 text-gray-400" />
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {typeFields.map((field) => {
                        if (!field) return null;

                        return (
                          <div
                            key={field.id}
                            className="flex items-center gap-2 bg-blue-100/50 dark:bg-blue-900/30 p-3 rounded-lg"
                          >
                            <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{field.name}</span>
                            <span className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-2 py-1 rounded">{field.type}</span>

                            <button
                              onClick={() => removeFieldFromType(type.id, field.id)}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                    <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">Доступные действия</h5>

                    <div className="mb-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Поиск действий..."
                          value={actionSearch[type.id] || ''}
                          onChange={(e) => setActionSearch({ ...actionSearch, [type.id]: e.target.value })}
                          className="w-full rounded-lg border border-blue-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </div>

                      <div className="mt-2 max-h-40 overflow-y-auto bg-blue-100/50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        {actions
                          .filter(a =>
                            !universalActionNames.has(a.name) &&
                            a.name.toLowerCase().includes((actionSearch[type.id] || '').toLowerCase()) &&
                            !typeActionNames.includes(a.name)
                          )
                          .map(action => (
                            <button
                              key={action.id}
                              onClick={() => toggleAction(type.id, action.name)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-between"
                            >
                              <span className="text-gray-900 dark:text-gray-100">{action.name}</span>
                              <Plus className="w-4 h-4 text-gray-400" />
                            </button>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {typeActionNames.map((actionName) => {
                        const actionData = getActionByName(actionName);
                        if (!actionData) return null;

                        return (
                          <div
                            key={actionName}
                            className="flex items-center gap-2 bg-blue-100/50 dark:bg-blue-900/30 p-3 rounded-lg"
                          >
                            <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{actionData.name}</span>

                            <button
                              onClick={() => toggleAction(type.id, actionName)}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-blue-200 dark:border-blue-800">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Показано {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredTypes.length)} из {filteredTypes.length}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={addIncidentType}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Добавить тип инцидента
      </button>
    </div>
  );
}
