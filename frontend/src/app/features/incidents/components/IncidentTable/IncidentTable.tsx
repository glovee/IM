import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Settings2 } from 'lucide-react';
import { DynamicColumnKey, Incident, IncidentTypeId } from '../../../../types/incident.ts';
import ResizableDraggableColumnHeader from './ResizableDraggableColumnHeader.tsx';
import IncidentRow from './IncidentRow.tsx';
import ColumnFilter from './ColumnFilter.tsx';
import { useAppSettings } from '../../../../store/settings.ts';
import { useTableSettingsStore } from '../../../../store/tableSettingsStore.ts';
import { useIncidentTypesStore } from '../../../../store/incidentTypesStore.ts';
import {
  DEFAULT_INCIDENT_COLUMNS,
  getExtraColumnDefinitions,
  getIncidentColumnValue,
  getIncidentTypeDefinition,
  IncidentColumnDefinition,
} from '../../../../config/incident-config.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog.tsx';
import { Checkbox } from '../../../../components/ui/checkbox.tsx';

interface IncidentTableProps {
  incidents: Incident[];
}

const itemsPerPageOptions = [10, 20, 50, 100];

export default function IncidentTable({ incidents }: IncidentTableProps) {
  const types = useIncidentTypesStore((state) => state.getTypes());
  const setVisibleColumns = useTableSettingsStore((state) => state.setVisibleColumns);
  const setColumnWidth = useTableSettingsStore((state) => state.setColumnWidth);
  const getTableConfig = useTableSettingsStore((state) => state.getTableConfig);
  const itemsPerPage = useAppSettings((state) => state.itemsPerPage);
  const setItemsPerPage = useAppSettings((state) => state.setItemsPerPage);

  const [selectedIncidentType, setSelectedIncidentType] = useState<'all' | IncidentTypeId>('all');
  const [filters, setFilters] = useState<Map<DynamicColumnKey, Set<string>>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const [customItemsPerPage, setCustomItemsPerPage] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ columnKey: DynamicColumnKey; direction: 'asc' | 'desc' } | null>(null);

  const selectedTypeDefinition = selectedIncidentType === 'all'
    ? null
    : getIncidentTypeDefinition(selectedIncidentType);
  const typeSpecificColumns = selectedIncidentType === 'all'
    ? []
    : getExtraColumnDefinitions(selectedIncidentType);

  // Формируем ключ для сохранения настроек
  const settingsKey = `incidents:${selectedIncidentType}`;
  const savedConfig = getTableConfig(settingsKey);
  const isInitialized = useRef(false);

  // Инициализация колонок из сохранённых настроек
  const [columns, setColumns] = useState<IncidentColumnDefinition[]>(() => {
    if (savedConfig && savedConfig.visibleColumns.length > 0) {
      const allAvailable = [...DEFAULT_INCIDENT_COLUMNS, ...typeSpecificColumns];
      return savedConfig.visibleColumns
        .map((key) => {
          const def = allAvailable.find((c) => c.key === key);
          if (!def) return null;
          return {
            ...def,
            width: savedConfig.columnWidths[key] ?? def.width,
          };
        })
        .filter(Boolean) as IncidentColumnDefinition[];
    }
    return DEFAULT_INCIDENT_COLUMNS;
  });

  useEffect(() => {
    setColumns((prevColumns) => {
      const defaultVisibleKeys = prevColumns
        .filter((column) => column.isDefault)
        .map((column) => column.key);
      const nextColumns = DEFAULT_INCIDENT_COLUMNS.filter((column) => defaultVisibleKeys.includes(column.key));

      if (selectedIncidentType === 'all') {
        return nextColumns;
      }

      const previousCustomKeys = prevColumns
        .filter((column) => !column.isDefault)
        .map((column) => column.key);
      const availableCustomColumns = getExtraColumnDefinitions(selectedIncidentType);
      const customColumns = availableCustomColumns.filter((column) => previousCustomKeys.includes(column.key));

      return [...nextColumns, ...customColumns];
    });

    setFilters((prevFilters) => {
      const nextFilters = new Map(prevFilters);
      for (const key of Array.from(nextFilters.keys())) {
        if (key.startsWith('custom:') && selectedIncidentType === 'all') {
          nextFilters.delete(key);
        }
      }
      return nextFilters;
    });

    setSortConfig((prevSort) => {
      if (!prevSort) {
        return prevSort;
      }
      if (selectedIncidentType === 'all' && prevSort.columnKey.startsWith('custom:')) {
        return null;
      }
      return prevSort;
    });
    setCurrentPage(1);
  }, [selectedIncidentType]);

  const moveColumn = useCallback((dragIndex: number, hoverIndex: number) => {
    setColumns((prevColumns) => {
      if (dragIndex === hoverIndex) return prevColumns;
      const newColumns = [...prevColumns];
      const [removed] = newColumns.splice(dragIndex, 1);
      newColumns.splice(hoverIndex, 0, removed);
      return newColumns;
    });
  }, []);

  const handleResize = useCallback((columnKey: DynamicColumnKey, width: number) => {
    setColumns((prevColumns) =>
        prevColumns.map((col) =>
            col.key === columnKey ? { ...col, width } : col
        )
    );
    setColumnWidth(settingsKey, columnKey, width);
  }, [settingsKey, setColumnWidth]);

  const handleSort = useCallback((columnKey: DynamicColumnKey, direction: 'asc' | 'desc' | null) => {
    if (direction === null) {
      setSortConfig(null);
    } else {
      setSortConfig({ columnKey, direction });
    }
  }, []);

  const handleFilterChange = useCallback((columnKey: DynamicColumnKey, selected: Set<string>) => {
    setFilters((prev) => {
      const newFilters = new Map(prev);
      if (selected.size === 0) {
        newFilters.delete(columnKey);
      } else {
        newFilters.set(columnKey, selected);
      }
      return newFilters;
    });
    setCurrentPage(1);
  }, []);

  const incidentsByType = useMemo(() => {
    if (selectedIncidentType === 'all') {
      return incidents;
    }
    return incidents.filter((incident) => incident.типИнцидента === selectedIncidentType);
  }, [incidents, selectedIncidentType]);

  const getColumnValues = useCallback((columnKey: DynamicColumnKey) => {
    return incidentsByType.map((incident) => getIncidentColumnValue(incident, columnKey));
  }, [incidentsByType]);

  const filteredIncidents = useMemo(() => {
    if (filters.size === 0) return incidentsByType;

    return incidentsByType.filter((incident) => {
      return Array.from(filters.entries()).every(([key, selectedValues]) => {
        const value = getIncidentColumnValue(incident, key);
        return selectedValues.has(value);
      });
    });
  }, [incidentsByType, filters]);

  const sortedIncidents = useMemo(() => {
    if (!sortConfig) return filteredIncidents;

    const { columnKey, direction } = sortConfig;
    
    return [...filteredIncidents].sort((a, b) => {
      const aValue = getIncidentColumnValue(a, columnKey);
      const bValue = getIncidentColumnValue(b, columnKey);
      
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      const comparison = aValue.localeCompare(bValue, 'ru');
      return direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredIncidents, sortConfig]);

  const toggleDefaultColumn = useCallback((column: IncidentColumnDefinition, checked: boolean) => {
    setColumns((prevColumns) => {
      let nextColumns: IncidentColumnDefinition[];
      if (checked) {
        if (prevColumns.some((item) => item.key === column.key)) {
          return prevColumns;
        }

        const visibleDefaultKeys = prevColumns.filter((item) => item.isDefault).map((item) => item.key);
        const nextDefaultKeys = DEFAULT_INCIDENT_COLUMNS
          .filter((item) => visibleDefaultKeys.includes(item.key) || item.key === column.key)
          .map((item) => item.key);
        const rebuiltDefaults = DEFAULT_INCIDENT_COLUMNS.filter((item) => nextDefaultKeys.includes(item.key));
        const customColumns = prevColumns.filter((item) => !item.isDefault);
        nextColumns = [...rebuiltDefaults, ...customColumns];
      } else {
        nextColumns = prevColumns.filter((item) => item.key !== column.key);
      }
      setVisibleColumns(settingsKey, nextColumns.map((c) => c.key));
      return nextColumns;
    });
  }, [settingsKey, setVisibleColumns]);

  const toggleTypeColumn = useCallback((column: IncidentColumnDefinition, checked: boolean) => {
    setColumns((prevColumns) => {
      let nextColumns: IncidentColumnDefinition[];
      if (checked) {
        if (prevColumns.some((item) => item.key === column.key)) {
          return prevColumns;
        }
        nextColumns = [...prevColumns, column];
      } else {
        nextColumns = prevColumns.filter((item) => item.key !== column.key);
      }
      setVisibleColumns(settingsKey, nextColumns.map((c) => c.key));
      return nextColumns;
    });
  }, [settingsKey, setVisibleColumns]);

  const totalPages = Math.ceil(sortedIncidents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedIncidents = sortedIncidents.slice(startIndex, startIndex + itemsPerPage);

  const handleItemsPerPageChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomInput(true);
    } else {
      setItemsPerPage(parseInt(value));
      setCurrentPage(1);
      setShowCustomInput(false);
    }
  };

  const handleCustomItemsPerPage = () => {
    const value = parseInt(customItemsPerPage);
    if (value > 0 && value <= 1000) {
      setItemsPerPage(value);
      setCurrentPage(1);
      setShowCustomInput(false);
      setCustomItemsPerPage('');
    }
  };

  const displayedRangeStart = sortedIncidents.length === 0 ? 0 : startIndex + 1;

  return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Тип инцидента:</span>
              <select
                  value={selectedIncidentType}
                  onChange={(e) => setSelectedIncidentType(e.target.value as 'all' | IncidentTypeId)}
                  className="min-w-48 px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Все типы</option>
                {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                ))}
              </select>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Показывать на странице:</span>
            <select
                value={itemsPerPageOptions.includes(itemsPerPage) ? itemsPerPage.toString() : 'custom'}
                onChange={(e) => handleItemsPerPageChange(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {itemsPerPageOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
              ))}
              <option value="custom">Своё количество</option>
            </select>

            {showCustomInput && (
                <div className="flex items-center gap-2">
                  <input
                      type="number"
                      value={customItemsPerPage}
                      onChange={(e) => setCustomItemsPerPage(e.target.value)}
                      placeholder="Введите число"
                      min="1"
                      max="1000"
                      className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                      onClick={handleCustomItemsPerPage}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    ОК
                  </button>
                </div>
            )}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Показано {displayedRangeStart}-{Math.min(startIndex + itemsPerPage, sortedIncidents.length)} из {sortedIncidents.length}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              {/* Header */}
              <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
                <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="w-10 h-10 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Настройки отображения полей"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <div className="flex flex-1 min-w-0">
                  {columns.map((col, index) => (
                      <div
                          key={col.key}
                          className="relative shrink-0"
                          style={{ width: `${col.width}px` }}
                      >
                        <ResizableDraggableColumnHeader
                            columnKey={col.key}
                            label={col.label}
                            index={index}
                            width={col.width}
                            moveColumn={moveColumn}
                            onResize={handleResize}
                            onSort={handleSort}
                            sortDirection={sortConfig?.columnKey === col.key ? sortConfig.direction : null}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                          <ColumnFilter
                              values={getColumnValues(col.key)}
                              selectedValues={filters.get(col.key) || new Set()}
                              onFilterChange={(selected) => handleFilterChange(col.key, selected)}
                          />
                        </div>
                      </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {paginatedIncidents.length > 0 ? (
                  paginatedIncidents.map((incident) => (
                      <IncidentRow
                          key={incident.id}
                          incident={incident}
                          columns={columns}
                      />
                  ))
              ) : (
                  <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                    Нет инцидентов, соответствующих фильтрам
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Назад
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                      <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg transition-colors ${
                              currentPage === pageNum
                                  ? 'bg-blue-600 text-white'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                      >
                        {pageNum}
                      </button>
                  );
                })}
              </div>

              <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Вперёд
              </button>
            </div>
        )}

        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="sm:max-w-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
            <DialogHeader>
              <DialogTitle>Настройки таблицы</DialogTitle>
              <DialogDescription>
                {selectedTypeDefinition
                  ? `Для типа "${selectedTypeDefinition.label}" можно скрывать базовые поля и добавлять поля этого типа.`
                  : 'Без выбранного типа инцидента доступны только базовые поля таблицы.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Базовые поля</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Их можно показывать или скрывать всегда.
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DEFAULT_INCIDENT_COLUMNS.map((column) => {
                    const checked = columns.some((item) => item.key === column.key);
                    return (
                      <label
                          key={column.key}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleDefaultColumn(column, value === true)}
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-300">{column.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Поля типа инцидента</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedTypeDefinition
                      ? 'Отметьте поля, которые нужно добавить в таблицу для выбранного типа.'
                      : 'Сначала выберите тип инцидента вверху таблицы, после этого здесь появятся дополнительные поля.'}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectedTypeDefinition ? (
                    typeSpecificColumns.map((column) => {
                      const checked = columns.some((item) => item.key === column.key);
                      return (
                        <label
                          key={column.key}
                          className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleTypeColumn(column, value === true)}
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-300">{column.label}</span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Дополнительные поля недоступны без выбранного типа.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}
